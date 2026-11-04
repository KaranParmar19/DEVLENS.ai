import wave
import struct
import math
import os

# Synthesize a 20-second 44.1kHz 16-bit stereo master soundtrack for DevLens launch video.
SAMPLE_RATE = 44100
DURATION = 20.0
NUM_SAMPLES = int(SAMPLE_RATE * DURATION)
BPM = 108.0
BEAT_DUR = 60.0 / BPM  # ~0.5555 seconds

left_channel = [0.0] * NUM_SAMPLES
right_channel = [0.0] * NUM_SAMPLES

def clamp(v, low=-1.0, high=1.0):
    return max(low, min(high, v))

def add_sample(idx, l_val, r_val):
    if 0 <= idx < NUM_SAMPLES:
        left_channel[idx] += l_val
        right_channel[idx] += r_val

def note_freq(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))

# 1. BASSLINE & CHORD PROGRESSION (Warm analog synthesis)
# Chords: Fm9 -> Dbmaj7 -> Bbm9 -> Eb9/C -> Fm
CHORDS = [
    # (start_time, end_time, [root, 3rd, 5th, 7th, 9th])
    (0.0, 4.44, [41, 53, 56, 60, 63, 67]),   # F1, F2, Ab2, C3, Eb3, G3 (Fm9)
    (4.44, 8.88, [37, 49, 56, 60, 65]),     # Db1, Db2, Ab2, C3, F3 (Dbmaj7)
    (8.88, 13.33, [34, 46, 53, 58, 61, 65]), # Bb0, Bb1, F2, Bb2, Db3, F3 (Bbm9)
    (13.33, 17.5, [36, 48, 55, 58, 64]),    # C1, C2, G2, Bb2, E3 (C7#9)
    (17.5, 20.0, [29, 41, 53, 60, 65, 68])   # Sub F0, F1, F2, C3, F3, Ab3 (Fm resolve)
]

for start_t, end_t, notes in CHORDS:
    start_idx = int(start_t * SAMPLE_RATE)
    end_idx = min(NUM_SAMPLES, int(end_t * SAMPLE_RATE))
    dur = end_t - start_t
    
    for i in range(start_idx, end_idx):
        t = (i - start_idx) / SAMPLE_RATE
        fade_in = min(1.0, t / 0.4)
        fade_out = min(1.0, (dur - t) / 0.5)
        env = fade_in * fade_out * 0.18

        sub_val = 0.0
        # Warm detuned synth pad
        for n_idx, m in enumerate(notes):
            f = note_freq(m)
            # slight analog chorus / detune
            detune = 1.0 + 0.0018 * ((n_idx % 3) - 1)
            vol = 0.22 if m < 45 else 0.12  # boost low bass
            v = math.sin(2.0 * math.pi * f * detune * t)
            # Add soft 2nd harmonic for warmth
            v += 0.3 * math.sin(2.0 * math.pi * f * 2.0 * detune * t)
            sub_val += v * vol

        pan = math.sin(t * 1.5) * 0.15
        left_channel[i] += sub_val * env * (1.0 - pan)
        right_channel[i] += sub_val * env * (1.0 + pan)

# 2. RHYTHMIC KICK & TICK PULSE (Subtle 108 BPM heartbeat)
for beat_num in range(int(DURATION / BEAT_DUR)):
    beat_t = beat_num * BEAT_DUR
    if 2.5 <= beat_t < 17.5:
        b_idx = int(beat_t * SAMPLE_RATE)
        # Deep soft kick drum (60Hz down to 30Hz)
        kick_samples = int(0.18 * SAMPLE_RATE)
        for k in range(kick_samples):
            kt = k / SAMPLE_RATE
            k_env = (1.0 - kt / 0.18) ** 2.5
            k_freq = 65.0 * math.exp(-kt * 22.0) + 32.0
            k_val = math.sin(2.0 * math.pi * k_freq * kt) * k_env * 0.32
            add_sample(b_idx + k, k_val, k_val)

        # Subtle hi-hat / metallic tick on off-beats
        tick_idx = b_idx + int(BEAT_DUR * 0.5 * SAMPLE_RATE)
        tick_samples = int(0.04 * SAMPLE_RATE)
        for tk in range(tick_samples):
            tkt = tk / SAMPLE_RATE
            tk_env = (1.0 - tkt / 0.04) ** 3.0
            # High frequency noise-like tick
            tk_val = (math.sin(2.0 * math.pi * 7200 * tkt) + math.sin(2.0 * math.pi * 9800 * tkt)) * tk_env * 0.06
            add_sample(tick_idx + tk, tk_val * 0.8, tk_val * 1.2)

# 3. SOUND EFFECT: URL Typing Keystrokes (0.6s - 2.2s)
keystroke_times = [0.65, 0.78, 0.90, 1.05, 1.15, 1.28, 1.40, 1.55, 1.68, 1.80, 1.95, 2.08]
for kt in keystroke_times:
    k_start = int(kt * SAMPLE_RATE)
    k_len = int(0.025 * SAMPLE_RATE)
    for s in range(k_len):
        st = s / SAMPLE_RATE
        k_env = (1.0 - st / 0.025) ** 4.0
        # Tactile mechanical click (transient pop + resonance)
        click = (math.sin(2.0 * math.pi * 2800 * st) * 0.6 + math.sin(2.0 * math.pi * 1200 * st) * 0.4) * k_env * 0.16
        add_sample(k_start + s, click, click * 0.9)

