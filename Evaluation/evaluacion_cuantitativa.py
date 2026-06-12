"""
evaluacion_cuantitativa.py
==========================
Evaluación cuantitativa comparativa — Essentia KNN vs CLAP
TFG «Voice2Sample»

Descripción
-----------
Compara dos sistemas de recuperación de audio por similitud sobre el mismo
conjunto de queries y el mismo dataset local:

  1. Essentia KNN  — 1 126 descriptores acústicos (ritmo, melodía, timbre,
                     tonalidad) extraídos con Essentia y almacenados en
                     music_all.json.  Búsqueda mediante NearestNeighbors con
                     distancia euclídea en espacio StandardScaler.
                     Similitud bruta: s = 1 / (1 + d_eucl)  ∈ (0, 1].

  2. CLAP          — embeddings semánticos de 512 dimensiones del modelo
                     laion/clap-htsat-unfused.  Búsqueda mediante similitud
                     coseno sobre vectores L2-normalizados.
                     Similitud bruta: s = cos(q, r)           ∈ [-1, 1].

Fórmulas implementadas
-----------------------

§1  Normalización Global Min-Max
    Las similitudes brutas de ambos modelos habitan escalas distintas y no
    son directamente comparables.  Se aplica normalización Min-Max *global*:
    los mínimos y máximos se calculan sobre TODAS las similitudes de TODAS
    las queries de evaluación (excepto el propio query).

        sim_norm(i) = (s(i) − s_min) / (s_max − s_min) × 100

    Resultado: sim_norm ∈ [0, 100].  Un 75 % en CLAP y un 75 % en Essentia
    significan lo mismo: «ese resultado está en el 75 % superior de la
    distribución de similitud del modelo sobre todo el dataset».

§2  Ponderación por posición — estilo NDCG
    Inspirado en Normalized Discounted Cumulative Gain (Järvelin & Kekäläinen
    2002).  Un resultado más arriba en el ranking debe contribuir más al
    score final:

        w(rank) = 1 / log₂(rank + 1)

    Tabla de pesos para Top-5:
        rank 1 → w = 1.0000   (log₂ 2 = 1)
        rank 2 → w ≈ 0.6309   (log₂ 3 ≈ 1.585)
        rank 3 → w = 0.5000   (log₂ 4 = 2)
        rank 4 → w ≈ 0.4307   (log₂ 5 ≈ 2.322)
        rank 5 → w ≈ 0.3869   (log₂ 6 ≈ 2.585)

§3  Weighted Score por query
    Promedio ponderado de las similitudes normalizadas, normalizado por la
    suma de pesos para que el resultado siga en [0, 100]:

        WS(q) = Σ_{k=1}^{K}  sim_norm(k) · w(k)
                ────────────────────────────────
                       Σ_{k=1}^{K}  w(k)

    Cuanto mayor WS, mejor combina el modelo similitud alta Y posición alta.

§4  BPM Agreement
    Fracción de los K resultados cuyo BPM está a ±tol del query:

        BPM_agr(q) = |{r ∈ Top-K : |bpm_r − bpm_q| ≤ tol}| / K  × 100

    tol = 10 BPM por defecto.

Uso
---
    python Evaluation/evaluacion_cuantitativa.py \\
        --me-json    audio_analysis/descriptors/music_all.json \\
        --models-dir audio_processing/Processing/models \\
        --clap-json  Dataset/embeddings_output.json \\
        --top-k      5 \\
        --query-ids  100270 101894 \\
        [--output-json resultados.json]

Requisitos
----------
    pip install numpy scikit-learn joblib rich
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import NamedTuple

import numpy as np
import joblib

try:
    from rich import box
    from rich.columns import Columns
    from rich.console import Console
    from rich.panel import Panel
    from rich.rule import Rule
    from rich.table import Table
    _RICH = True
except ImportError:
    _RICH = False
    print(
        "[AVISO] 'rich' no está instalado — visualización en texto plano.\n"
        "        Instala con:  pip install rich\n"
    )

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

console = Console() if _RICH else None


# ════════════════════════════════════════════════════════════════════════════
# Tipos de datos
# ════════════════════════════════════════════════════════════════════════════

class NormBounds(NamedTuple):
    """Límites globales para la normalización Min-Max (§1)."""
    lo: float   # s_min sobre todas las queries × todos los ítems (exc. self)
    hi: float   # s_max ídem


@dataclass
class TopKEntry:
    """Un resultado individual dentro de un Top-K."""
    rank:         int
    audio_id:     str
    sim_raw:      float          # similitud bruta, escala nativa del modelo
    sim_norm:     float          # similitud normalizada ∈ [0, 100]  (§1)
    pos_weight:   float          # w(rank) = 1/log2(rank+1)          (§2)
    contribution: float          # sim_norm × pos_weight              (§3)
    result_bpm:   float | None   # BPM del resultado (para BPM agr.)


@dataclass
class ModelResult:
    """Resultados completos de un modelo para una query."""
    name:           str
    top_k:          list[TopKEntry] = field(default_factory=list)
    weighted_score: float = float("nan")   # WS(q) final ∈ [0, 100]    (§3)
    bpm_agreement:  float = float("nan")   # BPM_agr(q) ∈ [0, 100]     (§4)


@dataclass
class QueryResult:
    """Resultados completos para una query concreta."""
    query_id:  str
    query_bpm: float | None
    essentia:  ModelResult
    clap:      ModelResult
    overlap:   float   # % de coincidencia entre top-K de ambos modelos


# ════════════════════════════════════════════════════════════════════════════
# Carga de datos
# ════════════════════════════════════════════════════════════════════════════

def load_me_json(path: Path) -> dict[str, dict]:
    """Lee music_all.json → {audio_id: {feature_key: float, ...}}."""
    with path.open("r", encoding="utf-8") as fh:
        raw = json.load(fh)
    return {k: v for k, v in raw.items() if isinstance(v, dict)}


def load_essentia_knn(models_dir: Path) -> tuple[object, list[str], list[str]]:
    """
    Carga el bundle Essentia KNN del directorio de modelos.

    Devuelve (scaler, meta, columnas).
    El objeto knn no se usa en la evaluación porque calculamos las distancias
    directamente sobre la matriz completa para poder normalizar globalmente.
    """
    bundle   = joblib.load(models_dir / "knn_essentia.joblib")
    meta     = list(joblib.load(models_dir / "meta_essentia.joblib"))
    columnas = list(joblib.load(models_dir / "columnas_essentia.joblib"))
    return bundle["scaler"], meta, columnas


def load_clap_index(path: Path) -> tuple[list[str], np.ndarray]:
    """
    Lee embeddings_output.json y devuelve (ids, matriz).

    Los vectores se L2-normalizan para que el producto escalar sea
    equivalente a la similitud coseno:  cos(a,b) = aᵀb  si ‖a‖=‖b‖=1.
    """
    with path.open("r", encoding="utf-8") as fh:
        raw = json.load(fh)
    ids, vecs = [], []
    for item in raw.get("items", []):
        p = item.get("path") or item.get("ruta")
        e = item.get("embedding")
        if p and e is not None:
            ids.append(Path(p).stem)
            vecs.append(np.array(e, dtype=np.float32))
    if not vecs:
        raise ValueError(f"No se encontraron embeddings en {path}")
    mat   = np.vstack(vecs)
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    mat   = mat / np.where(norms < 1e-9, 1.0, norms)
    return ids, mat


def build_essentia_matrix(
    me_json:  dict[str, dict],
    meta:     list[str],
    columnas: list[str],
    scaler,
) -> np.ndarray:
    """
    Construye la matriz estandarizada (N × D) de Essentia sobre todos los
    ítems del meta.  Necesaria para calcular distancias globales (§1).
    """
    N, D = len(meta), len(columnas)
    mat  = np.zeros((N, D), dtype=np.float32)
    for i, aid in enumerate(meta):
        rec = me_json.get(aid, {})
        for j, col in enumerate(columnas):
            v = rec.get(col)
            if v is not None:
                try:
                    fv = float(v)
                    if math.isfinite(fv):
                        mat[i, j] = fv
                except (TypeError, ValueError):
                    pass
    return scaler.transform(mat).astype(np.float32)


# ════════════════════════════════════════════════════════════════════════════
# Cálculo de similitudes — vectores completos (para normalización global)
# ════════════════════════════════════════════════════════════════════════════

def essentia_all_similarities(
    query_id:   str,
    me_json:    dict[str, dict],
    ess_mat:    np.ndarray,
    meta:       list[str],
    columnas:   list[str],
    scaler,
) -> tuple[np.ndarray, int]:
    """
    Calcula s = 1/(1+d_eucl) entre el query y TODOS los ítems del dataset.

    Devuelve (array_similitudes, índice_del_query_en_meta).
    s ∈ (0, 1] — cuanto mayor, más cercano.
    """
    rec    = me_json.get(query_id, {})
    qvec   = np.zeros(len(columnas), dtype=np.float32)
    for j, col in enumerate(columnas):
        v = rec.get(col)
        if v is not None:
            try:
                fv = float(v)
                if math.isfinite(fv):
                    qvec[j] = fv
            except (TypeError, ValueError):
                pass
    qvec_s = scaler.transform(qvec.reshape(1, -1)).astype(np.float32)

    # Distancia euclídea a todos los ítems de la matriz estandarizada
    dists = np.linalg.norm(ess_mat - qvec_s, axis=1)
    sims  = 1.0 / (1.0 + dists)                         # s = 1/(1+d)

    q_idx = meta.index(query_id) if query_id in meta else -1
    return sims.astype(np.float32), q_idx


def clap_all_similarities(
    query_id:  str,
    clap_ids:  list[str],
    clap_mat:  np.ndarray,
) -> tuple[np.ndarray, int]:
    """
    Calcula cos(q, r) = qᵀr (vecs L2-norm.) entre el query y TODOS los ítems.

    Devuelve (array_similitudes, índice_del_query_en_clap_ids).
    s ∈ [-1, 1] — en la práctica ~ [0.3, 0.99] para audio.
    """
    if query_id not in clap_ids:
        return np.zeros(len(clap_ids), dtype=np.float32), -1
    q_idx = clap_ids.index(query_id)
    sims  = (clap_mat @ clap_mat[q_idx]).astype(np.float32)
    return sims, q_idx


# ════════════════════════════════════════════════════════════════════════════
# Normalización y métricas
# ════════════════════════════════════════════════════════════════════════════

def global_norm_bounds(
    sim_arrays: list[np.ndarray],
    exclude_indices: list[int],
) -> NormBounds:
    """
    Calcula los límites globales Min-Max para normalización (§1).

    Recorre todos los arrays de similitud de todas las queries (excluyendo
    el propio query de cada una) y devuelve (s_min_global, s_max_global).
    """
    all_vals: list[float] = []
    for arr, excl in zip(sim_arrays, exclude_indices):
        mask = np.ones(len(arr), dtype=bool)
        if 0 <= excl < len(arr):
            mask[excl] = False
        all_vals.extend(arr[mask].tolist())
    if not all_vals:
        return NormBounds(0.0, 1.0)
    return NormBounds(float(min(all_vals)), float(max(all_vals)))


def minmax_normalize(sim: float, bounds: NormBounds) -> float:
    """
    Aplica la normalización Min-Max global a una similitud individual (§1):

        sim_norm = (s − s_min) / (s_max − s_min) × 100
    """
    rng = bounds.hi - bounds.lo
    if rng < 1e-9:
        return 50.0
    return float(np.clip((sim - bounds.lo) / rng * 100.0, 0.0, 100.0))


def ndcg_weight(rank: int) -> float:
    """
    Peso de posición estilo NDCG (§2):

        w(rank) = 1 / log₂(rank + 1)

    rank debe ser ≥ 1.
    """
    return 1.0 / math.log2(rank + 1)


def weighted_score(norm_sims: list[float]) -> float:
    """
    Weighted Score ponderado por posición (§3):

        WS = Σ_{k=1}^{K} sim_norm(k) · w(k)
             ─────────────────────────────────
                    Σ_{k=1}^{K} w(k)

    Resultado ∈ [0, 100].
    """
    if not norm_sims:
        return float("nan")
    weights = [ndcg_weight(k + 1) for k in range(len(norm_sims))]
    return float(
        sum(s * w for s, w in zip(norm_sims, weights)) / sum(weights)
    )


def bpm_agreement(
    query_bpm:   float | None,
    result_ids:  list[str],
    me_json:     dict[str, dict],
    tol:         float = 10.0,
) -> float:
    """
    BPM Agreement (§4): % de resultados con |bpm_r − bpm_q| ≤ tol.
    """
    if query_bpm is None or not result_ids:
        return float("nan")
    bpms  = [_bpm(i, me_json) for i in result_ids]
    valid = [b for b in bpms if b is not None]
    if not valid:
        return float("nan")
    close = sum(1 for b in valid if abs(b - query_bpm) <= tol)
    return round(close / len(valid) * 100, 1)


def topk_overlap(ids_a: list[str], ids_b: list[str]) -> float:
    if not ids_a or not ids_b:
        return 0.0
    return round(len(set(ids_a) & set(ids_b)) / max(len(ids_a), len(ids_b)) * 100, 1)


def _bpm(audio_id: str, me_json: dict) -> float | None:
    v = me_json.get(audio_id, {}).get("rhythm.bpm")
    if v is not None:
        try:
            fv = float(v)
            return fv if math.isfinite(fv) else None
        except (TypeError, ValueError):
            pass
    return None


# ════════════════════════════════════════════════════════════════════════════
# Evaluación principal (dos pasadas)
# ════════════════════════════════════════════════════════════════════════════

def evaluate(
    me_json:    dict[str, dict],
    scaler,
    ess_mat:    np.ndarray,
    meta:       list[str],
    columnas:   list[str],
    clap_ids:   list[str],
    clap_mat:   np.ndarray,
    query_ids:  list[str],
    top_k:      int,
) -> list[QueryResult]:
    """
    Pasada 1 — calcula similitudes completas y acumula para normalización.
    Pasada 2 — normaliza, pondera y construye los QueryResult.
    """
    # ── Pasada 1: similitudes brutas completas ──────────────────────────────
    raw: dict[str, dict] = {}
    ess_sim_arrs, ess_exc_idxs   = [], []
    clap_sim_arrs, clap_exc_idxs = [], []

    for qid in query_ids:
        e_sims, e_idx = essentia_all_similarities(qid, me_json, ess_mat, meta, columnas, scaler)
        c_sims, c_idx = clap_all_similarities(qid, clap_ids, clap_mat)
        raw[qid]      = {"e": e_sims, "ei": e_idx, "c": c_sims, "ci": c_idx}
        ess_sim_arrs.append(e_sims);  ess_exc_idxs.append(e_idx)
        clap_sim_arrs.append(c_sims); clap_exc_idxs.append(c_idx)

    # ── Límites globales Min-Max (§1) ───────────────────────────────────────
    ess_bounds  = global_norm_bounds(ess_sim_arrs,  ess_exc_idxs)
    clap_bounds = global_norm_bounds(clap_sim_arrs, clap_exc_idxs)

    # ── Pasada 2: construye resultados normalizados ─────────────────────────
    results: list[QueryResult] = []

    for qid in query_ids:
        q_bpm  = _bpm(qid, me_json)
        e_sims = raw[qid]["e"];  e_idx = raw[qid]["ei"]
        c_sims = raw[qid]["c"];  c_idx = raw[qid]["ci"]

        ess_res  = _build_model_result("Essentia KNN", e_sims, e_idx, meta,     ess_bounds,  top_k, me_json, q_bpm)
        clap_res = _build_model_result("CLAP",         c_sims, c_idx, clap_ids, clap_bounds, top_k, me_json, q_bpm)

        results.append(QueryResult(
            query_id  = qid,
            query_bpm = q_bpm,
            essentia  = ess_res,
            clap      = clap_res,
            overlap   = topk_overlap(
                [e.audio_id for e in ess_res.top_k],
                [e.audio_id for e in clap_res.top_k],
            ),
        ))

    return results


def _build_model_result(
    name:     str,
    sims_all: np.ndarray,
    q_idx:    int,
    ids:      list[str],
    bounds:   NormBounds,
    top_k:    int,
    me_json:  dict[str, dict],
    q_bpm:    float | None,
) -> ModelResult:
    """Construye un ModelResult completo para un modelo y una query."""
    sims = sims_all.copy()
    if 0 <= q_idx < len(sims):
        sims[q_idx] = -np.inf          # excluye el propio query

    top_indices = np.argsort(sims)[::-1][:top_k]

    entries: list[TopKEntry] = []
    for rank, idx in enumerate(top_indices, start=1):
        sim_raw  = float(sims_all[idx])
        sim_norm = minmax_normalize(sim_raw, bounds)
        w        = ndcg_weight(rank)               # w(rank) = 1/log₂(rank+1)
        entries.append(TopKEntry(
            rank         = rank,
            audio_id     = ids[idx],
            sim_raw      = round(sim_raw, 4),
            sim_norm     = round(sim_norm, 2),
            pos_weight   = round(w, 4),
            contribution = round(sim_norm * w, 4),
            result_bpm   = _bpm(ids[idx], me_json),
        ))

    norm_sims = [e.sim_norm for e in entries]
    ws  = weighted_score(norm_sims)
    bpm = bpm_agreement(q_bpm, [e.audio_id for e in entries], me_json)

    return ModelResult(
        name           = name,
        top_k          = entries,
        weighted_score = round(ws,  2),
        bpm_agreement  = bpm,
    )


# ════════════════════════════════════════════════════════════════════════════
# Visualización — Rich
# ════════════════════════════════════════════════════════════════════════════

def _pct(v: float | None) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "N/A"
    return f"{v:.1f} %"


def _bar(v: float | None, width: int = 12) -> str:
    """Barra ASCII proporcional para mostrar % de forma visual."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "─" * width
    filled = max(0, min(width, round(v / 100 * width)))
    return "█" * filled + "░" * (width - filled)


