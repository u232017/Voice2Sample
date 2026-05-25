from __future__ import annotations

import csv
import json
import math
import re
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf


SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".aiff", ".aif", ".m4a"}
BPM_MIN = 60.0
BPM_MAX = 180.0
# Adaptive candidate filtering windows for BPM mode.
BPM_COMPATIBLE_TOLERANCES = (10.0, 15.0, 20.0)
# Hybrid ranking weight for focus="bpm": combined_distance = feature_distance + weight * bpm_penalty
BPM_DISTANCE_WEIGHT = 2.0
# Stronger penalty used when tolerance windows cannot provide enough candidates.
BPM_DISTANCE_WEIGHT_FALLBACK = 2.5
# BPM normalization scale for penalty.
BPM_PENALTY_SCALE = 20.0


@dataclass(frozen=True)
class DatasetItem:
    audio_id: str
    path: Path
    metadata: dict[str, Any]
    features: list[float]


def load_metadata(metadata_path: Path) -> dict[str, dict[str, Any]]:
    if not metadata_path.exists():
        return {}

    if metadata_path.suffix.lower() == ".csv":
        result: dict[str, dict[str, Any]] = {}
        with metadata_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                audio_id = str(row.get("id") or row.get("freesound_id") or row.get("audio_id") or "").strip()
                if audio_id:
                    result[audio_id] = dict(row)
        return result

    with metadata_path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    return {str(key): value for key, value in raw.items()}


def list_dataset_audio(audio_dir: Path) -> list[Path]:
    if not audio_dir.exists():
        return []

    return sorted(
        path
        for path in audio_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS
    )


def read_audio_mono(path: Path) -> tuple[np.ndarray, int]:
    audio, sample_rate = sf.read(str(path), always_2d=True, dtype="float32")
    mono = np.mean(audio, axis=1)
    return mono.astype(np.float32), int(sample_rate)


def trim_audio_file(input_path: Path, output_path: Path, trim_start: float | None, trim_end: float | None) -> Path:
    if trim_start is None or trim_end is None or trim_end <= trim_start:
        return input_path

    try:
        audio, sample_rate = read_audio_mono(input_path)
        start_sample = max(0, int(trim_start * sample_rate))
        end_sample = min(len(audio), int(trim_end * sample_rate))
        if end_sample <= start_sample:
            return input_path

        sf.write(str(output_path), audio[start_sample:end_sample], sample_rate)
        return output_path
    except Exception:
        return input_path


def duration_seconds(path: Path) -> float:
    try:
        info = sf.info(str(path))
        return round(float(info.duration), 3)
    except Exception:
        try:
            with wave.open(str(path), "rb") as audio_file:
                frames = audio_file.getnframes()
                rate = audio_file.getframerate()
                return round(frames / float(rate), 3) if rate else 0.0
        except Exception:
            return 0.0


def _frame_audio(audio: np.ndarray, frame_size: int = 2048, hop_size: int = 1024) -> np.ndarray:
    if len(audio) == 0:
        return np.zeros((1, frame_size), dtype=np.float32)

    if len(audio) < frame_size:
        padded = np.pad(audio, (0, frame_size - len(audio)))
        return padded.reshape(1, frame_size).astype(np.float32)

    frame_count = 1 + (len(audio) - frame_size) // hop_size
    shape = (frame_count, frame_size)
    strides = (audio.strides[0] * hop_size, audio.strides[0])
    frames = np.lib.stride_tricks.as_strided(audio, shape=shape, strides=strides).copy()
    return frames.astype(np.float32)


def _safe_stats(values: np.ndarray) -> list[float]:
    values = np.asarray(values, dtype=np.float32)
    if values.size == 0 or not np.isfinite(values).any():
        return [0.0, 0.0, 0.0]

    values = values[np.isfinite(values)]
    return [float(np.mean(values)), float(np.std(values)), float(np.median(values))]


def _safe_float(value: Any) -> float | None:
    if value in (None, "", "None"):
        return None
    try:
        number = float(value)
        if np.isfinite(number):
            return number
    except (TypeError, ValueError):
        return None
    return None


