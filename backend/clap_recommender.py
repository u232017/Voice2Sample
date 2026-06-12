"""
clap_recommender.py
-------------------
Motor de búsqueda por embeddings CLAP para Voice2Sample.

Carga el modelo CLAP una sola vez al arrancar uvicorn, extrae el embedding
del audio de usuario en tiempo real y lo compara contra los embeddings del
dataset precalculados en embeddings_output.json.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parents[1]
EMBEDDINGS_PATH = ROOT_DIR / "Dataset" / "embeddings_output.json"
CLAP_MODEL_NAME = "laion/clap-htsat-unfused"

# ── Estado global (se inicializa una vez al arrancar) ──────────────────────
_clap_model = None
_clap_processor = None
_dataset_embeddings: np.ndarray | None = None  # shape (N, D)
_dataset_ids: list[str] = []
_USE_CLAP = False


def init_clap() -> bool:
    """Carga el modelo CLAP y los embeddings del dataset. Llamar al arrancar."""
    global _clap_model, _clap_processor, _dataset_embeddings, _dataset_ids, _USE_CLAP

    # 1. Cargar embeddings del dataset
    if not EMBEDDINGS_PATH.exists():
        logger.warning("[CLAP] embeddings_output.json no encontrado en %s", EMBEDDINGS_PATH)
        return False

    with EMBEDDINGS_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    items = data.get("items", [])
    if not items:
        logger.warning("[CLAP] embeddings_output.json vacío")
        return False

    _dataset_ids = [Path(item["path"]).stem for item in items]
    _dataset_embeddings = np.array([item["embedding"] for item in items], dtype=np.float32)

    # Normalizar para usar similitud coseno via producto escalar
    norms = np.linalg.norm(_dataset_embeddings, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1e-9, norms)
    _dataset_embeddings = _dataset_embeddings / norms

    logger.info("[CLAP] %d embeddings cargados del dataset", len(_dataset_ids))

    # 2. Cargar modelo CLAP
    try:
        import torch
        from transformers import ClapModel, ClapProcessor

        _clap_processor = ClapProcessor.from_pretrained(CLAP_MODEL_NAME)
        _clap_model = ClapModel.from_pretrained(CLAP_MODEL_NAME)
        _clap_model.eval()
        _USE_CLAP = True
        logger.info("[CLAP] Modelo %s cargado correctamente", CLAP_MODEL_NAME)
        return True
    except Exception as exc:
        logger.warning("[CLAP] No se pudo cargar el modelo CLAP: %s", exc)
        logger.warning("[CLAP] Instala: pip install torch transformers")
        _USE_CLAP = False
        return False


def _extract_embedding(audio_path: Path) -> np.ndarray | None:
    """Extrae el embedding CLAP de un archivo de audio. Devuelve array (D,) o None."""
    if not _USE_CLAP or _clap_model is None:
        return None

    try:
        import librosa
        import torch

        audio, sr = librosa.load(str(audio_path), sr=48000, mono=True)
        # transformers renombró el kwarg `audios=` a `audio=` (las versiones
        # nuevas lanzan error con el nombre antiguo). Detectamos cuál acepta
        # la versión instalada inspeccionando la firma del processor.
        import inspect
        params = inspect.signature(_clap_processor.__call__).parameters
        audio_kwarg = "audio" if "audio" in params else "audios"
        inputs = _clap_processor(**{audio_kwarg: audio}, sampling_rate=sr, return_tensors="pt")

        with torch.no_grad():
            output = _clap_model.get_audio_features(**inputs)

        # transformers >= 5 devuelve BaseModelOutputWithPooling con el embedding
        # proyectado y L2-normalizado en .pooler_output; en 4.x es el tensor directo.
        embedding = output.pooler_output if hasattr(output, "pooler_output") else output
        emb = embedding.squeeze().cpu().numpy().astype(np.float32)
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        return emb

    except Exception as exc:
        logger.error("[CLAP] Error extrayendo embedding: %s", exc)
        return None


def clap_recommend(audio_path: Path, limit: int = 4) -> list[dict[str, Any]] | None:
    """
    Busca los `limit` sonidos más similares usando embeddings CLAP.

    Devuelve lista de dicts con {audio_id, similarity, distance}
    o None si CLAP no está disponible.
    """
    if not _USE_CLAP or _dataset_embeddings is None:
        return None

    emb = _extract_embedding(audio_path)
    if emb is None:
        return None

    # Similitud coseno (embeddings ya normalizados)
    similarities = _dataset_embeddings @ emb  # shape (N,)
    top_indices = np.argsort(similarities)[::-1][:limit]

    results = []
    for idx in top_indices:
        sim = float(similarities[idx])
        results.append({
            "audio_id": _dataset_ids[idx],
            "similarity": round(sim, 4),
            "distance": round(1.0 - sim, 4),
        })

    return results


def is_available() -> bool:
    return _USE_CLAP and _dataset_embeddings is not None