def _model_table(mr: ModelResult) -> Table:
    """Crea una tabla Rich con el detalle del Top-K de un modelo."""
    color = "cyan" if "CLAP" in mr.name else "green"
    tbl = Table(
        title=f"[bold {color}]{mr.name}[/]",
        box=box.SIMPLE_HEAD,
        show_footer=True,
        pad_edge=False,
        title_style=f"bold {color}",
    )
    tbl.add_column("Rank",      justify="center", style="bold", width=5)
    tbl.add_column("Audio ID",  justify="left",   width=10)
    tbl.add_column("Sim. norm.  (0-100%)", justify="right", width=14,
                   footer=f"[bold]WS = {mr.weighted_score:.1f}[/]")
    tbl.add_column("Barra",     justify="left",   width=14)
    tbl.add_column("W(pos)",    justify="right",  width=7)
    tbl.add_column("Contrib.",  justify="right",  width=9,
                   footer=f"[bold]BPM = {_pct(mr.bpm_agreement)}[/]")

    for e in mr.top_k:
        bpm_tag = (
            f"  [dim]{e.result_bpm:.0f} bpm[/]"
            if e.result_bpm is not None else ""
        )
        tbl.add_row(
            f"#{e.rank}",
            f"{e.audio_id}{bpm_tag}",
            f"{e.sim_norm:.2f} %",
            f"[{color}]{_bar(e.sim_norm)}[/]",
            f"{e.pos_weight:.4f}",
            f"{e.contribution:.2f}",
        )

    return tbl