def _metadata_bpm(metadata: dict[str, Any]) -> float | None:
    bpm = _safe_float(metadata.get("bpm"))
    if bpm is not None:
        return bpm
    annotations = metadata.get("annotations")
    if isinstance(annotations, dict):
        return _safe_float(annotations.get("bpm"))
    return None


def _get_item_bpm(item: DatasetItem) -> float | None:
    return _metadata_bpm(item.metadata or {})


def get_query_bpm(query_path: Path, items: list[DatasetItem]) -> float | None:
    """Resolve query BPM from dataset metadata when possible, otherwise estimate from audio."""
    query_stem = query_path.stem.lower()

    for item in items:
        if query_stem == item.path.stem.lower():
            bpm = _get_item_bpm(item)
            if bpm is not None:
                return bpm

    return estimate_audio_bpm(query_path)


def estimate_audio_bpm(path: Path) -> float | None:
    """Estimate BPM from audio with a lightweight flux-autocorrelation method."""
    try:
        audio, sample_rate = read_audio_mono(path)
    except Exception:
        return None

    if audio.size == 0:
        return None

    audio = np.nan_to_num(audio).astype(np.float32)
    peak = float(np.max(np.abs(audio)) + 1e-9)
    if peak <= 1e-9:
        return None
    normalized = audio / peak

    frame_size = 1024
    hop_size = 512
    if normalized.size < frame_size * 2:
        return None

    envelope = []
    for start in range(0, normalized.size - frame_size, hop_size):
        frame = normalized[start : start + frame_size]
        envelope.append(float(np.mean(frame * frame)))

    if len(envelope) < 12:
        return None

    flux = np.maximum(0.0, np.diff(np.asarray(envelope, dtype=np.float32)))
    if flux.size < 12:
        return None

    flux_rate = float(sample_rate) / float(hop_size)
    min_lag = max(1, int((60.0 / BPM_MAX) * flux_rate))
    max_lag = max(min_lag, int((60.0 / BPM_MIN) * flux_rate))
    max_lag = min(max_lag, int(flux.size - 1))
    if min_lag >= max_lag:
        return None

    best_lag = 0
    best_score = 0.0
    for lag in range(min_lag, max_lag + 1):
        score = float(np.dot(flux[lag:], flux[:-lag]))
        if score > best_score:
            best_score = score
            best_lag = lag

    if best_lag <= 0 or best_score <= 0.0:
        return None

    bpm = (60.0 * flux_rate) / float(best_lag)
    if not np.isfinite(bpm):
        return None
    return float(np.clip(bpm, BPM_MIN, BPM_MAX))


def robust_bpm_distance(input_bpm: float, candidate_bpm: float) -> float:
    """Half-time / double-time aware BPM difference."""
    return min(
        abs(input_bpm - candidate_bpm),
        abs(input_bpm - (candidate_bpm * 2.0)),
        abs(input_bpm - (candidate_bpm * 0.5)),
    )


def normalize_bpm_penalty(bpm_diff: float) -> float:
    """Normalize BPM distance and clip it to keep the score bounded."""
    if bpm_diff <= 0:
        return 0.0
    return float(np.clip(bpm_diff / BPM_PENALTY_SCALE, 0.0, 1.0))


