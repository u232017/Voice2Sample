"""
Project quantitative evaluation script.

Outputs a JSON report with dataset stats, embedding runtime stats,
retrieval neighbor similarity, and optional BPM agreement metrics.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import librosa
from sklearn.neighbors import NearestNeighbors


AUDIO_EXTS = (".wav", ".mp3", ".flac", ".ogg", ".aiff", ".aif")


@dataclass
class AudioStats:
    total_files: int
    processed_files: int
    failed_files: int
    total_duration_sec: float
    mean_duration_sec: float
    median_duration_sec: float
    min_duration_sec: float
    max_duration_sec: float
    mean_size_bytes: float
    duplicate_hashes: int
    format_counts: Dict[str, int]


@dataclass
class EmbeddingStats:
    total_files: int
    processed_files: int
    failed_files: int
    mean_time_sec: float
    median_time_sec: float
    min_time_sec: float
    max_time_sec: float


@dataclass
class NeighborStats:
    total_queries: int
    mean_cosine_similarity: float
    median_cosine_similarity: float
    min_cosine_similarity: float
    max_cosine_similarity: float


@dataclass
class BpmStats:
    total_queries: int
    bpm_agreement_rate: float
    mean_abs_bpm_diff: float
    median_abs_bpm_diff: float


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _iter_audio_files(root: Path, limit: Optional[int] = None) -> List[Path]:
    files: List[Path] = []
    for path in root.rglob("*"):
        if path.suffix.lower() in AUDIO_EXTS:
            files.append(path)
            if limit and len(files) >= limit:
                break
    return files


def _sha1_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    hasher = hashlib.sha1()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def _safe_duration(path: Path) -> Optional[float]:
    try:
        return float(librosa.get_duration(path=str(path)))
    except Exception:
        return None


def compute_dataset_stats(audio_root: Path, limit: Optional[int] = None) -> Tuple[AudioStats, List[Path]]:
    files = _iter_audio_files(audio_root, limit=limit)
    durations: List[float] = []
    sizes: List[int] = []
    format_counts: Dict[str, int] = {}
    hashes: Dict[str, int] = {}
    failed = 0

    for path in files:
        format_counts[path.suffix.lower()] = format_counts.get(path.suffix.lower(), 0) + 1
        sizes.append(path.stat().st_size)
        digest = _sha1_file(path)
        hashes[digest] = hashes.get(digest, 0) + 1
        duration = _safe_duration(path)
        if duration is None:
            failed += 1
            continue
        durations.append(duration)

    processed = len(durations)
    total = len(files)
    duplicate_hashes = sum(1 for count in hashes.values() if count > 1)

    if processed:
        durations_array = np.array(durations)
        sizes_array = np.array(sizes, dtype=float)
        stats = AudioStats(
            total_files=total,
            processed_files=processed,
            failed_files=failed,
            total_duration_sec=float(durations_array.sum()),
            mean_duration_sec=float(durations_array.mean()),
            median_duration_sec=float(np.median(durations_array)),
            min_duration_sec=float(durations_array.min()),
            max_duration_sec=float(durations_array.max()),
            mean_size_bytes=float(sizes_array.mean()),
            duplicate_hashes=duplicate_hashes,
            format_counts=format_counts,
        )
    else:
        stats = AudioStats(
            total_files=total,
            processed_files=0,
            failed_files=failed,
            total_duration_sec=0.0,
            mean_duration_sec=0.0,
            median_duration_sec=0.0,
            min_duration_sec=0.0,
            max_duration_sec=0.0,
            mean_size_bytes=float(np.mean(sizes)) if sizes else 0.0,
            duplicate_hashes=duplicate_hashes,
            format_counts=format_counts,
        )

    return stats, files


def _load_clap_helpers() -> Tuple[object, object]:
    repo_root = _repo_root()
    sys.path.insert(0, str(repo_root))
    from Machine_Learning import modelo_ml  # pylint: disable=import-error

    return modelo_ml, modelo_ml.inicializar_modelo


def _embed_files(files: List[Path]) -> Tuple[np.ndarray, EmbeddingStats, List[Path]]:
    modelo_ml, init_fn = _load_clap_helpers()
    init_fn()

    embeddings: List[np.ndarray] = []
    timings: List[float] = []
    ok_files: List[Path] = []
    failed = 0

    for path in files:
        start = time.time()
        try:
            emb = modelo_ml.extraer_embedding(str(path))
            embeddings.append(emb)
            ok_files.append(path)
            timings.append(time.time() - start)
        except Exception:
            failed += 1

    processed = len(embeddings)
    total = len(files)

    if processed:
        timings_array = np.array(timings)
        stats = EmbeddingStats(
            total_files=total,
            processed_files=processed,
            failed_files=failed,
            mean_time_sec=float(timings_array.mean()),
            median_time_sec=float(np.median(timings_array)),
            min_time_sec=float(timings_array.min()),
            max_time_sec=float(timings_array.max()),
        )
        emb_matrix = np.vstack(embeddings)
    else:
        stats = EmbeddingStats(
            total_files=total,
            processed_files=0,
            failed_files=failed,
            mean_time_sec=0.0,
            median_time_sec=0.0,
            min_time_sec=0.0,
            max_time_sec=0.0,
        )
        emb_matrix = np.zeros((0, 0), dtype=float)

    return emb_matrix, stats, ok_files


def _nearest_neighbor_stats(embeddings: np.ndarray) -> Optional[NeighborStats]:
    if embeddings.shape[0] < 2:
        return None

    knn = NearestNeighbors(n_neighbors=2, metric="cosine", algorithm="brute")
    knn.fit(embeddings)
    distances, indices = knn.kneighbors(embeddings)

    similarities: List[float] = []
    for i in range(embeddings.shape[0]):
        # First neighbor is self; take the next one.
        nn_distance = distances[i][1]
        similarities.append(1.0 - float(nn_distance))

    sims = np.array(similarities)
    return NeighborStats(
        total_queries=int(sims.shape[0]),
        mean_cosine_similarity=float(sims.mean()),
        median_cosine_similarity=float(np.median(sims)),
        min_cosine_similarity=float(sims.min()),
        max_cosine_similarity=float(sims.max()),
    )


def _load_metadata_bpm(metadata_path: Path) -> Dict[str, float]:
    data = json.loads(metadata_path.read_text(encoding="utf-8"))
    bpm_map: Dict[str, float] = {}
    for key, item in data.items():
        bpm = None
        annotations = item.get("annotations") if isinstance(item, dict) else None
        if isinstance(annotations, dict):
            bpm = annotations.get("bpm")
        if bpm is None:
            continue
        bpm_map[str(item.get("id", key))] = float(bpm)
    return bpm_map


def _resolve_metadata_audio_files(audio_dir: Path, bpm_map: Dict[str, float]) -> List[Path]:
    files: List[Path] = []
    for audio_id in bpm_map.keys():
        wav_path = audio_dir / f"{audio_id}.wav"
        mp3_path = audio_dir / f"{audio_id}.mp3"
        if wav_path.exists():
            files.append(wav_path)
        elif mp3_path.exists():
            files.append(mp3_path)
    return files


def _bpm_stats(files: List[Path], bpm_map: Dict[str, float], embeddings: np.ndarray) -> Optional[BpmStats]:
    if embeddings.shape[0] < 2:
        return None

    id_list = [path.stem for path in files]
    bpm_values = [bpm_map.get(audio_id) for audio_id in id_list]

    knn = NearestNeighbors(n_neighbors=2, metric="cosine", algorithm="brute")
    knn.fit(embeddings)
    distances, indices = knn.kneighbors(embeddings)

    abs_diffs: List[float] = []
    agreement = 0
    total = 0

    for i, bpm in enumerate(bpm_values):
        if bpm is None:
            continue
        neighbor_index = indices[i][1]
        neighbor_bpm = bpm_values[neighbor_index]
        if neighbor_bpm is None:
            continue
        total += 1
        if float(neighbor_bpm) == float(bpm):
            agreement += 1
        abs_diffs.append(abs(float(neighbor_bpm) - float(bpm)))

    if total == 0:
        return None

    diffs = np.array(abs_diffs)
    return BpmStats(
        total_queries=int(total),
        bpm_agreement_rate=float(agreement / total),
        mean_abs_bpm_diff=float(diffs.mean()),
        median_abs_bpm_diff=float(np.median(diffs)),
    )


def _write_report(report: Dict, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"evaluation_report_{stamp}.json"
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return output_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Voice2Sample quantitative evaluation")
    repo_root = _repo_root()

    parser.add_argument(
        "--audio-dir",
        default=str(repo_root / "Machine_Learning" / "base_datos_audios"),
        help="Audio folder used for retrieval stats",
    )
    parser.add_argument(
        "--metadata-json",
        default=str(repo_root / "Dataset" / "metadata_prueba"),
        help="Metadata JSON path for BPM evaluation",
    )
    parser.add_argument(
        "--metadata-audio-dir",
        default=str(repo_root / "Dataset" / "audio_prueba"),
        help="Audio folder matching metadata ids",
    )
    parser.add_argument("--limit", type=int, default=None, help="Limit number of files for quick runs")
    parser.add_argument("--skip-embeddings", action="store_true", help="Skip CLAP embedding metrics")
    parser.add_argument("--skip-metadata", action="store_true", help="Skip BPM agreement metrics")

    args = parser.parse_args()

    audio_dir = Path(args.audio_dir)
    metadata_json = Path(args.metadata_json)
    metadata_audio_dir = Path(args.metadata_audio_dir)

    report: Dict[str, object] = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "audio_dir": str(audio_dir),
        "metadata_json": str(metadata_json),
        "metadata_audio_dir": str(metadata_audio_dir),
    }

    dataset_stats, audio_files = compute_dataset_stats(audio_dir, limit=args.limit)
    report["dataset_stats"] = dataset_stats.__dict__

    if not args.skip_embeddings:
        embeddings, embedding_stats, ok_files = _embed_files(audio_files)
        report["embedding_stats"] = embedding_stats.__dict__
        neighbor_stats = _nearest_neighbor_stats(embeddings)
        report["neighbor_stats"] = neighbor_stats.__dict__ if neighbor_stats else None
    else:
        report["embedding_stats"] = None
        report["neighbor_stats"] = None

    if not args.skip_metadata and metadata_json.exists():
        bpm_map = _load_metadata_bpm(metadata_json)
        meta_files = _resolve_metadata_audio_files(metadata_audio_dir, bpm_map)
        report["metadata_file_count"] = len(meta_files)
        if not args.skip_embeddings:
            meta_embeddings, _, meta_ok = _embed_files(meta_files)
            report["metadata_audio_processed"] = len(meta_ok)
            bpm_stats = _bpm_stats(meta_ok, bpm_map, meta_embeddings)
            report["bpm_stats"] = bpm_stats.__dict__ if bpm_stats else None
        else:
            report["bpm_stats"] = None
    else:
        report["bpm_stats"] = None

    output_path = _write_report(report, _repo_root() / "Evaluation")
    print(f"Report written to: {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