def display_query(qr: QueryResult) -> None:
    """Muestra el panel completo de una query (tablas lado a lado)."""
    if not _RICH:
        _plain_query(qr)
        return

    bpm_str = f"{qr.query_bpm:.0f} BPM" if qr.query_bpm else "BPM desconocido"
    header  = (
        f"[bold yellow]Query:[/] [white]{qr.query_id}[/]   "
        f"[bold yellow]BPM:[/] {bpm_str}   "
        f"[bold yellow]Overlap:[/] {qr.overlap:.1f} %"
    )

    t_ess  = _model_table(qr.essentia)
    t_clap = _model_table(qr.clap)

    console.print(Rule(f"[bold]{qr.query_id}[/]"))
    console.print(Panel(header, padding=(0, 1)))
    console.print(Columns([t_ess, t_clap], equal=True, expand=True))


def display_leaderboard(results: list[QueryResult]) -> None:
    """Muestra la tabla resumen global y el veredicto final."""
    if not _RICH:
        _plain_leaderboard(results)
        return

    def _avg(vals: list) -> float:
        clean = [v for v in vals if v is not None and not (isinstance(v, float) and math.isnan(v))]
        return sum(clean) / len(clean) if clean else float("nan")

    ess_ws  = _avg([r.essentia.weighted_score for r in results])
    clap_ws = _avg([r.clap.weighted_score     for r in results])
    ess_bpm = _avg([r.essentia.bpm_agreement  for r in results])
    clap_bpm= _avg([r.clap.bpm_agreement      for r in results])
    ovlp    = _avg([r.overlap                 for r in results])

    # ── Tabla Leaderboard ──────────────────────────────────────────────────
    lb = Table(
        title="[bold white]🏆  LEADERBOARD GLOBAL[/]",
        box=box.DOUBLE_EDGE,
        title_style="bold white",
        show_header=True,
        header_style="bold",
    )
    lb.add_column("Métrica",        style="dim",   width=26)
    lb.add_column("Essentia KNN",   justify="center", style="green",  width=14)
    lb.add_column("CLAP",           justify="center", style="cyan",   width=14)
    lb.add_column("Ganador",        justify="center", width=14)

    def _row(label: str, ev: float, cv: float, pct: bool = True) -> None:
        fmt   = (lambda x: f"{x:.1f} %" ) if pct else (lambda x: f"{x:.2f}")
        win   = "[bold green]Essentia ★[/]" if ev >= cv else "[bold cyan]CLAP ★[/]"
        if math.isnan(ev) or math.isnan(cv):
            win = "─"
        lb.add_row(label, fmt(ev) if not math.isnan(ev) else "N/A",
                          fmt(cv) if not math.isnan(cv) else "N/A", win)

    _row("Weighted Score (WS)",  ess_ws,  clap_ws,  pct=False)
    _row("BPM Agreement ±10",    ess_bpm, clap_bpm, pct=True)
    lb.add_row("Overlap medio", f"{ovlp:.1f} %", f"{ovlp:.1f} %", "─",
               style="dim")

    # ── Tabla por query (resumen) ──────────────────────────────────────────
    pq = Table(box=box.SIMPLE, title="[bold]Desglose por query[/]",
               title_style="bold", show_header=True, header_style="bold")
    pq.add_column("Query",     width=10)
    pq.add_column("BPM",       justify="center", width=6)
    pq.add_column("WS Ess.",   justify="right",  width=9, style="green")
    pq.add_column("WS CLAP",   justify="right",  width=9, style="cyan")
    pq.add_column("BPM Ess.",  justify="right",  width=9, style="green")
    pq.add_column("BPM CLAP",  justify="right",  width=9, style="cyan")
    pq.add_column("Overlap",   justify="right",  width=9)
    pq.add_column("WS Ganador",justify="center", width=12)

    for r in results:
        ew  = r.essentia.weighted_score
        cw  = r.clap.weighted_score
        win = "[bold cyan]CLAP[/]" if cw > ew else "[bold green]Essentia[/]"
        pq.add_row(
            r.query_id,
            f"{r.query_bpm:.0f}" if r.query_bpm else "?",
            f"{ew:.2f}", f"{cw:.2f}",
            _pct(r.essentia.bpm_agreement), _pct(r.clap.bpm_agreement),
            f"{r.overlap:.0f} %", win,
        )

    # ── Veredicto ──────────────────────────────────────────────────────────
    lines: list[str] = []

    if not (math.isnan(ess_ws) or math.isnan(clap_ws)):
        lead = "CLAP" if clap_ws >= ess_ws else "Essentia KNN"
        diff = abs(clap_ws - ess_ws)
        lines.append(
            f"[bold]Búsqueda general:[/]  [bold cyan]{lead}[/] gana en Weighted Score "
            f"([bold]{max(ess_ws,clap_ws):.2f}[/] vs {min(ess_ws,clap_ws):.2f},  Δ = +{diff:.2f})"
        )

    if not (math.isnan(ess_bpm) or math.isnan(clap_bpm)):
        lead_b = "Essentia KNN" if ess_bpm >= clap_bpm else "CLAP"
        diff_b = abs(ess_bpm - clap_bpm)
        color_b = "green" if lead_b == "Essentia KNN" else "cyan"
        lines.append(
            f"[bold]Precisión de tempo:[/]  [bold {color_b}]{lead_b}[/] gana en BPM Agreement "
            f"([bold]{max(ess_bpm,clap_bpm):.1f} %[/] vs {min(ess_bpm,clap_bpm):.1f} %,  Δ = +{diff_b:.1f} %)"
        )

    if not math.isnan(ovlp):
        comp = (
            "complementarios (bajo overlap → recomendaciones distintas → combinarlos es óptimo)"
            if ovlp < 30
            else "con acuerdo moderado"
        )
        lines.append(f"[bold]Complementariedad:[/]  Overlap {ovlp:.0f} %  → los modelos son {comp}")

    console.print()
    console.print(Rule("[bold white]RESULTADOS GLOBALES[/]"))
    console.print(lb)
    console.print()
    console.print(pq)
    console.print()
    console.print(Panel(
        "\n".join(lines),
        title="[bold white]VEREDICTO FINAL[/]",
        border_style="yellow",
        padding=(1, 2),
    ))
    console.print()


