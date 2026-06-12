"""
Evaluador end-to-end para Voice2Sample.

Flujo:
1. Toma un audio de entrada.
2. Calcula el top-10 de audios del dataset con CLAP.
3. Genera una query de Freesound a partir del audio.
4. Busca en Freesound y filtra solo los resultados que existen en nuestro dataset.
5. Guarda un resumen JSON con ambos rankings.

Uso:
    python Evaluation/evaluate_clap_freesound_dataset.py
    python Evaluation/evaluate_clap_freesound_dataset.py --audio Dataset/audio_processed/100270.wav
    python Evaluation/evaluate_clap_freesound_dataset.py --focus bpm --output Evaluation/clap_freesound_report.json
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import numpy as np


DEFAULT_FREESOUND_BASE_URL = "https://freesound.org/apiv2"
DEFAULT_SEARCH_PAGE_SIZE = 50
DEFAULT_TARGET_RESULTS = 10
FREESOUND_FIELDS = [
    "id",
    "name",
    "username",
    "duration",
    "tags",
    "previews",
    "images",
    "url",
    "license",
    "description",
    "created",
    "num_downloads",
    "avg_rating",
    "num_ratings",
    "num_comments",
    "samplerate",
    "channels",
    "bitrate",
]


def _load_env_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}

    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value

    return values


def _resolve_freesound_token(default_value: str, repo_root: Path) -> str:
    if default_value.strip():
        return default_value.strip()

    # Prefer the interface's .env.local (frontend/.env.local) if present,
    # otherwise fall back to repository root .env
    interface_env = repo_root / "frontend" / ".env.local"
    if interface_env.exists():
        env_values = _load_env_file(interface_env)
    else:
        env_values = _load_env_file(repo_root / ".env")

    token = env_values.get("FREESOUND_API_KEY") or env_values.get("VITE_FREESOUND_API_KEY")
    return token.strip() if token else ""


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _load_freesound_query_helpers():
    module = importlib.import_module("Evaluation.evaluate_essentia_query")
    return module.extract_descriptors, module.create_query, module._read_audio_mono  # type: ignore[attr-defined]


def _load_clap_helpers():
    repo_root = _repo_root()
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    module = importlib.import_module("search_engines.CLAP.run_search_with_json")
    return module


def _build_dataset_index(embeddings_json: Path) -> dict[str, str]:
    clap_module = _load_clap_helpers()
    rutas, _ = clap_module.cargar_embeddings_json(str(embeddings_json))

    dataset_index: dict[str, str] = {}
    for path in rutas:
        dataset_index[Path(path).stem] = str(path)
    return dataset_index


def _normalize_api_base(url: str) -> str:
    return url.rstrip("/").replace("/api/v2", "/apiv2")


def _search_freesound(
    query: str,
    api_key: str,
    base_url: str,
    page_size: int,
    page: int,
) -> dict[str, Any]:
    params = {
        "query": query,
        "token": api_key,
        "page_size": page_size,
        "page": page,
        "fields": ",".join(FREESOUND_FIELDS),
        "sort": "score",
    }
    # Try the text search endpoint first, fall back to the generic search path on 404
    candidates = ["/search/text/", "/search/"]
    last_err: Exception | None = None

    for suffix in candidates:
        url = f"{base_url}{suffix}?{urlencode(params)}"
        request = Request(url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

        try:
            with urlopen(request, timeout=20) as response:
                payload = response.read().decode("utf-8")
            return json.loads(payload)
        except HTTPError as he:
            # Log debug info for the failing request
            try:
                err_body = he.read().decode("utf-8", errors="ignore")
            except Exception:
                err_body = ""
            # Do not spam with 404 debug messages; only report non-404 errors
            last_err = he
            if he.code == 404:
                continue
            print(f"Freesound HTTPError {he.code} for URL: {url}")
            if err_body:
                print(f"Response body: {err_body[:1000]}")
            raise

    # If all attempts failed, raise the last HTTPError
    if isinstance(last_err, Exception):
        raise last_err
    raise RuntimeError("Failed to build Freesound search request")


def _generate_freesound_query(audio_path: Path, focus: str) -> tuple[str, dict[str, Any]]:
    extract_descriptors, create_query, read_audio_mono = _load_freesound_query_helpers()
    audio, sample_rate = read_audio_mono(audio_path)
    duration = float(len(audio) / sample_rate) if sample_rate else 0.0
    descriptors = extract_descriptors(audio, sample_rate, duration)
    query = create_query(descriptors, focus)
    return query, descriptors.__dict__


def _rank_dataset_with_clap(audio_path: Path, embeddings_json: Path, top_k: int) -> list[dict[str, Any]]:
    clap_module = _load_clap_helpers()
    rutas, emb_matrix = clap_module.cargar_embeddings_json(str(embeddings_json))
    return clap_module.buscar_similares(str(audio_path), rutas, emb_matrix, k=top_k)


def _collect_freesound_matches(
    query: str,
    api_key: str,
    base_url: str,
    dataset_index: dict[str, str],
    target_results: int,
    page_size: int,
    max_pages: int,
    exact_name_stem: str | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    filtered: list[dict[str, Any]] = []
    raw_results: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    page = 1
    while True:
        response = _search_freesound(query, api_key, base_url, page_size=page_size, page=page)
        page_results = response.get("results", [])
        if not isinstance(page_results, list) or not page_results:
            break

        for item in page_results:
            if not isinstance(item, dict):
                continue

            sound_id = str(item.get("id", "")).strip()
            if not sound_id:
                continue

            if sound_id in seen_ids:
                continue
            seen_ids.add(sound_id)

            raw_results.append(item)

            matched = False
            if sound_id in dataset_index:
                filtered.append(
                    {
                        "rank": len(filtered) + 1,
                        "id": int(sound_id) if sound_id.isdigit() else sound_id,
                        "dataset_path": dataset_index[sound_id],
                        "name": item.get("name"),
                        "username": item.get("username"),
                        "url": item.get("url"),
                        "tags": item.get("tags", []),
                        "previews": item.get("previews", {}),
                        "similarity_score": item.get("score"),
                        "license": item.get("license"),
                        "exact_name_match": False,
                    }
                )
                matched = True

            # If not matched by id, optionally check for exact name match (filename stem)
            if (not matched) and exact_name_stem:
                try:
                    fs_name = str(item.get("name", "")).lower()
                    name_stem = fs_name.rsplit('.', 1)[0]
                    if name_stem.strip() == str(exact_name_stem).lower().strip():
                        filtered.append(
                            {
                                "rank": len(filtered) + 1,
                                "id": int(sound_id) if sound_id.isdigit() else sound_id,
                                "dataset_path": dataset_index.get(sound_id) if sound_id in dataset_index else None,
                                "name": item.get("name"),
                                "username": item.get("username"),
                                "url": item.get("url"),
                                "tags": item.get("tags", []),
                                "previews": item.get("previews", {}),
                                "similarity_score": item.get("score"),
                                "license": item.get("license"),
                                "exact_name_match": True,
                            }
                        )
                        if len(filtered) >= target_results:
                            return filtered, raw_results
                        matched = True
                except Exception:
                    pass

            if matched and len(filtered) >= target_results:
                return filtered, raw_results

        # stop if we've reached the desired number of matches
        if len(filtered) >= target_results:
            return filtered, raw_results

        # advance page; if max_pages > 0 enforce the cap
        page += 1
        if max_pages and page > max_pages:
            break

    return filtered, raw_results


def _fetch_top_n_freesound(query: str, api_key: str, base_url: str, n: int) -> list[dict[str, Any]]:
    """Return the raw top-n Freesound results for the given query (best-effort)."""
    if n <= 0:
        return []
    page_size = min(max(n, 1), 200)
    try:
        response = _search_freesound(query, api_key, base_url, page_size=page_size, page=1)
    except Exception:
        return []

    results = response.get("results", [])
    return results[:n]


def _fetch_similar_sounds(sound_id: str, api_key: str, base_url: str, n: int) -> list[dict[str, Any]]:
    """Fetch 'find similars' results for a given Freesound sound id via API endpoints.

    Tries a couple of plausible endpoints and returns a list of sound dicts.
    """
    candidates = [f"/sounds/{sound_id}/similar/", f"/sounds/{sound_id}/similar_sounds/"]
    params = {"token": api_key, "fields": ",".join(FREESOUND_FIELDS), "page_size": max(1, min(n, 200)), "page": 1}
    last_err = None
    for suffix in candidates:
        url = f"{base_url}{suffix}?{urlencode(params)}"
        req = Request(url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
        try:
            with urlopen(req, timeout=20) as resp:
                payload = resp.read().decode("utf-8")
            data = json.loads(payload)
            # Some endpoints return a dict with 'results', others return list directly
            if isinstance(data, dict):
                results = data.get("results", [])
            elif isinstance(data, list):
                results = data
            else:
                results = []
            return results[:n]
        except HTTPError as he:
            try:
                err_body = he.read().decode("utf-8", errors="ignore")
            except Exception:
                err_body = ""
            # Silence Freesound 404 responses to avoid noisy output; report others
            last_err = he
            if he.code == 404:
                continue
            print(f"Freesound HTTPError {he.code} for URL: {url}")
            if err_body:
                print(f"Response body: {err_body[:1000]}")
            raise
        except Exception as exc:
            last_err = exc
            continue

    if last_err:
        raise last_err
    return []


def _collect_similar_sounds_paged(
    sound_id: str,
    api_key: str,
    base_url: str,
    dataset_index: dict[str, str],
    target_results: int,
    page_size: int,
    max_pages: int = 0,
):
    """Page through the Freesound 'similar' endpoints until we collect at least
    `target_results` items that exist in `dataset_index`, or until results are exhausted.
    Returns the accumulated raw similar items list.
    """
    candidates = [f"/sounds/{sound_id}/similar/", f"/sounds/{sound_id}/similar_sounds/"]
    accumulated: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for suffix in candidates:
        page = 1
        pages_scanned = 0
        while True:
            params = {"token": api_key, "fields": ",".join(FREESOUND_FIELDS), "page_size": page_size, "page": page}
            url = f"{base_url}{suffix}?{urlencode(params)}"
            req = Request(url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
            try:
                with urlopen(req, timeout=20) as resp:
                    payload = resp.read().decode("utf-8")
                data = json.loads(payload)
                if isinstance(data, dict):
                    page_results = data.get("results", [])
                elif isinstance(data, list):
                    page_results = data
                else:
                    page_results = []
            except HTTPError as he:
                try:
                    err_body = he.read().decode("utf-8", errors="ignore")
                except Exception:
                    err_body = ""
                # Silence 404s during paged similar collection; break on other errors but print them
                if he.code == 404:
                    break
                print(f"Freesound HTTPError {he.code} for URL: {url}")
                if err_body:
                    print(f"Response body: {err_body[:1000]}")
                break
            except Exception:
                break

            if not page_results:
                break

            pages_scanned += 1
            for item in page_results:
                sid = str(item.get("id", "")).strip()
                if not sid or sid in seen_ids:
                    continue
                seen_ids.add(sid)
                accumulated.append(item)

            # Check how many of the accumulated map to dataset
            mapped_count = 0
            for it in accumulated:
                sid2 = str(it.get("id", "")).strip()
                if sid2 in dataset_index:
                    mapped_count += 1

            if mapped_count >= target_results:
                return accumulated

            page += 1
            if max_pages and pages_scanned >= max_pages:
                break

    return accumulated


def _query_backend_freesound(backend_url: str, query: str, top_k: int, page_size: int, max_pages: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int, str | None]:
    """Call the local backend /api/freesound-search endpoint to reuse its dataset-matching logic.

    Returns: (dataset_matches, top_k_raw, raw_scanned, error_message)
    """
    import urllib.request

    endpoint = f"{backend_url.rstrip('/')}/api/freesound-search"
    params = {
        "q": query,
        "page_size": page_size,
        "max_pages": max_pages,
        "top_k": top_k,
    }
    url = endpoint + "?" + urlencode(params)

    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=20) as resp:
            payload = resp.read().decode("utf-8")
        data = json.loads(payload)
        dataset_matches = data.get("results", [])
        top_k_raw = data.get("top_k_raw", [])
        raw_scanned = int(data.get("raw_scanned", 0))
        return dataset_matches, top_k_raw, raw_scanned, None
    except Exception as exc:
        return [], [], 0, str(exc)


def _resolve_audio_path(repo_root: Path, candidate: str) -> Path:
    path = Path(candidate)
    if not path.is_absolute():
        path = repo_root / path

    if path.exists():
        return path

    fallback = repo_root / "Dataset" / "audio_processed" / "100270.wav"
    if fallback.exists():
        return fallback

    raise FileNotFoundError(f"Audio file not found: {candidate}")


def _resolve_output_path(repo_root: Path, candidate: str) -> Path:
    path = Path(candidate)
    if not path.is_absolute():
        path = repo_root / path
    return path


def main() -> int:
    repo_root = _repo_root()
    parser = argparse.ArgumentParser(
        description="Evaluate CLAP dataset ranking plus Freesound search filtered to local dataset files"
    )
    parser.add_argument(
        "--audio",
        default=str(repo_root / "Dataset" / "audio_processed" / "100270.wav"),
        help="Audio file used as query",
    )
    parser.add_argument(
        "--embeddings",
        default=str(repo_root / "Dataset" / "embeddings_output.json"),
        help="Path to the dataset embeddings JSON",
    )
    parser.add_argument(
        "--focus",
        choices=["general", "melodic", "bpm", "timbre"],
        default="general",
        help="Focus used to generate the Freesound query from the audio",
    )
    parser.add_argument(
        "--freesound-token",
        default=os.getenv("FREESOUND_API_KEY") or os.getenv("VITE_FREESOUND_API_KEY") or "",
        help="Freesound API token. Falls back to FREESOUND_API_KEY or VITE_FREESOUND_API_KEY in .env",
    )
    parser.add_argument(
        "--freesound-query",
        default="",
        help="Override the Freesound query string (default: filename stem)",
    )
    parser.add_argument(
        "--freesound-base-url",
        default=os.getenv("FREESOUND_API_BASE", DEFAULT_FREESOUND_BASE_URL),
        help="Freesound API base URL",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TARGET_RESULTS,
        help="Number of CLAP dataset results to return",
    )
    parser.add_argument(
        "--freesound-page-size",
        type=int,
        default=DEFAULT_SEARCH_PAGE_SIZE,
        help="Number of Freesound results to request per page",
    )
    parser.add_argument(
        "--freesound-max-pages",
        type=int,
        default=0,
        help="Maximum Freesound pages to scan before stopping (0 = no limit)",
    )
    parser.add_argument(
        "--output",
        default=str(repo_root / "Evaluation" / "clap_freesound_dataset_report.json"),
        help="Path to the output JSON report",
    )

    args = parser.parse_args()

    audio_path = _resolve_audio_path(repo_root, args.audio)
    embeddings_path = _resolve_output_path(repo_root, args.embeddings)
    output_path = _resolve_output_path(repo_root, args.output)
    api_key = _resolve_freesound_token(args.freesound_token, repo_root)
    backend_url = os.getenv("BACKEND_URL") or "http://localhost:8000"

    if not embeddings_path.exists():
        print(f"Embeddings JSON not found: {embeddings_path}")
        return 3

    if not api_key:
        print("Freesound API token missing. Add FREESOUND_API_KEY to .env or pass --freesound-token.")
        return 4

    clap_module = _load_clap_helpers()
    dataset_index = _build_dataset_index(embeddings_path)
    if not dataset_index:
        print("Dataset index is empty. Check the embeddings JSON.")
        return 5

    start_clap = time.time()
    clap_results = _rank_dataset_with_clap(audio_path, embeddings_path, top_k=args.top_k)
    clap_elapsed = time.time() - start_clap

    # Per user request: do NOT compute CLAP similarity percentages for Freesound matches.
    # Keep CLAP dataset ranking but skip computing per-item similarity_map used for ordering.
    similarity_map: dict[str, float] = {}

    # Use provided Freesound query override, otherwise default to audio filename stem
    if args.freesound_query and args.freesound_query.strip():
        freesound_query_display = args.freesound_query.strip()
        freesound_query_api = freesound_query_display
    else:
        freesound_query_display = Path(str(audio_path)).stem
        # If the stem is numeric (likely a freesound id), search by id; otherwise search as exact phrase
        if str(freesound_query_display).isdigit():
            freesound_query_api = freesound_query_display
        else:
            freesound_query_api = f'"{freesound_query_display}"'
    # still collect descriptors for reporting purposes
    try:
        _, descriptors = _generate_freesound_query(audio_path, args.focus)
    except Exception:
        descriptors = {}
    base_url = _normalize_api_base(args.freesound_base_url)

    # Prefer using the running backend to reuse its Freesound->dataset matching logic
    start_fs = time.time()
    freesound_error = None
    freesound_top_k_raw: list[dict[str, Any]] = []
    raw_freesound_results: list[dict[str, Any]] = []
    freesound_results: list[dict[str, Any]] = []

    backend_matches, backend_top_raw, backend_scanned, backend_err = _query_backend_freesound(
        backend_url=backend_url, query=freesound_query_api, top_k=args.top_k, page_size=args.freesound_page_size, max_pages=args.freesound_max_pages
    )

    try:
        # Prefer backend precomputed matches if available
        if backend_err is None and backend_matches:
            freesound_results = backend_matches[: args.top_k]
            raw_freesound_results = backend_top_raw or []
            freesound_top_k_raw = (backend_top_raw or [])[: args.top_k]
            backend_scanned = int(backend_scanned or len(raw_freesound_results))
        else:
            # Scan Freesound pages until we collect `top_k` matches that exist in the dataset
            freesound_results, raw_freesound_results = _collect_freesound_matches(
                query=freesound_query_api,
                api_key=api_key,
                base_url=base_url,
                dataset_index=dataset_index,
                target_results=args.top_k,
                page_size=args.freesound_page_size,
                max_pages=args.freesound_max_pages,
                exact_name_stem=(Path(str(audio_path)).stem if not args.freesound_query else None),
            )
            # Also fetch the raw top-n for display (first-page top results)
            freesound_top_k_raw = _fetch_top_n_freesound(freesound_query_api, api_key, base_url, args.top_k)

        freesound_error = None
    except Exception as exc:
        freesound_results, raw_freesound_results, freesound_top_k_raw = [], [], []
        freesound_error = str(exc)

    freesound_elapsed = time.time() - start_fs

    # If backend didn't provide raw top-k, try to fetch directly from Freesound (use API query)
    if not freesound_top_k_raw:
        try:
            freesound_top_k_raw = _fetch_top_n_freesound(freesound_query_api, api_key, base_url, args.top_k)
        except Exception:
            freesound_top_k_raw = []

    freesound_raw_scanned = backend_scanned if backend_err is None else len(raw_freesound_results)

    report: dict[str, Any] = {
        "query": str(audio_path),
        "embeddings_json": str(embeddings_path),
        "freesound_query": (freesound_query_display if 'freesound_query_display' in locals() else freesound_query_api),
        "focus": args.focus,
        "descriptors": descriptors,
        "timings": {
            "clap_sec": clap_elapsed,
            "freesound_sec": freesound_elapsed,
        },
        "clap_dataset_top_k": clap_results,
        # The authoritative Freesound-derived matches (mapped to our dataset), ordered by Freesound / similar endpoint
        "freesound_ordered_dataset_matches": [],
        "used_similar_source_id": None,
        "freesound_error": freesound_error,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Query audio: {audio_path}")
    print(f"CLAP top-{len(clap_results)} dataset matches computed in {clap_elapsed:.2f}s")
    for item in clap_results:
        print(
            f"  #{item['rank']} {item['archivo']} -> similitud: {item['similitud']:.2f}% (dist: {item['distancia']:.6f})"
        )

    print(f"\nFreesound query: {freesound_query_display if 'freesound_query_display' in locals() else freesound_query_api}")

    # Build ranking based on Freesound top-k order: map raw results to dataset entries preserving Freesound order
    freesound_ordered_dataset_matches: list[dict[str, Any]] = []
    seen_ds: set[str] = set()

    # Choose a single Freesound source id to query the 'find similars' endpoint from.
    # Preference: match query stem to a top-k raw result (by id or filename stem), otherwise use first raw result.
    used_similar_source_id: str | None = None
    similar_raw_source: list[dict[str, Any]] | None = None

    query_stem = Path(str(audio_path)).stem
    try:
        for rr in freesound_top_k_raw:
            sid = str(rr.get("id", "")).strip()
            if not sid:
                continue
            if sid == query_stem:
                used_similar_source_id = sid
                break
            try:
                fs_name = str(rr.get("name", ""))
                name_stem = fs_name.rsplit('.', 1)[0].strip()
                if name_stem.lower() == str(query_stem).lower():
                    used_similar_source_id = sid
                    break
            except Exception:
                pass

        if not used_similar_source_id and freesound_top_k_raw:
            first = freesound_top_k_raw[0]
            used_similar_source_id = str(first.get("id", "")).strip() if first.get("id") else None

        if used_similar_source_id:
            try:
                similar_raw = _collect_similar_sounds_paged(
                    used_similar_source_id,
                    api_key,
                    base_url,
                    dataset_index=dataset_index,
                    target_results=args.top_k,
                    page_size=args.freesound_page_size,
                    max_pages=args.freesound_max_pages,
                )
                if similar_raw:
                    similar_raw_source = similar_raw
                    print(f"Using Freesound 'find similars' from sound id {used_similar_source_id} as source (collected {len(similar_raw)} similar items across pages)")
            except Exception as exc:
                print(f"Could not fetch similar-sounds for id {used_similar_source_id}: {exc}")
    except Exception:
        similar_raw_source = None

    source_iterable = similar_raw_source if similar_raw_source is not None else freesound_top_k_raw
    for pos, rr in enumerate(source_iterable, start=1):
        sid = str(rr.get("id", "")).strip()
        if not sid:
            continue

        ds_path = dataset_index.get(sid)
        exact_name_match = False
        if not ds_path:
            try:
                fs_name = str(rr.get("name", ""))
                name_stem = fs_name.rsplit('.', 1)[0]
                ds_path = dataset_index.get(name_stem)
                if ds_path:
                    exact_name_match = True
            except Exception:
                pass

        if ds_path and ds_path not in seen_ds:
            seen_ds.add(ds_path)
            freesound_ordered_dataset_matches.append(
                {
                    "freesound_rank": pos,
                    "id": int(sid) if sid.isdigit() else sid,
                    "name": rr.get("name"),
                    "username": rr.get("username"),
                    "freesound_url": rr.get("url") or (f"https://freesound.org/s/{sid}/"),
                    "dataset_path": ds_path,
                    "exact_name_match": exact_name_match,
                }
            )
        if len(freesound_ordered_dataset_matches) >= args.top_k:
            break

    # If Freesound did not yield enough dataset-mapped matches, expand search by
    # paging 'similar' for relevant Freesound ids until we collect `top_k` items.
    if len(freesound_ordered_dataset_matches) < args.top_k:
        # First, if we previously used a similar-source, try to get more pages from it
        if used_similar_source_id and similar_raw_source is not None:
            try:
                more_similar = _collect_similar_sounds_paged(
                    used_similar_source_id,
                    api_key,
                    base_url,
                    dataset_index=dataset_index,
                    target_results=args.top_k,
                    page_size=args.freesound_page_size,
                    max_pages=args.freesound_max_pages,
                )
            except Exception:
                more_similar = []

            for rr in more_similar:
                if len(freesound_ordered_dataset_matches) >= args.top_k:
                    break
                sid = str(rr.get("id", "")).strip()
                if not sid:
                    continue
                ds_path = dataset_index.get(sid)
                if not ds_path:
                    try:
                        fs_name = str(rr.get("name", ""))
                        name_stem = fs_name.rsplit('.', 1)[0]
                        ds_path = dataset_index.get(name_stem)
                    except Exception:
                        ds_path = None

                if ds_path and ds_path not in seen_ds:
                    seen_ds.add(ds_path)
                    freesound_ordered_dataset_matches.append(
                        {
                            "freesound_rank": None,
                            "id": int(sid) if sid.isdigit() else sid,
                            "name": rr.get("name"),
                            "username": rr.get("username"),
                            "freesound_url": rr.get("url") or (f"https://freesound.org/s/{sid}/"),
                            "dataset_path": ds_path,
                            "exact_name_match": False,
                        }
                    )

        # If still short, iterate the top raw Freesound results and page their similars
        if len(freesound_ordered_dataset_matches) < args.top_k:
            for rr_top in freesound_top_k_raw:
                if len(freesound_ordered_dataset_matches) >= args.top_k:
                    break
                sid_top = str(rr_top.get("id", "")).strip()
                if not sid_top:
                    continue
                try:
                    similar_pages = _collect_similar_sounds_paged(
                        sid_top,
                        api_key,
                        base_url,
                        dataset_index=dataset_index,
                        target_results=args.top_k,
                        page_size=args.freesound_page_size,
                        max_pages=args.freesound_max_pages,
                    )
                except Exception:
                    similar_pages = []

                for rr in similar_pages:
                    if len(freesound_ordered_dataset_matches) >= args.top_k:
                        break
                    sid = str(rr.get("id", "")).strip()
                    if not sid:
                        continue
                    ds_path = dataset_index.get(sid)
                    if not ds_path:
                        try:
                            fs_name = str(rr.get("name", ""))
                            name_stem = fs_name.rsplit('.', 1)[0]
                            ds_path = dataset_index.get(name_stem)
                        except Exception:
                            ds_path = None

                    if ds_path and ds_path not in seen_ds:
                        seen_ds.add(ds_path)
                        freesound_ordered_dataset_matches.append(
                            {
                                "freesound_rank": None,
                                "id": int(sid) if sid.isdigit() else sid,
                                "name": rr.get("name"),
                                "username": rr.get("username"),
                                "freesound_url": rr.get("url") or (f"https://freesound.org/s/{sid}/"),
                                "dataset_path": ds_path,
                                "exact_name_match": False,
                            }
                        )

    # Do NOT fill missing slots with CLAP fallbacks — user requested only Freesound-origin matches.

    # Preserve Freesound/similar source order and filter entries with ids
    freesound_ordered_dataset_matches = [m for m in freesound_ordered_dataset_matches if m.get("id") is not None]

    print(f"Freesound-derived Top-{len(freesound_ordered_dataset_matches)} (filtered to dataset):")
    for idx, item in enumerate(freesound_ordered_dataset_matches, start=1):
        print(f"  #{idx} id={item.get('id')} {item.get('name')} -> {item.get('dataset_path')}")

    # (Removed printing of the raw Freesound source list per user request.)


    # Include the Freesound-ordered matches in the report and write the JSON now
    report["freesound_ordered_dataset_matches"] = freesound_ordered_dataset_matches
    report["used_similar_source_id"] = used_similar_source_id
    # Do not include raw Freesound lists in the report — only the dataset-mapped top-k.
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    # Raw Freesound Top-N printing removed per user request.

    print(f"\nReport written to: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
