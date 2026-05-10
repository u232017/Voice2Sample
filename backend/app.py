from __future__ import annotations

import hashlib
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .dataset_recommender import (
    clean_name_from_path,
    duration_seconds,
    load_dataset_items,
    rank_similar_items,
    tags_from_metadata,
    trim_audio_file,
)

ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_DIR = ROOT_DIR / "Dataset"
DATASET_AUDIO_DIR = DATASET_DIR / "audio_prueba"
DATASET_METADATA_PATH = DATASET_DIR / "metadata_prueba"
CACHE_DIR = ROOT_DIR / "backend" / "cache"
DATASET_FEATURE_CACHE = CACHE_DIR / "dataset_features.json"
UPLOAD_TMP_DIR = ROOT_DIR / "backend" / "tmp"
UPLOAD_TMP_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Voice2Sample API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_dataset_items: list[Any] | None = None


def _load_dataset() -> list[Any]:
    global _dataset_items
    _dataset_items = load_dataset_items(DATASET_AUDIO_DIR, DATASET_METADATA_PATH, DATASET_FEATURE_CACHE)
    return _dataset_items


def _get_dataset() -> list[Any]:
    global _dataset_items
    if _dataset_items is None:
        return _load_dataset()
    return _dataset_items


def _safe_filename(path: Path) -> str:
    return path.name.replace("\\", "").replace("/", "")


def _parse_freesound_id(path: Path) -> int:
    if path.stem.isdigit():
        return int(path.stem)

    digest = hashlib.sha1(path.name.encode("utf-8")).hexdigest()[:8]
    return int(digest, 16)


def _dataset_sound_payload(item: Any, similarity: float | None = None, distance: float | None = None) -> dict[str, Any]:
    path = item.path
    metadata = item.metadata or {}
    sound_id = _parse_freesound_id(path)
    filename = _safe_filename(path)
    preview_url = f"/api/dataset-audio/{filename}"
    name = metadata.get("name") or clean_name_from_path(path)
    username = metadata.get("username") or "Voice2Sample dataset"
    license_value = metadata.get("license") or "Dataset audio"
    source_url = f"https://freesound.org/s/{sound_id}/" if str(sound_id) == item.audio_id else preview_url
    bpm = metadata.get("annotations", {}).get("bpm") if isinstance(metadata.get("annotations"), dict) else None

    return {
        "id": sound_id,
        "name": name,
        "description": metadata.get("description"),
        "username": username,
        "duration": duration_seconds(path),
        "tags": tags_from_metadata(metadata, str(name)),
        "previews": {
            "preview-hq-mp3": preview_url,
            "preview-lq-mp3": preview_url,
        },
        "images": {},
        "url": source_url,
        "download": preview_url,
        "license": license_value,
        "num_downloads": 0,
        "avg_rating": None,
        "num_ratings": 0,
        "num_comments": 0,
        "similarity": similarity,
        "distance": distance,
        "bpm": bpm,
    }


def _dataset_recommendations(audio_path: Path, limit: int) -> list[dict[str, Any]]:
    items = _load_dataset()
    if not items:
        raise RuntimeError("Dataset/audio_prueba does not contain supported audio files")

    ranked = rank_similar_items(audio_path, items, limit)
    return [_dataset_sound_payload(item, similarity, distance) for item, distance, similarity in ranked]


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "engine": "dataset-audio-descriptors",
        "dataset_count": len(_get_dataset()),
        "dataset_audio_dir": str(DATASET_AUDIO_DIR),
    }


@app.get("/api/dataset-audio/{filename}")
def serve_dataset_audio(filename: str) -> FileResponse:
    safe_name = _safe_filename(Path(filename))
    path = DATASET_AUDIO_DIR / safe_name

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Dataset audio file not found")

    return FileResponse(path, filename=safe_name)


@app.post("/api/recommendations")
async def recommendations(
    audio: UploadFile = File(...),
    trim_start: float | None = Form(default=None),
    trim_end: float | None = Form(default=None),
    limit: int = Form(default=4),
) -> dict[str, Any]:
    suffix = Path(audio.filename or "input.wav").suffix or ".wav"
    limit = min(max(limit, 1), 4)

    temp_dir = UPLOAD_TMP_DIR / f"voice2sample_{uuid.uuid4().hex}"
    temp_dir.mkdir(parents=True, exist_ok=False)

    try:
        input_path = Path(temp_dir) / f"input{suffix}"

        with input_path.open("wb") as output_file:
            shutil.copyfileobj(audio.file, output_file)

        analysis_path = trim_audio_file(input_path, input_path.with_suffix(".trimmed.wav"), trim_start, trim_end)

        try:
            results = _dataset_recommendations(analysis_path, limit)
            engine = "dataset-audio-descriptors"
            error = None
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Dataset recommendation failed: {exc}") from exc
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return {
        "engine": engine,
        "error": error,
        "results": results,
    }
