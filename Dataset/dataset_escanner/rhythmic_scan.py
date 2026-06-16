import json

# ============================================================
# CONFIG
# ============================================================

INPUT_JSON = "descriptors/rhythmic_descriptors.json"
OUTPUT_TXT = "rhythmic_analysis.txt"

# ============================================================
# LOAD DATA
# ============================================================

with open(INPUT_JSON, "r", encoding="utf-8") as f:
    data = json.load(f)

# ============================================================
# BPM CATEGORIES
# ============================================================

categories = {
    "Very Slow (<60 BPM)": [],
    "Slow (60-90 BPM)": [],
    "Medium (90-120 BPM)": [],
    "Fast (120-150 BPM)": [],
    "Very Fast (>150 BPM)": []
}

all_bpms = []

# ============================================================
# CLASSIFICATION
# ============================================================

for audio_id, song in data.items():

    bpm = song.get("bpm", 0)

    all_bpms.append((audio_id, bpm))

    if bpm < 60:
        categories["Very Slow (<60 BPM)"].append(audio_id)

    elif bpm < 90:
        categories["Slow (60-90 BPM)"].append(audio_id)

    elif bpm < 120:
        categories["Medium (90-120 BPM)"].append(audio_id)

    elif bpm < 150:
        categories["Fast (120-150 BPM)"].append(audio_id)

    else:
        categories["Very Fast (>150 BPM)"].append(audio_id)

# ============================================================
# SORT BPMS
# ============================================================

fastest = sorted(
    all_bpms,
    key=lambda x: x[1],
    reverse=True
)[:3]

slowest = sorted(
    all_bpms,
    key=lambda x: x[1]
)[:3]

# ============================================================
# REPORT
# ============================================================

report = []

report.append("=" * 60)
report.append("BPM ANALYSIS")
report.append("=" * 60)

report.append("\nBPM RANGES\n")

for category, audios in categories.items():
    report.append(f"{category}: {len(audios)} audios")

report.append("\nTOP 3 FASTEST AUDIOS\n")

for i, (audio_id, bpm) in enumerate(fastest, 1):
    report.append(
        f"{i}. {audio_id} | BPM: {bpm:.2f}"
    )

report.append("\nTOP 3 SLOWEST AUDIOS\n")

for i, (audio_id, bpm) in enumerate(slowest, 1):
    report.append(
        f"{i}. {audio_id} | BPM: {bpm:.2f}"
    )

report.append("\n")

final_report = "\n".join(report)

# ============================================================
# PRINT
# ============================================================

print(final_report)

# ============================================================
# SAVE TXT
# ============================================================

with open(OUTPUT_TXT, "w", encoding="utf-8") as f:
    f.write(final_report)

print(f"\nAnalysis saved to: {OUTPUT_TXT}")