def extract_audio_features(path: Path) -> list[float]:
    audio, sample_rate = read_audio_mono(path)
    if audio.size == 0:
        return [0.0] * 32

    audio = np.nan_to_num(audio)
    peak = float(np.max(np.abs(audio)) + 1e-9)
    normalized = audio / peak
    frames = _frame_audio(normalized)
    window = np.hanning(frames.shape[1]).astype(np.float32)
    windowed = frames * window
    spectrum = np.abs(np.fft.rfft(windowed, axis=1)).astype(np.float32)
    spectrum_sum = np.sum(spectrum, axis=1) + 1e-9
    freqs = np.fft.rfftfreq(frames.shape[1], d=1.0 / sample_rate).astype(np.float32)

    rms = np.sqrt(np.mean(frames**2, axis=1))
    zcr = np.mean(np.abs(np.diff(np.signbit(frames), axis=1)), axis=1)
    centroid = np.sum(spectrum * freqs, axis=1) / spectrum_sum
    bandwidth = np.sqrt(np.sum(spectrum * (freqs - centroid[:, None]) ** 2, axis=1) / spectrum_sum)

    cumulative = np.cumsum(spectrum, axis=1)
    rolloff_threshold = spectrum_sum * 0.85
    rolloff_indices = np.argmax(cumulative >= rolloff_threshold[:, None], axis=1)
    rolloff = freqs[np.clip(rolloff_indices, 0, len(freqs) - 1)]

    flux = np.sqrt(np.sum(np.diff(spectrum, axis=0) ** 2, axis=1)) if len(spectrum) > 1 else np.array([0.0])

    band_edges = np.linspace(0, len(freqs) - 1, 9).astype(int)
    band_energies = []
    total_energy = float(np.sum(spectrum) + 1e-9)
    for start, end in zip(band_edges[:-1], band_edges[1:]):
        band_energies.append(float(np.sum(spectrum[:, start : max(start + 1, end)]) / total_energy))

    envelope = np.abs(normalized)
    attack_index = int(np.argmax(envelope >= max(0.05, np.max(envelope) * 0.7))) if envelope.size else 0
    attack_time = attack_index / float(sample_rate)
    silence_ratio = float(np.mean(envelope < 0.02))

    feature_vector = [
        math.log1p(len(audio) / float(sample_rate)),
        float(np.mean(np.abs(normalized))),
        float(np.std(normalized)),
        peak,
        attack_time,
        silence_ratio,
        *_safe_stats(rms),
        *_safe_stats(zcr),
        *_safe_stats(centroid),
        *_safe_stats(bandwidth),
        *_safe_stats(rolloff),
        *_safe_stats(flux),
        *band_energies,
    ]

    return [float(value) if np.isfinite(value) else 0.0 for value in feature_vector]


def _cache_record(path: Path, metadata: dict[str, Any], features: list[float]) -> dict[str, Any]:
    stat = path.stat()
    return {
        "path": str(path),
        "name": path.name,
        "size": stat.st_size,
        "mtime": stat.st_mtime,
        "metadata": metadata,
        "features": features,
    }


def load_dataset_items(audio_dir: Path, metadata_path: Path, cache_path: Path) -> list[DatasetItem]:
    metadata_by_id = load_metadata(metadata_path)
    audio_files = list_dataset_audio(audio_dir)
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    cached_records: dict[str, dict[str, Any]] = {}
    if cache_path.exists():
        try:
            with cache_path.open("r", encoding="utf-8") as handle:
                cache_data = json.load(handle)
            cached_records = {record["name"]: record for record in cache_data.get("items", [])}
        except Exception:
            cached_records = {}

    next_records = []
    items = []

    for path in audio_files:
        audio_id = path.stem
        item_metadata = metadata_by_id.get(audio_id, {})
        stat = path.stat()
        cached = cached_records.get(path.name)

        if cached and cached.get("size") == stat.st_size and cached.get("mtime") == stat.st_mtime:
            features = [float(value) for value in cached.get("features", [])]
        else:
            features = extract_audio_features(path)

        next_records.append(_cache_record(path, item_metadata, features))
        items.append(DatasetItem(audio_id=audio_id, path=path, metadata=item_metadata, features=features))

    with cache_path.open("w", encoding="utf-8") as handle:
        json.dump({"items": next_records}, handle, ensure_ascii=False, indent=2)

    return items