# ════════════════════════════════════════════════════════════════════════════
# Fallback texto plano (sin rich)
# ════════════════════════════════════════════════════════════════════════════

def _plain_query(qr: QueryResult) -> None:
    W = 70
    bpm_s = f"{qr.query_bpm:.0f} BPM" if qr.query_bpm else "BPM ?"
    print(f"\n{'═'*W}")
    print(f"  Query: {qr.query_id}  │  {bpm_s}  │  Overlap: {qr.overlap:.1f}%")
    print(f"{'─'*W}")
    for mr in (qr.essentia, qr.clap):
        print(f"  {mr.name}   WS={mr.weighted_score:.2f}   BPM_agr={_pct(mr.bpm_agreement)}")
        print(f"  {'Rank':<5} {'Audio ID':<12} {'Sim.norm%':>10} {'W(pos)':>8} {'Contrib.':>10}")
        for e in mr.top_k:
            print(f"  #{e.rank:<4} {e.audio_id:<12} {e.sim_norm:>9.2f}%  {e.pos_weight:>7.4f}  {e.contribution:>10.4f}")
        print()


def _plain_leaderboard(results: list[QueryResult]) -> None:
    def _avg(vals: list) -> float:
        c = [v for v in vals if v is not None and not (isinstance(v, float) and math.isnan(v))]
        return sum(c) / len(c) if c else float("nan")

    ess_ws  = _avg([r.essentia.weighted_score for r in results])
    clap_ws = _avg([r.clap.weighted_score     for r in results])
    ess_bpm = _avg([r.essentia.bpm_agreement  for r in results])
    clap_bpm= _avg([r.clap.bpm_agreement      for r in results])
    ovlp    = _avg([r.overlap                 for r in results])

    W = 70
    print(f"\n{'═'*W}")
    print("  LEADERBOARD GLOBAL")
    print(f"{'─'*W}")
    print(f"  {'Métrica':<26} {'Essentia KNN':>14} {'CLAP':>14} {'Ganador':>12}")
    print(f"  {'Weighted Score':26} {ess_ws:>13.2f}  {clap_ws:>13.2f}  {'CLAP' if clap_ws>ess_ws else 'Essentia':>12}")
    print(f"  {'BPM Agreement ±10':26} {_pct(ess_bpm):>14} {_pct(clap_bpm):>14}  {'CLAP' if clap_bpm>ess_bpm else 'Essentia':>12}")
    print(f"  {'Overlap medio':26} {ovlp:>13.1f}%")
    print(f"{'═'*W}")