# 4. SOUND EFFECT: Input Morph & Graph Node Burst (2.8s - 3.8s)
m_start = int(2.8 * SAMPLE_RATE)
m_len = int(1.2 * SAMPLE_RATE)
for s in range(m_len):
    st = s / SAMPLE_RATE
    m_env = math.sin(math.pi * st / 1.2) * 0.24
    # Harmonic frequency sweep rising into graph expansion
    freq = 320.0 + 880.0 * (st ** 1.8)
    sweep = math.sin(2.0 * math.pi * freq * st) * m_env
    # Glass chime ping at 3.5s
    if st >= 0.7:
        c_t = st - 0.7
        chime_env = math.exp(-c_t * 6.0) * 0.28
        chime = (math.sin(2.0 * math.pi * 1760.0 * c_t) + math.sin(2.0 * math.pi * 2640.0 * c_t) * 0.5) * chime_env
        sweep += chime
    add_sample(m_start + s, sweep * 1.1, sweep * 0.9)

# 5. SOUND EFFECT: Luminous Thread Gliding Across Graph (5.2s - 6.4s)
g_start = int(5.2 * SAMPLE_RATE)
g_len = int(1.2 * SAMPLE_RATE)
for s in range(g_len):
    st = s / SAMPLE_RATE
    g_env = math.sin(math.pi * st / 1.2) * 0.15
    pulse = math.sin(2.0 * math.pi * 880.0 * st + math.sin(2.0 * math.pi * 14.0 * st) * 3.0) * g_env
    # stereo panning movement across speakers
    pan = st / 1.2
    add_sample(g_start + s, pulse * (1.0 - pan) * 1.4, pulse * pan * 1.4)

# 6. SOUND EFFECT: Blast Radius Impact (8.5s - 10.5s)
# Sub-bass heavy thud with warning pulse
b_start = int(8.5 * SAMPLE_RATE)
b_len = int(2.0 * SAMPLE_RATE)
for s in range(b_len):
    st = s / SAMPLE_RATE
    # Impact transient
    thud_env = math.exp(-st * 3.2) * 0.45
    thud = math.sin(2.0 * math.pi * (82.0 * math.exp(-st * 2.5)) * st) * thud_env
    # Amber alert sonar pulse (520Hz modulated)
    sonar_env = math.exp(-((st - 0.25) ** 2) / 0.08) * 0.18 if st >= 0.1 else 0.0
    sonar = math.sin(2.0 * math.pi * 587.33 * st) * sonar_env
    add_sample(b_start + s, thud + sonar, thud + sonar * 0.95)

# 7. SOUND EFFECT: AST Line Citation Lock (13.6s - 15.2s)
c_start = int(13.6 * SAMPLE_RATE)
c_len = int(1.4 * SAMPLE_RATE)
for s in range(c_len):
    st = s / SAMPLE_RATE
    # Crisp lock click
    lock_env = math.exp(-st * 12.0) * 0.35
    lock = math.sin(2.0 * math.pi * 2200.0 * st) * lock_env
    # Verification confirmation shimmer (F#6 / A6)
    shim_env = math.exp(-st * 4.0) * 0.22
    shim = (math.sin(2.0 * math.pi * 1480.0 * st) + math.sin(2.0 * math.pi * 2220.0 * st) * 0.5) * shim_env
    add_sample(c_start + s, lock + shim, lock + shim * 1.05)

# 8. SOUND EFFECT: Final DEVLENS Wordmark Resolution Chord (17.4s - 20.0s)
f_start = int(17.4 * SAMPLE_RATE)
f_len = int(2.6 * SAMPLE_RATE)
for s in range(f_len):
    st = s / SAMPLE_RATE
    f_env = min(1.0, st / 0.3) * math.exp(-st * 0.8) * 0.38
    # Rich orchestral electronic swell
    chord = (
        math.sin(2.0 * math.pi * 174.61 * st) * 0.35 +   # F3
        math.sin(2.0 * math.pi * 261.63 * st) * 0.25 +   # C4
        math.sin(2.0 * math.pi * 349.23 * st) * 0.22 +   # F4
        math.sin(2.0 * math.pi * 440.00 * st) * 0.18 +   # A4
        math.sin(2.0 * math.pi * 523.25 * st) * 0.14     # C5
    ) * f_env
    add_sample(f_start + s, chord, chord)

# Master Limiter & Normalization
max_peak = 0.0001
for i in range(NUM_SAMPLES):
    max_peak = max(max_peak, abs(left_channel[i]), abs(right_channel[i]))

target_peak = 0.92  # -0.7 dBTP
norm_gain = target_peak / max_peak

out_dir = os.path.join("launch-video", "assets", "audio")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "soundtrack.wav")

with wave.open(out_path, "w") as wav_file:
    wav_file.setnchannels(2)
    wav_file.setsampwidth(2)
    wav_file.setframerate(SAMPLE_RATE)
    
    frames = bytearray()
    for i in range(NUM_SAMPLES):
        l_int = int(clamp(left_channel[i] * norm_gain) * 32767.0)
        r_int = int(clamp(right_channel[i] * norm_gain) * 32767.0)
        frames.extend(struct.pack("<hh", l_int, r_int))
    wav_file.writeframes(frames)

print(f"Generated soundtrack: {out_path} ({DURATION}s, peak: {max_peak:.2f} -> normalized to {target_peak:.2f})")