def _standardize(dataset_matrix: np.ndarray, query_vector: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    mean = np.mean(dataset_matrix, axis=0)
    std = np.std(dataset_matrix, axis=0)
    std = np.where(std < 1e-9, 1.0, std)
    return (dataset_matrix - mean) / std, (query_vector - mean) / std


def _get_feature_focus_indices(focus: str) -> list[int]:
    """Get feature indices to use based on similarity focus.
    
    Feature indices (from extract_audio_features):
    0: log(duration)
    1-5: amplitude and attack (energy)
    6-8: RMS stats
    9-11: ZCR stats (rhythm)
    12-14: Centroid stats (melodic)
    15-17: Bandwidth stats (timbre)
    18-20: Rolloff stats (melodic)
    21-23: Flux stats (rhythm)
    24-31: Band energies (timbre/energy)
    """
    if focus == "melodic":
        # Pitch and melodic contour: centroid, rolloff
        return [12, 13, 14, 18, 19, 20]
    elif focus == "bpm":
        # Rhythm and tempo: RMS, ZCR, flux
        return [6, 7, 8, 9, 10, 11, 21, 22, 23]
    elif focus == "timbre":
        # Spectral characteristics: bandwidth, rolloff, band energies
        return [15, 16, 17, 18, 19, 20, 24, 25, 26, 27, 28, 29, 30, 31]
    elif focus == "energy":
        # Energy content: amplitude, RMS, band energies
        return [1, 2, 6, 7, 8, 24, 25, 26, 27, 28, 29, 30, 31]
    else:  # "general" or default
        # Use all features
        return list(range(32))


def rank_similar_items(query_audio: Path, items: list[DatasetItem], limit: int, focus: str = "general") -> list[tuple[DatasetItem, float, float]]:
    if not items:
        return []

    query_features = np.asarray(extract_audio_features(query_audio), dtype=np.float32)
    matrix = np.asarray([item.features for item in items], dtype=np.float32)
    
    # Filter features based on focus
    focus_indices = _get_feature_focus_indices(focus)
    query_features_focused = query_features[focus_indices]
    matrix_focused = matrix[:, focus_indices]

    dataset_scaled, query_scaled = _standardize(matrix_focused, query_features_focused)
    feature_distances = np.linalg.norm(dataset_scaled - query_scaled, axis=1).astype(np.float32)

    # Keep non-BPM modes unchanged.
    if focus != "bpm":
        order = np.argsort(feature_distances)
        ranked = []
        for index in order[:limit]:
            distance = float(feature_distances[index])
            similarity = float(1.0 / (1.0 + distance))
            ranked.append((items[int(index)], distance, similarity))
        return ranked

    # BPM mode is a two-stage hybrid:
    # 1) Adaptive BPM-compatible filtering (10 -> 15 -> 20 BPM windows)
    # 2) Feature distance + BPM penalty ranking inside the selected candidate set
    query_bpm = get_query_bpm(query_audio, items)
    if query_bpm is None:
        order = np.argsort(feature_distances)
        ranked = []
        for index in order[:limit]:
            distance = float(feature_distances[index])
            similarity = float(1.0 / (1.0 + distance))
            ranked.append((items[int(index)], distance, similarity))
        return ranked

    item_bpms: list[float | None] = [_get_item_bpm(item) for item in items]
    bpm_diffs: list[float | None] = []
    for bpm in item_bpms:
        if bpm is None:
            bpm_diffs.append(None)
        else:
            bpm_diffs.append(robust_bpm_distance(query_bpm, bpm))

    candidate_indices: list[int] | None = None
    for tolerance in BPM_COMPATIBLE_TOLERANCES:
        compatible = [idx for idx, diff in enumerate(bpm_diffs) if diff is not None and diff <= tolerance]
        if len(compatible) >= limit:
            candidate_indices = compatible
            break

    fallback_full_dataset = False
    if candidate_indices is None:
        candidate_indices = list(range(len(items)))
        fallback_full_dataset = True

    combined_distances = feature_distances.copy()
    bpm_weight = BPM_DISTANCE_WEIGHT_FALLBACK if fallback_full_dataset else BPM_DISTANCE_WEIGHT

    for idx in candidate_indices:
        diff = bpm_diffs[idx]
        if diff is None:
            # Missing BPM for this candidate: keep feature-only distance.
            continue
        bpm_penalty = normalize_bpm_penalty(diff)
        combined_distances[idx] = float(feature_distances[idx] + (bpm_weight * bpm_penalty))

    order = sorted(candidate_indices, key=lambda idx: combined_distances[idx])

    ranked = []
    for index in order[:limit]:
        distance = float(combined_distances[index])
        similarity = float(1.0 / (1.0 + distance))
        ranked.append((items[int(index)], distance, similarity))

    return ranked


def clean_name_from_path(path: Path) -> str:
    return path.stem.replace("-", " ").replace("_", " ").strip().title()


def tags_from_metadata(metadata: dict[str, Any], fallback_name: str) -> list[str]:
    tags = metadata.get("tags")
    if isinstance(tags, list) and tags:
        return [str(tag) for tag in tags[:8]]

    words = re.split(r"[\s_\-.]+", fallback_name.lower())
    return [word for word in words if len(word) > 2 and not word.isdigit()][:5] or ["dataset"]

