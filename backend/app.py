from __future__ import annotations

import hashlib
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import sys

from .dataset_recommender import (
    build_map_results,
    clean_name_from_path,
    duration_seconds,
    load_dataset_items,
    rank_similar_items,
    tags_from_metadata,
    trim_audio_file,
)

# BuscadorSimilitud uses the pre-trained KNN joblibs
MODELS_DIR = Path(__file__).resolve().parents[1] / "search_engines" / "acoustic_search" / "models"
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "search_engines" / "acoustic_search"))
try:
    from inference import BuscadorSimilitud
    _buscador = BuscadorSimilitud(models_dir=str(MODELS_DIR))
    _USE_KNN = True
    print("[Voice2Sample] KNN joblib models loaded from", MODELS_DIR)
except Exception as _e:
    _USE_KNN = False
    _buscador = None
    print("[Voice2Sample] KNN models not available, falling back to euclidean distance:", _e)

# CLAP embeddings recommender — carga en background para no bloquear el arranque
import threading
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from clap_recommender import init_clap, clap_recommend, is_available as clap_available
    _CLAP_LOADED = False

    def _load_clap_background():
        global _CLAP_LOADED
        print("[Voice2Sample] CLAP: cargando modelo en background...")
        _CLAP_LOADED = init_clap()
        if _CLAP_LOADED:
            print("[Voice2Sample] CLAP model loaded — real embedding search enabled")
        else:
            print("[Voice2Sample] CLAP embeddings loaded but model unavailable — install torch+transformers+librosa")

    threading.Thread(target=_load_clap_background, daemon=True).start()
except Exception as _clap_e:
    _CLAP_LOADED = False
    clap_recommend = None  # type: ignore
    clap_available = lambda: False  # type: ignore
    print("[Voice2Sample] CLAP recommender import failed:", _clap_e)

ROOT_DIR = Path(__file__).resolve().parents[1]
DATASET_DIR = ROOT_DIR / "Dataset"
DATASET_AUDIO_DIR = DATASET_DIR / "audio_processed"
# metadata_filtered.csv tiene prioridad si existe; si no, el CSV completo
# de Clean_csv (contiene id, name original de Freesound, username, licencia, bpm…)
_METADATA_CANDIDATES = (
    DATASET_DIR / "metadata_filtered.csv",
    DATASET_DIR / "Clean_csv" / "metadata.csv",
)
DATASET_METADATA_PATH = next((p for p in _METADATA_CANDIDATES if p.exists()), _METADATA_CANDIDATES[0])
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
    bpm_raw = metadata.get("bpm") or (metadata.get("annotations", {}).get("bpm") if isinstance(metadata.get("annotations"), dict) else None)
    bpm = float(bpm_raw) if bpm_raw not in (None, "", "None") else None

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


# Map frontend focus names to inference.py mode names
_FOCUS_TO_MODO = {
    "general": "general",
    "melodic": "melodia",
    "bpm":     "ritmo",
    "timbre":  "timbre",
}


