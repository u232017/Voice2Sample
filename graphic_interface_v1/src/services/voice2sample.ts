// src/services/voice2sample.ts
// Servicio que habla con tu FastAPI (api.py) en lugar de Freesound

const API_BASE = import.meta.env.VITE_VOICE2SAMPLE_API_URL || 'http://localhost:8000';

// ── Tipos que devuelve tu api.py ──────────────────────────────────────────────

export interface V2SResult {
  rank: number;
  audio_id: string;
  ruta_audio: string;
  similitud: number;
  distancia: number;
  bpm: number | null;
  pitch_mean: number | null;
  key: string | null;
  scale: string | null;
  danceability: number | null;
}

export interface V2SResponse {
  total_resultados: number;
  filtros_aplicados: Record<string, unknown>;
  modo_busqueda: string;
  resultados: V2SResult[];
}

export interface V2SRangos {
  bpm: { min: number; max: number };
  pitch_mean: { min: number; max: number };
  danceability: { min: number; max: number };
  key: string[];
  scale: string[];
}

export interface V2SFiltros {
  n_resultados?: number;
  modo?: 'todos' | 'timbre' | 'ritmo' | 'melodia';
  min_bpm?: number;
  max_bpm?: number;
  min_pitch?: number;
  max_pitch?: number;
  min_danceability?: number;
  max_danceability?: number;
  key?: string;
  scale?: string;
}

// ── Funciones ─────────────────────────────────────────────────────────────────

export async function buscarSimilitud(
  audioBlob: Blob,
  filtros: V2SFiltros = {}
): Promise<V2SResponse> {
  const form = new FormData();
  // La API espera un .wav; si el blob es webm/ogg del grabador del navegador
  // lo enviamos igualmente y dejamos que el back lo maneje (o convierte antes)
  const file = new File([audioBlob], 'query.wav', { type: 'audio/wav' });
  form.append('audio', file);

  const params = new URLSearchParams();
  if (filtros.n_resultados) params.set('n_resultados', String(filtros.n_resultados));
  if (filtros.modo)         params.set('modo', filtros.modo);
  if (filtros.min_bpm != null)         params.set('min_bpm', String(filtros.min_bpm));
  if (filtros.max_bpm != null)         params.set('max_bpm', String(filtros.max_bpm));
  if (filtros.min_pitch != null)       params.set('min_pitch', String(filtros.min_pitch));
  if (filtros.max_pitch != null)       params.set('max_pitch', String(filtros.max_pitch));
  if (filtros.min_danceability != null) params.set('min_danceability', String(filtros.min_danceability));
  if (filtros.max_danceability != null) params.set('max_danceability', String(filtros.max_danceability));
  if (filtros.key)   params.set('key', filtros.key);
  if (filtros.scale) params.set('scale', filtros.scale);

  const res = await fetch(`${API_BASE}/buscar?${params.toString()}`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${texto}`);
  }

  return res.json() as Promise<V2SResponse>;
}

export async function obtenerRangos(): Promise<V2SRangos> {
  const res = await fetch(`${API_BASE}/filtros/rangos`);
  if (!res.ok) throw new Error(`No se pudo obtener rangos: ${res.status}`);
  return res.json() as Promise<V2SRangos>;
}

// Convierte un resultado de tu API al shape de FreesoundSound que ya usa la UI
// Así no hay que tocar SoundCard.tsx
export function v2sResultToSound(r: V2SResult) {
  const tags: string[] = [];
  if (r.key)   tags.push(r.key + (r.scale ? ' ' + r.scale : ''));
  if (r.bpm)   tags.push(Math.round(r.bpm) + ' BPM');
  if (r.danceability) tags.push('dance ' + r.danceability.toFixed(2));

  return {
    id: Number(r.audio_id) || 0,
    name: `Sample ${r.audio_id}`,
    username: 'Local dataset',
    duration: undefined,
    tags,
    similarity: r.similitud,
    avg_rating: parseFloat((r.similitud * 5).toFixed(1)),
    num_downloads: r.rank,
    num_comments: 0,
    url: `${API_BASE}/${r.ruta_audio}`,
    // Endpoint /audio/:id sirve el .wav directamente desde el dataset
    previews: {
      'preview-hq-mp3': `${API_BASE}/audio/${r.audio_id}`,
    },
    license: `Similitud: ${(r.similitud * 100).toFixed(1)}%`,
  };
}