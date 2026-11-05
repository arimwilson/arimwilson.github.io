#!/usr/bin/env python3
"""Generate TTS speech and modulate it onto a selected carrier frequency.

This does not make speech directly intelligible at the carrier frequency; it creates
an AM-modulated high-frequency signal useful for experiments.

Requirements:
  pip install numpy sounddevice pyttsx3
"""

import argparse
import subprocess
import sys
import tempfile
import wave
import aifc
from pathlib import Path

import numpy as np

try:
    import pyttsx3
except ImportError:
    pyttsx3 = None

try:
    import sounddevice as sd
except ImportError:
    sd = None


def _convert_with_afconvert_to_wav(path: Path) -> Path:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        converted_path = Path(tf.name)

    try:
        subprocess.run(
            ["afconvert", "-f", "WAVE", "-d", "LEI16", str(path), str(converted_path)],
            check=True,
            capture_output=True,
        )
    except FileNotFoundError as exc:
        converted_path.unlink(missing_ok=True)
        raise ValueError("Unsupported AIFF-C compression and afconvert is unavailable") from exc
    except subprocess.CalledProcessError as exc:
        converted_path.unlink(missing_ok=True)
        detail = exc.stderr.decode(errors="replace").strip()
        raise ValueError(f"Unable to convert TTS output with afconvert: {detail}") from exc

    return converted_path


def _load_pcm_from_file(path: Path) -> tuple[np.ndarray, int, int]:
    with path.open("rb") as f:
        magic = f.read(12)

    if magic.startswith(b"RIFF"):
        with wave.open(str(path), "rb") as wf:
            channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            sample_rate = wf.getframerate()
            nframes = wf.getnframes()
            raw = wf.readframes(nframes)
            dtype = "<i2"
    elif magic[0:4] == b"FORM":
        try:
            with aifc.open(str(path), "rb") as af:
                channels = af.getnchannels()
                sample_width = af.getsampwidth()
                sample_rate = af.getframerate()
                nframes = af.getnframes()
                raw = af.readframes(nframes)
                dtype = ">i2"
        except aifc.Error:
            converted_path = _convert_with_afconvert_to_wav(path)
            try:
                return _load_pcm_from_file(converted_path)
            finally:
                converted_path.unlink(missing_ok=True)
    else:
        raise ValueError("Unsupported TTS output format (expected WAV/AIFF)")

    if sample_width != 2:
        raise ValueError(f"Unsupported sample width: {sample_width} bytes")

    data = np.frombuffer(raw, dtype=dtype).astype(np.float32) / 32768.0
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    return data, sample_rate, channels


def synthesize_tts_to_array(text: str, rate_wpm: int) -> tuple[np.ndarray, int]:
    if pyttsx3 is None:
        print("Missing dependency: pyttsx3. Install with: pip install pyttsx3", file=sys.stderr)
        sys.exit(2)

    engine = pyttsx3.init()
    engine.setProperty("rate", rate_wpm)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        wav_path = Path(tf.name)

    try:
        engine.save_to_file(text, str(wav_path))
        engine.runAndWait()

        data, sample_rate, _channels = _load_pcm_from_file(wav_path)

        peak = np.max(np.abs(data)) if data.size else 0.0
        if peak > 0:
            data = data / peak
        return data, sample_rate
    finally:
        wav_path.unlink(missing_ok=True)


def resample_linear(x: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    if src_sr == dst_sr:
        return x
    duration = len(x) / src_sr
    src_t = np.linspace(0.0, duration, len(x), endpoint=False)
    dst_n = int(duration * dst_sr)
    dst_t = np.linspace(0.0, duration, dst_n, endpoint=False)
    return np.interp(dst_t, src_t, x).astype(np.float32)


def modulate_am(baseband: np.ndarray, carrier_hz: float, sample_rate: int, depth: float) -> np.ndarray:
    t = np.arange(len(baseband), dtype=np.float32) / sample_rate
    envelope = 1.0 + depth * baseband
    carrier = np.sin(2 * np.pi * carrier_hz * t)
    y = envelope * carrier
    peak = np.max(np.abs(y)) if y.size else 1.0
    return (y / max(peak, 1e-6)).astype(np.float32)


def write_wav(path: Path, samples: np.ndarray, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())


def main() -> None:
    parser = argparse.ArgumentParser(description="Play TTS speech modulated onto a selected kHz carrier.")
    parser.add_argument("text", nargs="?", default="Hello from Speechix", help="Text to synthesize")
    parser.add_argument("--khz", type=float, default=17.0, help="Carrier frequency in kHz (default: 17.0)")
    parser.add_argument("--sample-rate", type=int, default=96000, help="Playback sample rate in Hz (default: 96000)")
    parser.add_argument("--amplitude", type=float, default=0.12, help="Output amplitude 0..1 (default: 0.12)")
    parser.add_argument("--depth", type=float, default=0.85, help="AM modulation depth 0..1 (default: 0.85)")
    parser.add_argument("--rate", type=int, default=170, help="TTS speaking rate words/minute (default: 170)")
    parser.add_argument("--output", type=Path, help="Write the modulated audio to a WAV file instead of playing it")
    args = parser.parse_args()

    if sd is None and args.output is None:
        print("Missing dependency: sounddevice. Install with: pip install sounddevice", file=sys.stderr)
        sys.exit(2)

    if not (0.0 < args.amplitude <= 1.0):
        raise ValueError("--amplitude must be in (0, 1]")
    if not (0.0 <= args.depth <= 1.0):
        raise ValueError("--depth must be in [0, 1]")

    carrier_hz = args.khz * 1000.0
    nyquist = args.sample_rate / 2
    if carrier_hz >= nyquist - 4000:
        raise ValueError("Carrier too high for sample rate; keep several kHz below Nyquist.")

    speech, speech_sr = synthesize_tts_to_array(args.text, args.rate)
    speech_rs = resample_linear(speech, speech_sr, args.sample_rate)
    modulated = modulate_am(speech_rs, carrier_hz, args.sample_rate, args.depth) * args.amplitude

    if args.output is not None:
        write_wav(args.output, modulated, args.sample_rate)
        print(f"Wrote AM-modulated TTS to {args.output}")
        return

    print("Warning: high-frequency playback can be uncomfortable. Start at low volume.", flush=True)
    print(f"Playing AM-modulated TTS at {args.khz:.2f} kHz carrier.", flush=True)
    try:
        sd.play(modulated, samplerate=args.sample_rate, blocking=True)
        sd.stop()
    except sd.PortAudioError as exc:
        fallback_path = Path("speechix-output.wav")
        write_wav(fallback_path, modulated, args.sample_rate)
        print(f"Audio playback failed ({exc}). Wrote output to {fallback_path} instead.", file=sys.stderr)


if __name__ == "__main__":
    main()
