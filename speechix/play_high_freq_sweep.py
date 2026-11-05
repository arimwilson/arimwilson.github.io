#!/usr/bin/env python3
"""Play pure tones from 10 kHz to 19 kHz in 1 kHz steps for 10 seconds each.

Requirements:
  pip install numpy sounddevice
"""

import argparse
import sys
import time

import numpy as np

try:
    import sounddevice as sd
except ImportError:
    sd = None


def play_tone(frequency_hz: int, duration_s: float, sample_rate: int, amplitude: float) -> None:
    t = np.linspace(0, duration_s, int(sample_rate * duration_s), endpoint=False)
    waveform = amplitude * np.sin(2 * np.pi * frequency_hz * t)

    # 10 ms fade in/out to reduce clicks
    fade_samples = max(1, int(0.01 * sample_rate))
    fade_in = np.linspace(0.0, 1.0, fade_samples)
    fade_out = np.linspace(1.0, 0.0, fade_samples)
    waveform[:fade_samples] *= fade_in
    waveform[-fade_samples:] *= fade_out

    if sd is None:
        raise RuntimeError("sounddevice is not installed")
    sd.play(waveform.astype(np.float32), samplerate=sample_rate, blocking=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Play tones from 10 kHz to 19 kHz in 1 kHz steps for 10 seconds each."
    )
    parser.add_argument("--start-khz", type=int, default=10, help="Start frequency in kHz (default: 10)")
    parser.add_argument("--end-khz", type=int, default=19, help="End frequency in kHz inclusive (default: 19)")
    parser.add_argument("--step-khz", type=int, default=1, help="Step in kHz (default: 1)")
    parser.add_argument("--duration", type=float, default=10.0, help="Duration per tone in seconds (default: 10)")
    parser.add_argument("--sample-rate", type=int, default=48000, help="Sample rate in Hz (default: 48000)")
    parser.add_argument("--amplitude", type=float, default=0.15, help="Amplitude 0.0-1.0 (default: 0.15)")
    args = parser.parse_args()

    if sd is None:
        print("Missing dependency: sounddevice. Install with: pip install sounddevice", file=sys.stderr)
        print("Tip: If pip install fails, install PortAudio first (e.g., brew install portaudio).", file=sys.stderr)
        sys.exit(2)

    if args.start_khz <= 0 or args.end_khz <= 0 or args.step_khz <= 0:
        raise ValueError("start/end/step must be positive")
    if args.start_khz > args.end_khz:
        raise ValueError("start-khz must be <= end-khz")
    if not 0.0 < args.amplitude <= 1.0:
        raise ValueError("amplitude must be in (0, 1]")

    nyquist = args.sample_rate / 2
    max_freq_hz = args.end_khz * 1000
    if max_freq_hz >= nyquist:
        raise ValueError(
            f"Highest tone ({max_freq_hz} Hz) must be less than Nyquist ({nyquist:.0f} Hz). "
            "Increase --sample-rate."
        )

    print("Warning: high-frequency tones can be uncomfortable. Start at low volume.")
    print(
        f"Playing tones from {args.start_khz} kHz to {args.end_khz} kHz "
        f"in {args.step_khz} kHz steps, {args.duration:.1f}s each."
    )

    try:
        for khz in range(args.start_khz, args.end_khz + 1, args.step_khz):
            freq_hz = khz * 1000
            print(f"[{time.strftime('%H:%M:%S')}] Playing {khz} kHz ({freq_hz} Hz)...")
            play_tone(freq_hz, args.duration, args.sample_rate, args.amplitude)
    except KeyboardInterrupt:
        print("\nStopped by user.")
    finally:
        if sd is not None:
            sd.stop()


if __name__ == "__main__":
    main()
