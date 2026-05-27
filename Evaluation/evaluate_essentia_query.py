"""
Evaluador de calidad de queries generadas por Essentia (frontend).

Simula el mismo pipeline que audioAnalysisService.ts:
  audio → descriptores (librosa) → labels → query de texto

Luego mide coherencia entre la query generada y los metadatos
conocidos del dataset (BPM, tags, descripción).

Uso:
    python Evaluation/evaluate_essentia_query.py
    python Evaluation/evaluate_essentia_query.py --focus bpm
    python Evaluation/evaluate_essentia_query.py --focus melodic --limit 20
    python Evaluation/evaluate_essentia_query.py --focus all --output Evaluation/essentia_query_report.json
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np

ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_METADATA_PATH = ROOT_DIR / "Dataset" / "Clean_csv" / "metadata.csv"
DATASET_AUDIO_DIR = ROOT_DIR / "Dataset" / "audio_processed"
OUTPUT_DIR = ROOT_DIR / "Evaluation"

SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".aiff", ".aif"}

FOCUSES = ["general", "melodic", "bpm", "timbre"]


# ──────────────────────────────────────────────
# Audio loading (no librosa dep needed, use soundfile)
# ──────────────────────────────────────────────

def _read_audio_mono(path: Path) -> tuple[np.ndarray, int]:
    try:
        import soundfile as sf
        audio, sr = sf.read(str(path), always_2d=True, dtype="float32")
        return np.mean(audio, axis=1).astype(np.float32), int(sr)
    except Exception as exc:
        raise RuntimeError(f"Cannot read {path}: {exc}") from exc


# ──────────────────────────────────────────────
# Descriptor extraction (mirrors audioAnalysisService.ts fallback logic)
# ──────────────────────────────────────────────

def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


@dataclass
class Descriptors:
    rms: float
    energy_label: str          # quiet / balanced / loud
    spectral_centroid: float
    brightness_label: str      # dark / balanced / bright
    timbre_label: str          # clean / noisy / bright / dark / textured
    spectral_flatness: float
    zcr: float
    bpm: float | None
    bpm_confidence: float
    rhythm_label: str          # one-shot / percussive / loop-like / sustained
    percussive_score: float
    estimated_pitch: float | None
    pitch_confidence: float
    tonal_score: float
    melodic_label: str         # melodic / tonal / textured / noisy
    pitch_range_label: str     # low / mid / high / --
    duration: float


def extract_descriptors(audio: np.ndarray, sr: int, duration: float) -> Descriptors:
    if audio.size == 0:
        audio = np.zeros(sr, dtype=np.float32)

    # ── energy ──
    rms = float(np.sqrt(np.mean(audio ** 2)))
    energy_label = "quiet" if rms < 0.04 else ("loud" if rms > 0.16 else "balanced")

    # ── spectral (simple DFT over first 2048 samples) ──
    frame_size = min(2048, audio.size)
    window = np.hanning(frame_size).astype(np.float32)
    frame = audio[:frame_size] * window
    spectrum = np.abs(np.fft.rfft(frame)).astype(np.float32)
    freqs = np.fft.rfftfreq(frame_size, d=1.0 / sr).astype(np.float32)
    total = float(np.sum(spectrum)) + 1e-9
    centroid = float(np.sum(spectrum * freqs) / total)

    # flatness
    log_mean = float(np.mean(np.log(np.maximum(spectrum, 1e-9))))
    arith_mean = float(np.mean(spectrum)) + 1e-9
    flatness = float(_clamp(math.exp(log_mean) / arith_mean, 0.0, 1.0))

    # zcr
    zcr = float(np.mean(np.abs(np.diff(np.signbit(audio)))))

    brightness_label = "dark" if centroid < 900 else ("bright" if centroid > 2600 else "balanced")

    if flatness > 0.55 or zcr > 0.14:
        timbre_label = "noisy"
    elif centroid > 3200:
        timbre_label = "bright"
    elif centroid < 700:
        timbre_label = "dark"
    elif flatness > 0.34:
        timbre_label = "textured"
    else:
        timbre_label = "clean"

    # ── rhythm ──
    frame_sz = 1024
    hop_sz = 512
    envelope = []
    for start in range(0, audio.size - frame_sz, hop_sz):
        seg = audio[start: start + frame_sz]
        envelope.append(float(np.mean(seg ** 2)))

    bpm: float | None = None
    bpm_confidence = 0.0
    percussive_score = 0.0
    onset_rate = 0.0

    if len(envelope) >= 12:
        env_arr = np.array(envelope, dtype=np.float32)
        avg = float(np.mean(env_arr))
        flux = np.maximum(0.0, np.diff(env_arr))
        onsets = int(np.sum(flux > avg * 0.7))
        total_flux = float(np.sum(flux))
        onset_rate = onsets / max(duration, 0.001)
        percussive_score = float(_clamp(total_flux / max(rms * len(flux), 1e-4), 0.0, 1.0))

        flux_rate = sr / hop_sz
        min_lag = max(1, int((60.0 / 180.0) * flux_rate))
        max_lag = min(len(flux) - 1, int((60.0 / 60.0) * flux_rate))
        if min_lag < max_lag:
            best_lag, best_score, total_score = 0, 0.0, 0.0
            for lag in range(min_lag, max_lag + 1):
                score = float(np.dot(flux[lag:], flux[:-lag]))
                total_score += score
                if score > best_score:
                    best_score, best_lag = score, lag
            if best_lag > 0 and best_score > 0:
                bpm = float(_clamp((60.0 * flux_rate) / best_lag, 60.0, 180.0))
                bpm_confidence = float(_clamp(best_score / max(total_score, 1e-8), 0.0, 1.0))

    if duration < 1.3:
        rhythm_label = "one-shot"
    elif percussive_score > 0.55 or onset_rate > 2.8:
        rhythm_label = "percussive"
    elif onset_rate > 1.2:
        rhythm_label = "loop-like"
    else:
        rhythm_label = "sustained"

    # ── pitch (autocorrelation) ──
    length = min(audio.size, int(sr * 0.7))
    estimated_pitch: float | None = None
    pitch_confidence = 0.0

    if length >= sr * 0.05:
        seg = audio[:length]
        min_lag_p = max(1, int(sr / 1000))
        max_lag_p = min(int(sr / 80), length - 1)
        zero_lag = float(np.dot(seg, seg))
        if zero_lag > 1e-8:
            best_lag_p, best_corr = 0, 0.0
            for lag in range(min_lag_p, max_lag_p + 1):
                c = float(np.dot(seg[:-lag], seg[lag:])) / zero_lag
                if c > best_corr:
                    best_corr, best_lag_p = c, lag
            if best_lag_p > 0:
                estimated_pitch = float(sr / best_lag_p)
                pitch_confidence = float(_clamp(best_corr, 0.0, 1.0))

    tonal_score = float(_clamp(pitch_confidence * 0.72 + (1.0 - zcr * 18.0) * 0.28, 0.0, 1.0))

    if tonal_score > 0.68 and pitch_confidence > 0.38:
        melodic_label = "melodic"
    elif tonal_score > 0.48:
        melodic_label = "tonal"
    elif zcr > 0.16:
        melodic_label = "noisy"
    else:
        melodic_label = "textured"

    if estimated_pitch is None:
        pitch_range_label = "--"
    elif estimated_pitch < 160:
        pitch_range_label = "low"
    elif estimated_pitch < 500:
        pitch_range_label = "mid"
    else:
        pitch_range_label = "high"

    return Descriptors(
        rms=rms,
        energy_label=energy_label,
        spectral_centroid=centroid,
        brightness_label=brightness_label,
        timbre_label=timbre_label,
        spectral_flatness=flatness,
        zcr=zcr,
        bpm=bpm,
        bpm_confidence=bpm_confidence,
        rhythm_label=rhythm_label,
        percussive_score=percussive_score,
        estimated_pitch=estimated_pitch,
        pitch_confidence=pitch_confidence,
        tonal_score=tonal_score,
        melodic_label=melodic_label,
        pitch_range_label=pitch_range_label,
        duration=duration,
    )


# ──────────────────────────────────────────────
# Query generation (mirrors createEssentiaQuery in audioAnalysisService.ts)
# ──────────────────────────────────────────────

def create_query(d: Descriptors, focus: str) -> str:
    if focus == "melodic":
        if d.melodic_label == "melodic":
            if d.pitch_range_label == "low":
                return "bass melody instrument loop"
            if d.pitch_range_label == "high":
                return "lead melody synth high pitched"
            return "melodic instrument loop tonal"
        if d.melodic_label == "tonal":
            if d.estimated_pitch and d.estimated_pitch < 200:
                return "bass note instrument low"
            if d.estimated_pitch and d.estimated_pitch > 600:
                return "high pitched note tonal synth"
            return "tonal note instrument single"
        if d.melodic_label == "noisy":
            return "atonal noise texture harsh"
        return "pad texture drone sustained"

    if focus == "bpm":
        if d.bpm:
            rounded = round(d.bpm / 5) * 5
            if d.percussive_score > 0.5:
                return f"{rounded} bpm drum loop percussion"
            return f"{rounded} bpm rhythm loop"
        if d.rhythm_label == "one-shot":
            return "one shot percussion hit transient"
        if d.rhythm_label == "percussive":
            return "percussion drum hit rhythmic"
        if d.rhythm_label == "loop-like":
            return "rhythm loop beat pattern"
        return "rhythm groove loop"

    if focus == "timbre":
        if d.timbre_label == "bright":
            return "bright crisp high frequency shimmer"
        if d.timbre_label == "dark":
            return "dark muted low frequency warm"
        if d.timbre_label == "noisy":
            return "noise texture rough gritty"
        if d.timbre_label == "textured":
            return "textured granular complex timbre"
        if d.brightness_label == "bright":
            return "clean bright tone sample"
        if d.brightness_label == "dark":
            return "clean dark warm tone"
        return "clean pure tone sample"

    # general — dominant-dimension routing, mirrors the new TS implementation
    rhythmLabel    = d.rhythm_label
    melodicLabel   = d.melodic_label
    timbreLabel    = d.timbre_label
    brightnessLabel = d.brightness_label
    energyLabel    = d.energy_label
    percussive     = d.percussive_score
    pitchRange     = d.pitch_range_label
    bpm_val        = d.bpm

    # 1. Percussive / one-shot
    if rhythmLabel == "one-shot" or (rhythmLabel == "percussive" and percussive > 0.6):
        if energyLabel == "loud":           return "loud percussion hit one shot"
        if timbreLabel == "bright":         return "bright crisp percussion hit"
        if timbreLabel == "dark":           return "dark heavy drum hit"
        return "percussion hit one shot"

    # 2. Has BPM + rhythm loop
    if bpm_val and rhythmLabel != "sustained":
        rounded = round(bpm_val / 5) * 5
        if timbreLabel == "bright":         return f"bright {rounded} bpm drum loop"
        if timbreLabel == "dark":           return f"dark {rounded} bpm groove loop"
        if timbreLabel == "noisy":          return f"{rounded} bpm noisy beat loop"
        if melodicLabel in ("melodic", "tonal"): return f"{rounded} bpm melodic loop"
        return f"{rounded} bpm rhythm loop"

    # 3. Melodic / tonal
    if melodicLabel in ("melodic", "tonal"):
        tonal = melodicLabel == "melodic"
        if pitchRange == "low":   return "bass melody instrument low" if tonal else "bass tonal note low"
        if pitchRange == "high":  return "lead melody synth high pitched" if tonal else "high tonal note synth"
        if timbreLabel == "bright": return "bright melodic instrument tonal"
        if timbreLabel == "dark":   return "dark warm melodic pad"
        return "melodic instrument loop tonal" if tonal else "tonal note instrument pad"

    # 4. Sustained texture
    if rhythmLabel == "sustained":
        if timbreLabel == "noisy":  return "noise texture drone sustained"
        if timbreLabel == "bright": return "bright sustained pad texture"
        if timbreLabel == "dark":   return "dark warm drone sustained"
        if energyLabel == "loud":   return "loud sustained texture layer"
        return "ambient pad texture sustained"

    # 5. Noisy / atonal
    if timbreLabel == "noisy" or melodicLabel == "noisy":
        if energyLabel == "loud":   return "loud noise texture harsh"
        return "noise texture atonal fx"

    # 6. Fallback — brightness + energy, still natural phrases
    if brightnessLabel == "bright": return "bright clean tone sample"
    if brightnessLabel == "dark":   return "dark warm tone sample"
    if energyLabel == "loud":       return "energetic loud sound sample"
    if energyLabel == "quiet":      return "soft quiet texture sample"
    return "sound texture sample"


# ──────────────────────────────────────────────
# Coherence scoring
# ──────────────────────────────────────────────

def _safe_float(v: Any) -> float | None:
    if v in (None, "", "None"):
        return None
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def score_bpm_coherence(d: Descriptors, meta_bpm: float | None) -> dict[str, Any]:
    """Check if the estimated BPM is close to the metadata BPM."""
    if meta_bpm is None:
        return {"has_meta_bpm": False}
    if d.bpm is None:
        return {"has_meta_bpm": True, "estimated_bpm": None, "meta_bpm": meta_bpm,
                "abs_diff": None, "within_5bpm": False, "within_10bpm": False}
    diff = min(
        abs(d.bpm - meta_bpm),
        abs(d.bpm - meta_bpm * 2.0),
        abs(d.bpm - meta_bpm * 0.5),
    )
    return {
        "has_meta_bpm": True,
        "estimated_bpm": round(d.bpm, 1),
        "meta_bpm": meta_bpm,
        "abs_diff": round(diff, 1),
        "within_5bpm": diff <= 5.0,
        "within_10bpm": diff <= 10.0,
    }


def score_melodic_coherence(d: Descriptors, tags: list[str], description: str) -> dict[str, Any]:
    """Check if melodic label aligns with known tags/description."""
    melodic_keywords = {"melody", "melodic", "tonal", "pitched", "chord",
                        "harmonic", "note", "piano", "guitar", "synth", "bass", "vocal"}
    noisy_keywords = {"noise", "noisy", "texture", "atonal", "percussion",
                      "drum", "beat", "hit", "fx", "effect"}

    all_text = " ".join(tags).lower() + " " + description.lower()
    has_melodic_ref = any(kw in all_text for kw in melodic_keywords)
    has_noisy_ref = any(kw in all_text for kw in noisy_keywords)

    predicted_tonal = d.melodic_label in ("melodic", "tonal")
    meta_tonal = has_melodic_ref and not has_noisy_ref

    return {
        "melodic_label": d.melodic_label,
        "pitch_range": d.pitch_range_label,
        "tonal_score": round(d.tonal_score, 3),
        "pitch_confidence": round(d.pitch_confidence, 3),
        "meta_has_melodic_keywords": has_melodic_ref,
        "meta_has_noisy_keywords": has_noisy_ref,
        "label_aligns_with_meta": predicted_tonal == meta_tonal,
    }


def score_timbre_coherence(d: Descriptors, tags: list[str], description: str) -> dict[str, Any]:
    """Check if timbre/brightness label aligns with known tags."""
    bright_keywords = {"bright", "crisp", "sharp", "hi", "high", "treble", "shimmer", "sparkle"}
    dark_keywords = {"dark", "deep", "warm", "bass", "low", "mellow", "dull", "sub"}

    all_text = " ".join(tags).lower() + " " + description.lower()
    has_bright = any(kw in all_text for kw in bright_keywords)
    has_dark = any(kw in all_text for kw in dark_keywords)

    return {
        "timbre_label": d.timbre_label,
        "brightness_label": d.brightness_label,
        "meta_has_bright_keywords": has_bright,
        "meta_has_dark_keywords": has_dark,
        "brightness_aligns": (
            (d.brightness_label == "bright" and has_bright) or
            (d.brightness_label == "dark" and has_dark) or
            (d.brightness_label == "balanced" and not has_bright and not has_dark)
        ),
    }


def score_general_coherence(d: Descriptors, query: str, tags: list[str], description: str) -> dict[str, Any]:
    """
    Specific scoring for the 'general' focus.

    Checks three things:
    1. Dimension coverage — how many of the three families (energy, rhythm,
       melody) contributed at least one token to the final query.
    2. Per-dimension alignment — whether each contributing token actually
       matches the metadata (same logic as the individual scorers).
    3. Query degeneracy — whether the query collapsed to the fallback
       'sound texture sample' because all parts were empty.
    """
    q = query.lower()

    # ── 1. Dimension coverage ──
    energy_tokens  = {"energetic", "loud", "soft", "quiet"}
    rhythm_tokens  = {"percussive", "sustained", "bpm"}          # 'bpm' substring covers '120bpm' etc.
    melodic_tokens = {"melodic", "tonal"}
    timbre_tokens  = {"bright", "dark", "noisy"}

    has_energy  = any(t in q for t in energy_tokens)
    has_rhythm  = any(t in q for t in rhythm_tokens) or any(char.isdigit() for char in q)
    has_melodic = any(t in q for t in melodic_tokens)
    has_timbre  = any(t in q for t in timbre_tokens)

    dimensions_covered = sum([has_energy, has_rhythm, has_melodic or has_timbre])
    is_degenerate = q.strip() == "sound texture sample"

    # ── 2. Per-dimension alignment ──
    # energy: does the query energy token match the actual energy label?
    energy_aligned: bool | None = None
    if has_energy:
        if d.energy_label == "loud":
            energy_aligned = "energetic" in q or "loud" in q
        elif d.energy_label == "quiet":
            energy_aligned = "soft" in q or "quiet" in q
        else:
            energy_aligned = not any(t in q for t in {"energetic", "loud", "soft", "quiet"})

    # rhythm: BPM token present when BPM was actually estimated, or rhythm label matches
    rhythm_aligned: bool | None = None
    if d.bpm is not None:
        bpm_token = f"{round(d.bpm / 5) * 5}bpm"
        rhythm_aligned = bpm_token in q.replace(" ", "")
    elif d.rhythm_label in ("percussive", "sustained"):
        rhythm_aligned = d.rhythm_label in q

    # melodic: same logic as score_melodic_coherence
    predicted_tonal = d.melodic_label in ("melodic", "tonal")
    melodic_keywords = {"melody", "melodic", "tonal", "pitched", "chord",
                        "harmonic", "note", "piano", "guitar", "synth", "bass", "vocal"}
    noisy_keywords   = {"noise", "noisy", "texture", "atonal", "percussion",
                        "drum", "beat", "hit", "fx", "effect"}
    all_text = " ".join(tags).lower() + " " + description.lower()
    has_melodic_ref = any(kw in all_text for kw in melodic_keywords)
    has_noisy_ref   = any(kw in all_text for kw in noisy_keywords)
    meta_tonal = has_melodic_ref and not has_noisy_ref
    melodic_aligned = predicted_tonal == meta_tonal

    # timbre: brightness token matches brightness label
    timbre_aligned: bool | None = None
    if has_timbre:
        if d.brightness_label == "bright":
            timbre_aligned = "bright" in q
        elif d.brightness_label == "dark":
            timbre_aligned = "dark" in q

    # ── 3. Composite score (0–1) ──
    # Average of the alignment checks that are not None
    alignment_checks = [
        v for v in [energy_aligned, rhythm_aligned, melodic_aligned, timbre_aligned]
        if v is not None
    ]
    composite = round(float(sum(alignment_checks)) / max(len(alignment_checks), 1), 3)

    return {
        "query": query,
        "is_degenerate": is_degenerate,
        "dimensions_covered": dimensions_covered,   # 0-3
        "has_energy_token": has_energy,
        "has_rhythm_token": has_rhythm,
        "has_melodic_token": has_melodic,
        "has_timbre_token": has_timbre,
        "energy_aligned": energy_aligned,
        "rhythm_aligned": rhythm_aligned,
        "melodic_aligned": melodic_aligned,
        "timbre_aligned": timbre_aligned,
        "composite_alignment": composite,           # 0-1, higher is better
    }


# ──────────────────────────────────────────────
# Dataset loading
# ──────────────────────────────────────────────

def _parse_tags(raw: str) -> list[str]:
    raw = raw.strip()
    if raw.startswith("["):
        try:
            items = json.loads(raw.replace("'", '"'))
            return [str(t).lower() for t in items if t]
        except Exception:
            pass
    return [t.strip().lower() for t in raw.split(",") if t.strip()]


def load_metadata_rows(limit: int | None = None) -> list[dict[str, Any]]:
    if not DATASET_METADATA_PATH.exists():
        raise FileNotFoundError(f"Metadata not found: {DATASET_METADATA_PATH}")

    rows: list[dict[str, Any]] = []
    with DATASET_METADATA_PATH.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            audio_id = str(row.get("id", "")).strip()
            if not audio_id:
                continue

            audio_path: Path | None = None
            for ext in SUPPORTED_AUDIO_EXTENSIONS:
                candidate = DATASET_AUDIO_DIR / f"{audio_id}{ext}"
                if candidate.exists():
                    audio_path = candidate
                    break

            if audio_path is None:
                continue

            rows.append({
                "id": audio_id,
                "name": str(row.get("name", "")),
                "description": str(row.get("description", "")),
                "tags": _parse_tags(str(row.get("tags", ""))),
                "bpm": _safe_float(row.get("bpm")),
                "audio_path": audio_path,
            })

            if limit and len(rows) >= limit:
                break

    return rows


# ──────────────────────────────────────────────
# Per-focus evaluation
# ──────────────────────────────────────────────

@dataclass
class CaseResult:
    audio_id: str
    name: str
    focus: str
    query: str
    bpm_score: dict[str, Any]
    melodic_score: dict[str, Any]
    timbre_score: dict[str, Any]
    general_score: dict[str, Any]
    descriptors_summary: dict[str, Any]
    error: str | None = None


def evaluate_case(row: dict[str, Any], focus: str) -> CaseResult:
    audio_id = row["id"]
    try:
        audio, sr = _read_audio_mono(row["audio_path"])
        duration = len(audio) / sr
        d = extract_descriptors(audio, sr, duration)
        query = create_query(d, focus)

        return CaseResult(
            audio_id=audio_id,
            name=row["name"],
            focus=focus,
            query=query,
            bpm_score=score_bpm_coherence(d, row["bpm"]),
            melodic_score=score_melodic_coherence(d, row["tags"], row["description"]),
            timbre_score=score_timbre_coherence(d, row["tags"], row["description"]),
            general_score=score_general_coherence(d, query, row["tags"], row["description"]),
            descriptors_summary={
                "energy_label": d.energy_label,
                "timbre_label": d.timbre_label,
                "brightness_label": d.brightness_label,
                "melodic_label": d.melodic_label,
                "rhythm_label": d.rhythm_label,
                "pitch_range": d.pitch_range_label,
                "estimated_bpm": round(d.bpm, 1) if d.bpm else None,
                "bpm_confidence": round(d.bpm_confidence, 3),
            },
        )
    except Exception as exc:
        return CaseResult(
            audio_id=audio_id,
            name=row["name"],
            focus=focus,
            query="(error)",
            bpm_score={},
            melodic_score={},
            timbre_score={},
            general_score={},
            descriptors_summary={},
            error=str(exc),
        )


# ──────────────────────────────────────────────
# Aggregate metrics
# ──────────────────────────────────────────────

def aggregate(results: list[CaseResult], focus: str) -> dict[str, Any]:
    ok = [r for r in results if r.error is None]
    total = len(results)
    errors = total - len(ok)

    # BPM
    bpm_cases = [r for r in ok if r.bpm_score.get("has_meta_bpm") and r.bpm_score.get("estimated_bpm") is not None]
    bpm_within_5 = sum(1 for r in bpm_cases if r.bpm_score.get("within_5bpm"))
    bpm_within_10 = sum(1 for r in bpm_cases if r.bpm_score.get("within_10bpm"))
    bpm_diffs = [r.bpm_score["abs_diff"] for r in bpm_cases if r.bpm_score.get("abs_diff") is not None]

    # Melodic
    mel_cases = [r for r in ok]
    mel_aligned = sum(1 for r in mel_cases if r.melodic_score.get("label_aligns_with_meta"))

    # Timbre
    timbre_cases = [r for r in ok]
    timbre_aligned = sum(1 for r in timbre_cases if r.timbre_score.get("brightness_aligns"))

    # General-specific metrics
    gen_cases = [r for r in ok if r.general_score]
    degenerate_count = sum(1 for r in gen_cases if r.general_score.get("is_degenerate"))
    dim_counts = [r.general_score.get("dimensions_covered", 0) for r in gen_cases]
    composites = [r.general_score["composite_alignment"] for r in gen_cases
                  if "composite_alignment" in r.general_score]
    energy_aligned_n   = sum(1 for r in gen_cases if r.general_score.get("energy_aligned") is True)
    energy_total_n     = sum(1 for r in gen_cases if r.general_score.get("energy_aligned") is not None)
    rhythm_aligned_n   = sum(1 for r in gen_cases if r.general_score.get("rhythm_aligned") is True)
    rhythm_total_n     = sum(1 for r in gen_cases if r.general_score.get("rhythm_aligned") is not None)
    melodic_aligned_n  = sum(1 for r in gen_cases if r.general_score.get("melodic_aligned") is True)
    timbre_aligned_n   = sum(1 for r in gen_cases if r.general_score.get("timbre_aligned") is True)
    timbre_total_n     = sum(1 for r in gen_cases if r.general_score.get("timbre_aligned") is not None)

    general_agg = {
        "total_cases": len(gen_cases),
        "degenerate_queries": degenerate_count,
        "degenerate_rate": round(degenerate_count / max(len(gen_cases), 1), 3),
        "mean_dimensions_covered": round(float(np.mean(dim_counts)), 3) if dim_counts else None,
        "mean_composite_alignment": round(float(np.mean(composites)), 3) if composites else None,
        "energy_alignment_rate": round(energy_aligned_n / max(energy_total_n, 1), 3),
        "rhythm_alignment_rate": round(rhythm_aligned_n / max(rhythm_total_n, 1), 3),
        "melodic_alignment_rate": round(melodic_aligned_n / max(len(gen_cases), 1), 3),
        "timbre_alignment_rate": round(timbre_aligned_n / max(timbre_total_n, 1), 3),
        "dims_covered_distribution": {
            str(i): sum(1 for d in dim_counts if d == i) for i in range(4)
        },
    }

    # Query variety
    queries = [r.query for r in ok]
    unique_queries = len(set(queries))
    query_distribution: dict[str, int] = {}
    for q in queries:
        query_distribution[q] = query_distribution.get(q, 0) + 1
    top_queries = sorted(query_distribution.items(), key=lambda x: -x[1])[:10]

    return {
        "focus": focus,
        "total_cases": total,
        "processed_ok": len(ok),
        "errors": errors,
        "bpm": {
            "cases_with_meta_bpm_and_estimate": len(bpm_cases),
            "within_5bpm": bpm_within_5,
            "within_10bpm": bpm_within_10,
            "rate_within_5bpm": round(bpm_within_5 / max(len(bpm_cases), 1), 3),
            "rate_within_10bpm": round(bpm_within_10 / max(len(bpm_cases), 1), 3),
            "mean_abs_diff": round(float(np.mean(bpm_diffs)), 2) if bpm_diffs else None,
            "median_abs_diff": round(float(np.median(bpm_diffs)), 2) if bpm_diffs else None,
        },
        "melodic": {
            "label_alignment_rate": round(mel_aligned / max(len(mel_cases), 1), 3),
            "aligned": mel_aligned,
            "total": len(mel_cases),
        },
        "timbre": {
            "brightness_alignment_rate": round(timbre_aligned / max(len(timbre_cases), 1), 3),
            "aligned": timbre_aligned,
            "total": len(timbre_cases),
        },
        "query_variety": {
            "unique_queries": unique_queries,
            "total_queries": len(queries),
            "variety_rate": round(unique_queries / max(len(queries), 1), 3),
            "top_10_queries": [{"query": q, "count": c} for q, c in top_queries],
        },
        "general": general_agg,
    }


# ──────────────────────────────────────────────
# Console output
# ──────────────────────────────────────────────

def _div(char: str = "-", width: int = 100) -> None:
    print(char * width)


def print_aggregate(agg: dict[str, Any]) -> None:
    focus = agg["focus"]
    _div("=")
    print(f"FOCUS: {focus.upper()}   ({agg['processed_ok']}/{agg['total_cases']} processed, {agg['errors']} errors)")
    _div("=")

    b = agg["bpm"]
    if b["cases_with_meta_bpm_and_estimate"] > 0:
        print(f"\nBPM estimation ({b['cases_with_meta_bpm_and_estimate']} cases with metadata BPM):")
        print(f"  Within  5 BPM : {b['within_5bpm']:4d} / {b['cases_with_meta_bpm_and_estimate']}  ({b['rate_within_5bpm']:.1%})")
        print(f"  Within 10 BPM : {b['within_10bpm']:4d} / {b['cases_with_meta_bpm_and_estimate']}  ({b['rate_within_10bpm']:.1%})")
        print(f"  Mean abs diff : {b['mean_abs_diff']} BPM")
        print(f"  Median abs diff: {b['median_abs_diff']} BPM")
    else:
        print("\nBPM: no cases with both metadata BPM and a successful estimate")

    m = agg["melodic"]
    print(f"\nMelodic label alignment  : {m['aligned']}/{m['total']}  ({m['label_alignment_rate']:.1%})")

    t = agg["timbre"]
    print(f"Timbre brightness align  : {t['aligned']}/{t['total']}  ({t['brightness_alignment_rate']:.1%})")

    v = agg["query_variety"]
    print(f"\nQuery variety ({focus} focus): {v['unique_queries']} unique / {v['total_queries']} total  ({v['variety_rate']:.1%})")
    print("Top queries generated:")
    for item in v["top_10_queries"]:
        print(f"  {item['count']:4d}x  \"{item['query']}\"")

    g = agg.get("general", {})
    if g and g.get("total_cases", 0) > 0:
        print(f"\nGeneral-mode specific metrics ({g['total_cases']} cases):")
        print(f"  Degenerate queries      : {g['degenerate_queries']} / {g['total_cases']}  ({g['degenerate_rate']:.1%})")
        print(f"  Mean dimensions covered : {g['mean_dimensions_covered']} / 3")
        dims_dist = g.get("dims_covered_distribution", {})
        print(f"  Dims distribution       : " + "  ".join(f"{k}dim={v}" for k, v in sorted(dims_dist.items())))
        print(f"  Mean composite alignment: {g['mean_composite_alignment']:.3f}  (0=bad, 1=perfect)")
        print(f"  Energy token alignment  : {g['energy_alignment_rate']:.1%}")
        print(f"  Rhythm token alignment  : {g['rhythm_alignment_rate']:.1%}")
        print(f"  Melodic token alignment : {g['melodic_alignment_rate']:.1%}")
        print(f"  Timbre token alignment  : {g['timbre_alignment_rate']:.1%}")


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate Essentia query generation quality")
    parser.add_argument(
        "--focus",
        default="all",
        choices=["all"] + FOCUSES,
        help="Which focus to evaluate (default: all)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of audio files to evaluate (default: all)",
    )
    parser.add_argument(
        "--output",
        default=str(OUTPUT_DIR / f"essentia_query_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"),
        help="Output JSON report path",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-case details",
    )
    args = parser.parse_args()

    focuses_to_run = FOCUSES if args.focus == "all" else [args.focus]

    print("Essentia Query Evaluator")
    print(f"  Audio dir : {DATASET_AUDIO_DIR}")
    print(f"  Metadata  : {DATASET_METADATA_PATH}")
    print(f"  Focuses   : {', '.join(focuses_to_run)}")
    print()

    try:
        rows = load_metadata_rows(limit=args.limit)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}")
        return 1

    print(f"Loaded {len(rows)} audio files with metadata\n")

    report: dict[str, Any] = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "audio_dir": str(DATASET_AUDIO_DIR),
        "metadata_path": str(DATASET_METADATA_PATH),
        "total_audio_files": len(rows),
        "focuses": {},
    }

    for focus in focuses_to_run:
        print(f"Evaluating focus='{focus}' on {len(rows)} files...")
        results = [evaluate_case(row, focus) for row in rows]

        if args.verbose:
            print()
            for r in results:
                if r.error:
                    print(f"  [{r.audio_id}] ERROR: {r.error}")
                else:
                    bpm_info = ""
                    if r.bpm_score.get("has_meta_bpm") and r.bpm_score.get("estimated_bpm"):
                        bpm_info = f"  bpm_diff={r.bpm_score.get('abs_diff')}"
                    print(f"  [{r.audio_id}] {r.name[:40]:<40}  query=\"{r.query}\"{bpm_info}")

        agg = aggregate(results, focus)
        print_aggregate(agg)
        print()

        report["focuses"][focus] = {
            "aggregate": agg,
            "cases": [asdict(r) for r in results],
        }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nReport written to: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())