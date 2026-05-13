// src/hooks/useVoice2Sample.ts
// Hook que reemplaza useFreesound para usar tu motor KNN local

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buscarSimilitud,
  obtenerRangos,
  v2sResultToSound,
  V2SFiltros,
  V2SRangos,
} from '../services/voice2sample';
import { FreesoundSound } from '../services/types';

const RANGOS_VACIOS: V2SRangos = {
  bpm:          { min: 60,  max: 200 },
  pitch_mean:   { min: 0,   max: 5000 },
  danceability: { min: 0,   max: 3 },
  key:   [],
  scale: [],
};

export function useVoice2Sample() {
  const [results, setResults]     = useState<FreesoundSound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [rangos, setRangos]       = useState<V2SRangos>(RANGOS_VACIOS);

  // Carga los rangos al montar (para que los sliders tengan min/max reales)
  useEffect(() => {
    obtenerRangos()
      .then(setRangos)
      .catch(() => {
        // Si el back no está levantado todavía, usamos los valores por defecto
        console.warn('No se pudo obtener rangos de la API. Usando valores por defecto.');
      });
  }, []);

  const lastFiltros = useRef<V2SFiltros>({});

  const buscar = useCallback(async (audioBlob: Blob, filtros: V2SFiltros = {}) => {
    lastFiltros.current = filtros;
    setError(null);
    setIsLoading(true);
    try {
      const respuesta = await buscarSimilitud(audioBlob, { n_resultados: 8, ...filtros });
      setResults(respuesta.resultados.map(v2sResultToSound));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('501')
        ? 'El motor de audio (Essentia) no está disponible. Revisa que audio_analysis esté instalado.'
        : msg.includes('503')
          ? 'El modelo KNN no está cargado. Arranca primero uvicorn.'
          : `Error de búsqueda: ${msg}`
      );
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, isLoading, error, rangos, buscar, clearResults };
}