# ════════════════════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluación cuantitativa Essentia KNN vs CLAP — Voice2Sample TFG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--me-json",    required=True,
        help="JSON de Essentia Music Extractor, ej. music_all.json  "
             "Formato: {audio_id: {feature.key: float, ...}}"
    )
    parser.add_argument(
        "--models-dir", required=True,
        help="Directorio con knn_essentia.joblib, meta_essentia.joblib, "
             "columnas_essentia.joblib"
    )
    parser.add_argument(
        "--clap-json",  required=True,
        help="JSON de embeddings CLAP, ej. embeddings_output.json  "
             'Formato: {"items": [{"path": "...", "embedding": [...]}, ...]}'
    )
    parser.add_argument("--top-k",       type=int,    default=5)
    parser.add_argument(
        "--query-ids",  nargs="+",       default=None,
        help="IDs de los audios query. Si se omite, se usan los 5 primeros "
             "comunes a ambos modelos."
    )
    parser.add_argument(
        "--output-json", default=None,
        help="Ruta opcional para guardar los resultados en JSON."
    )
    args = parser.parse_args()

    # ── Carga ──────────────────────────────────────────────────────────────
    if _RICH:
        console.print(Rule("[bold]Voice2Sample — Evaluación Cuantitativa[/]"))

    print("Cargando music_all.json  (--me-json)...")
    me_json = load_me_json(Path(args.me_json))
    print(f"  {len(me_json)} audios.")

    print("Cargando modelos Essentia KNN  (--models-dir)...")
    scaler, meta, columnas = load_essentia_knn(Path(args.models_dir))
    print(f"  {len(meta)} audios  |  {len(columnas)} features.")

    print("Construyendo matriz Essentia estandarizada...")
    ess_mat = build_essentia_matrix(me_json, meta, columnas, scaler)
    print(f"  Matriz: {ess_mat.shape[0]} × {ess_mat.shape[1]}")

    print("Cargando embeddings CLAP  (--clap-json)...")
    clap_ids, clap_mat = load_clap_index(Path(args.clap_json))
    print(f"  {len(clap_ids)} embeddings  |  {clap_mat.shape[1]} dims.")

    # ── IDs comunes ────────────────────────────────────────────────────────
    common = sorted(set(me_json) & set(meta) & set(clap_ids))
    print(f"\n  IDs comunes a ambos modelos: {len(common)}")

    query_ids = args.query_ids if args.query_ids else common[:5]
    query_ids = [q for q in query_ids if q in set(common)]
    if not query_ids:
        print("[ERROR] Ningún query_id encontrado en ambos modelos.")
        sys.exit(1)

    print(f"  Queries:  {query_ids}")
    print(f"  Top-K:    {args.top_k}\n")

    # ── Evaluación ─────────────────────────────────────────────────────────
    results = evaluate(
        me_json   = me_json,
        scaler    = scaler,
        ess_mat   = ess_mat,
        meta      = meta,
        columnas  = columnas,
        clap_ids  = clap_ids,
        clap_mat  = clap_mat,
        query_ids = query_ids,
        top_k     = args.top_k,
    )

    # ── Visualización ───────────────────────────────────────────────────────
    for qr in results:
        display_query(qr)

    display_leaderboard(results)

    # ── Exportar JSON ───────────────────────────────────────────────────────
    if args.output_json:
        import dataclasses
        out = Path(args.output_json)
        out.write_text(
            json.dumps([dataclasses.asdict(r) for r in results],
                       indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Resultados guardados en: {out}")


if __name__ == "__main__":
    main()
