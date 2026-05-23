# Speechix Plan: Teen-Only High-Frequency Audio Communication

## 1) Feasibility Summary

Short answer: **partially feasible for alerts/short codes, not reliably feasible for full speech**.

- Many teens can hear tones in roughly **16–19 kHz**; many adults lose sensitivity above ~14–16 kHz.
- There is **major overlap**: some adults still hear these frequencies, and some teens do not.
- Speech content encoded directly at very high frequencies is hard to reproduce and decode robustly on consumer speakers/microphones.
- Environmental noise, room acoustics, and phone/laptop audio hardware strongly limit reliability.

Conclusion: use this as a **best-effort selective channel**, not a guaranteed “teens only” private channel.

---

## 2) Safety, Ethics, and Legal Guardrails

Before building:

1. **Consent-first deployment**: all users should know ultrasonic/high-frequency audio is present.
2. **No covert tracking or hidden messaging** in public spaces.
3. **Volume limits**: enforce conservative SPL targets to reduce discomfort risk.
4. **Regional compliance check**: verify local school/workplace/public-audio rules.
5. **Accessibility fallback**: always provide a normal-audio or visual equivalent.

---

## 3) System Goal Definition

Define the target up front:

- **Primary use case**: short messages (IDs, prompts, simple command tokens), not long-form conversation.
- **Range**: e.g., 1–5 meters line-of-sight indoors.
- **Payload**: e.g., 20–200 bits per message.
- **Latency target**: e.g., < 2 seconds end-to-end.
- **Reliability target**: e.g., >95% packet success in controlled room.

---

## 4) Recommended Technical Approach

### 4.1 Frequency Band Selection

- Start with **17.2–18.8 kHz** pilot band.
- Keep guard bands (e.g., 200–300 Hz margins) around occupied tones.
- Run calibration tones and measure per-device response before live messaging.

### 4.2 Modulation Strategy

For a first implementation:

- Use **MFSK** (multi-frequency shift keying) or narrowband **OFDM-like bins**.
- Add:
  - **Preamble** (sync)
  - **CRC** (error detection)
  - **FEC** (e.g., simple Reed-Solomon or convolutional coding)
- Use short framed packets rather than continuous stream speech.

Why: robust message transport in noisy/highly attenuated high-frequency channels.

### 4.3 “Speech Communication” Layer

If the requirement is speech-level communication:

- Do **speech-to-text (STT)** on sender.
- Transmit compact text/token packets over high-frequency channel.
- Do **text-to-speech (TTS)** or text display on receiver.

This is much more feasible than trying to transmit wideband analog speech directly at near-ultrasonic frequencies.

---

## 5) Prototype Build Plan

## Phase A — Hearing & Hardware Baseline (1–2 weeks)

1. Build hearing-test module (sweeps 14–20 kHz, safe levels).
2. Collect anonymous pilot data by age band.
3. Benchmark speakers/mics across target devices.
4. Produce “supported device matrix”.

Deliverable: feasibility report with expected teen/adult separability.

## Phase B — Link Layer MVP (2–3 weeks)

1. Implement encoder/decoder for framed MFSK packets.
2. Add AGC, band-pass filters, and clock recovery.
3. Add FEC + CRC + retransmit logic.
4. Test packet delivery across distance and angles.

Deliverable: reliable short-message ultrasonic modem prototype.

## Phase C — Speechix Application Layer (2 weeks)

1. Add STT input path.
2. Packetize compressed text/tokens.
3. Add receiver-side TTS and optional captions.
4. Implement pairing/session keys (if privacy needed).

Deliverable: speech-like messaging experience over high-frequency channel.

## Phase D — Validation & Safeguards (1–2 weeks)

1. Teen vs adult detectability study.
2. Disturbance/discomfort survey.
3. Fail-safe fallback to visual/normal-audio channel.
4. Document boundaries: when channel should auto-disable.

Deliverable: go/no-go decision for broader deployment.

---

## 6) Measurement Protocol

Track these KPIs:

- Packet error rate (PER)
- Bit error rate (BER)
- Time to decode
- Detection probability by age cohort
- False-audibility rate in adults
- User comfort score

Test environments:

- Quiet room
- Classroom-like noise
- Hallway/reverberant space
- Outdoor short-range

---

## 7) Key Risks and Mitigations

1. **Not truly age-exclusive**
   - Mitigation: label as probabilistic audience targeting only.
2. **Device inconsistency**
   - Mitigation: per-device calibration + compatibility allowlist.
3. **Low speech throughput**
   - Mitigation: text/token transport instead of raw speech audio.
4. **Audible artifacts (aliasing/intermodulation)**
   - Mitigation: filtering, conservative levels, harmonic checks.
5. **Potential misuse concerns**
   - Mitigation: transparency, consent, and policy controls.

---

## 8) Practical Go/No-Go Criteria

Proceed only if pilot shows all:

- Adult audibility below defined threshold (e.g., <15% in target settings)
- Teen decode success above threshold (e.g., >90%)
- No significant discomfort reports
- Stable operation across at least N supported devices

Otherwise pivot to mixed-mode communication (visual + normal audio).

---

## 9) Bottom Line

- **Feasible** for short, coded, high-frequency messaging with careful engineering.
- **Not reliably feasible** as a universal “teens hear / adults cannot” speech channel.
- Best architecture for “speech communication” is **STT → high-frequency data packets → TTS/text**.