def _rescale_similarities(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Normaliza las similitudes de los resultados para que sean legibles en la UI.

    El problema: `1/(1+d)` sobre distancias euclídeas en espacios de alta
    dimensión (1 126 features del KNN acústico) produce valores en [0.01, 0.10]
    que aparecen como "1 %–3 %" en la tarjeta de resultado. CLAP con similitud
    coseno ya produce valores en [0.50, 0.99], que son correctos.

    Solución: min-max sobre el conjunto de resultados, mapeado a [0.50, 1.00]:
    la mejor coincidencia muestra ~100 % y la peor ~50 %, dando una señal de
    calidad útil al usuario. Esta función solo se aplica a resultados KNN /
    euclidianos — los resultados CLAP (coseno, ya en rango legible) retornan
    antes de llegar aquí y no se modifican.
    """
    sims = [p["similarity"] for p in payloads if isinstance(p.get("similarity"), float)]
    if not sims:
        return payloads

    s_min, s_max = min(sims), max(sims)
    if s_max - s_min < 1e-6:
        return payloads

    for p in payloads:
        if isinstance(p.get("similarity"), float):
            # Mapeo lineal a [0.50, 1.00]
            p["similarity"] = round(0.5 + 0.5 * (p["similarity"] - s_min) / (s_max - s_min), 4)
    return payloads


def _dataset_recommendations(
    audio_path: Path,
    limit: int,
    focus: str = "general",    # valor frontend: "general" | "melodic" | "bpm" | "timbre"
    model: str = "acoustic",
) -> tuple[list[dict[str, Any]], str]:
    """
    Devuelve (payloads, engine_usado).

    `focus` se recibe en el vocabulario del frontend y se mapea UNA SOLA VEZ
    al modo interno del KNN mediante _FOCUS_TO_MODO.  No debe convertirse antes
    de llamar a esta función.
    """
    items = _get_dataset()
    if not items:
        raise RuntimeError("Dataset does not contain supported audio files")

    items_by_id = {item.audio_id: item for item in items}

    # ── CLAP: embedding semántico contra embeddings precalculados del dataset ──
    if model == "clap":
        if clap_recommend is None or not clap_available():
            # El modelo CLAP requiere torch + transformers + librosa instalados.
            # Si no están disponibles (o el hilo de carga no ha terminado),
            # lo indicamos explícitamente en lugar de silenciar la caída.
            print("[Voice2Sample] CLAP solicitado pero no disponible — usando Acoustic Search (KNN)")
        else:
            try:
                clap_results = clap_recommend(audio_path, limit=limit)
                if clap_results:
                    payloads = []
                    for r in clap_results:
                        item = items_by_id.get(r["audio_id"])
                        if item is not None:
                            payloads.append(_dataset_sound_payload(item, r["similarity"], r["distance"]))
                    if payloads:
                        print(f"[Voice2Sample] CLAP: {len(payloads)} resultados (coseno)")
                        return payloads, "clap"
            except Exception as exc:
                print(f"[Voice2Sample] CLAP error: {exc} — usando Acoustic Search (KNN)")

    # ── Essentia KNN sobre descriptores acústicos ──────────────────────────────
    # _FOCUS_TO_MODO convierte el nombre frontend al modo interno del KNN.
    # Este mapeo se hace AQUÍ y solo aquí; el endpoint pasa el focus original.
    modo = _FOCUS_TO_MODO.get(focus, "general")

    if _USE_KNN and _buscador is not None:
        try:
            knn_results = _buscador.buscar(str(audio_path), modo=modo, top_k=limit)
            payloads = []
            for r in knn_results:
                item = items_by_id.get(r["nombre"])
                if item is not None:
                    payloads.append(_dataset_sound_payload(item, r["similitud"], r["distancia"]))
            if payloads:
                print(f"[Voice2Sample] Acoustic Search KNN ({modo}): {len(payloads)} resultados")
                return _rescale_similarities(payloads), f"acoustic-knn-{modo}"
            print(f"[Voice2Sample] KNN sin coincidencias (modo={modo}), cayendo a euclídeo")
        except Exception as exc:
            print(f"[Voice2Sample] KNN error ({modo}): {exc} — cayendo a euclídeo")

    # ── Fallback: distancia euclídea sobre features de 32 dimensiones ─────────
    # rank_similar_items acepta el mismo vocabulario de focus que el frontend.
    ranked = rank_similar_items(audio_path, items, limit, focus)
    payloads = [_dataset_sound_payload(item, sim, dist) for item, dist, sim in ranked]
    return _rescale_similarities(payloads), "acoustic-euclidean"


def _dataset_map_payload(
    audio_path: Path,
    limit: int,
    focus: str = "general",
) -> dict[str, Any]:
    """
    Construye el payload del mapa de similitud del frontend.

    Cada resultado es un sonido real del dataset seleccionado por el sistema
    de similitud; las coordenadas x/y son solo la proyección PCA bidimensional
    usada para la visualización.
    """
    items = _get_dataset()
    if not items:
        raise RuntimeError("Dataset does not contain supported audio files")

    input_point, ranked_points = build_map_results(
        query_audio=audio_path,
        items=items,
        limit=limit,
        focus=focus,
    )

    results: list[dict[str, Any]] = []
    for item, distance, similarity, x, y in ranked_points:
        payload = _dataset_sound_payload(item, similarity, distance)
        payload["x"] = x
        payload["y"] = y
        results.append(payload)

    return {
        "input": input_point,
        "results": _rescale_similarities(results),
    }


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
    focus: str = Form(default="general"),
    model: str = Form(default="acoustic"),
    limit: int = Form(default=10),
) -> dict[str, Any]:
    suffix = Path(audio.filename or "input.wav").suffix or ".wav"
    limit = min(max(limit, 1), 10)
    focus = focus.lower() if focus else "general"
    model = model.lower() if model else "acoustic"

    temp_dir = UPLOAD_TMP_DIR / f"voice2sample_{uuid.uuid4().hex}"
    temp_dir.mkdir(parents=True, exist_ok=False)

    try:
        input_path = Path(temp_dir) / f"input{suffix}"

        with input_path.open("wb") as output_file:
            shutil.copyfileobj(audio.file, output_file)

        analysis_path = trim_audio_file(input_path, input_path.with_suffix(".trimmed.wav"), trim_start, trim_end)

        try:
            # focus se pasa sin convertir; _dataset_recommendations hace el mapeo una sola vez
            results, engine = _dataset_recommendations(analysis_path, limit, focus, model)
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


@app.post("/api/map-results")
async def map_results(
    audio: UploadFile = File(...),
    trim_start: float | None = Form(default=None),
    trim_end: float | None = Form(default=None),
    focus: str = Form(default="general"),
    limit: int = Form(default=50),
) -> dict[str, Any]:
    """
    Devuelve los sonidos del dataset más cercanos para el mapa interactivo.

    Endpoint separado de /api/recommendations para que las tarjetas sigan
    devolviendo solo 4 sonidos mientras el mapa puede pedir hasta 50.
    """
    suffix = Path(audio.filename or "input.wav").suffix or ".wav"
    limit = min(max(limit, 1), 50)
    focus = focus.lower() if focus else "general"

    temp_dir = UPLOAD_TMP_DIR / f"voice2sample_map_{uuid.uuid4().hex}"
    temp_dir.mkdir(parents=True, exist_ok=False)

    try:
        input_path = temp_dir / f"input{suffix}"

        with input_path.open("wb") as output_file:
            shutil.copyfileobj(audio.file, output_file)

        analysis_path = trim_audio_file(
            input_path,
            input_path.with_suffix(".trimmed.wav"),
            trim_start,
            trim_end,
        )

        try:
            map_payload = _dataset_map_payload(analysis_path, limit, focus)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Dataset map generation failed: {exc}",
            ) from exc
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return {
        "engine": "dataset-audio-descriptors",
        "projection": "pca",
        "focus": focus,
        "count": len(map_payload["results"]),
        "input": map_payload["input"],
        "results": map_payload["results"],
    }