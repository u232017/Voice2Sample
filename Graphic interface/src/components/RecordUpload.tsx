import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Mic, Square } from 'lucide-react';
import { FreesoundWaveform } from './FreesoundWaveform';
import { AudioUploadInput } from './AudioUploadInput';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useFileUpload } from '../hooks/useFileUpload';
import { useAudio } from '../context/AudioContext';
import { RecordedAudio } from '../services/types';
import { audioService } from '../services/audio';

interface RecordUploadProps {
  onAnalyze: () => void;
}

export function RecordUpload({ onAnalyze }: RecordUploadProps) {
  const { setCurrentAudio } = useAudio();
  const recorder = useAudioRecorder();
  const fileUpload = useFileUpload();

  const [mode, setMode] = useState<'choose' | 'record' | 'upload'>('choose');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setLocalAudio] = useState<RecordedAudio | null>(null);

  useEffect(() => {
    if (currentAudio) {
      setCurrentAudio(currentAudio);
    }
  }, [currentAudio, setCurrentAudio]);

  const handleStartRecording = async () => {
    setMode('record');
    await recorder.startRecording();
  };

  const handleStopRecording = async () => {
    const audio = await recorder.stopRecording();
    if (audio) {
      setLocalAudio(audio);
      setMode('choose');
    }
  };

  const handleFileSelected = async (file: File) => {
    const audio = await fileUpload.uploadFile(file);
    if (audio) {
      setLocalAudio(audio);
      setMode('choose');
    }
  };

  const handleAnalyze = () => {
    if (currentAudio) {
      onAnalyze();
    }
  };

  const handleReset = () => {
    setLocalAudio(null);
    setMode('choose');
    setIsPlaying(false);
  };

  if (!currentAudio) {
    return (
      <div className="min-h-[calc(100vh-89px)] flex items-center justify-center px-8 py-12 bg-freesound-darker">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-2">Encuentra Sonidos Similares</h1>
            <p className="text-freesound-yellow/70">Graba un sonido o carga un archivo de audio</p>
          </div>

          {/* Choose mode or show upload/record UI */}
          {mode === 'choose' ? (
            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={handleStartRecording}
                className="group p-8 rounded-lg border-2 border-freesound-yellow/30 hover:border-freesound-yellow/60 bg-freesound-dark hover:bg-freesound-dark/80 transition-all"
              >
                <div className="flex flex-col items-center gap-3">
                  <Mic className="w-8 h-8 text-freesound-yellow group-hover:text-freesound-orange transition-colors" />
                  <p className="font-bold text-white">Grabar</p>
                  <p className="text-sm text-freesound-yellow/60">Usa tu micrófono</p>
                </div>
              </button>

              <button
                onClick={() => setMode('upload')}
                className="group p-8 rounded-lg border-2 border-freesound-orange/30 hover:border-freesound-orange/60 bg-freesound-dark hover:bg-freesound-dark/80 transition-all"
              >
                <div className="flex flex-col items-center gap-3">
                  <svg
                    className="w-8 h-8 text-freesound-orange group-hover:text-freesound-green transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <p className="font-bold text-white">Cargar</p>
                  <p className="text-sm text-freesound-orange/60">Desde tu computadora</p>
                </div>
              </button>
            </div>
          ) : mode === 'record' ? (
            <div className="bg-freesound-dark rounded-lg p-8 border border-freesound-yellow/20">
              <div className="text-center mb-6">
                <div className="inline-block w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-4">
                  <div className="w-8 h-8 bg-red-500 rounded-full animate-pulse"></div>
                </div>
                <p className="text-2xl font-bold text-white">
                  {audioService.formatDuration(recorder.duration)}
                </p>
                <p className="text-freesound-yellow/60">Grabando...</p>
              </div>

              <button
                onClick={handleStopRecording}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Square size={20} /> Detener
              </button>
            </div>
          ) : (
            <div>
              <AudioUploadInput onFileSelected={handleFileSelected} isLoading={fileUpload.isLoading} />
              <button
                onClick={() => setMode('choose')}
                className="mt-4 w-full py-2 text-freesound-yellow/60 hover:text-freesound-yellow transition-colors"
              >
                ← Volver
              </button>
              {fileUpload.error && (
                <p className="mt-2 text-red-400 text-sm">{fileUpload.error}</p>
              )}
            </div>
          )}

          {recorder.error && (
            <p className="mt-4 text-red-400 text-sm text-center">{recorder.error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-89px)] flex items-center justify-center px-8 py-12 bg-freesound-darker">
      <div className="max-w-4xl w-full">
        {/* Audio Preview Panel */}
        <div
          className="rounded-2xl p-8 mb-6 border-2"
          style={{
            background: '#1a1a1a',
            borderColor: 'rgba(245, 212, 66, 0.2)',
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                boxShadow: '0 4px 16px rgba(245, 212, 66, 0.4)',
              }}
            >
              <Mic className="w-6 h-6 text-freesound-darker" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Preview de Audio</h2>
              <p className="text-freesound-yellow/60">Muestra del audio cargado</p>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="mb-6">
            <FreesoundWaveform
              isPlaying={isPlaying}
              duration={audioService.formatDuration(currentAudio.metadata.duration)}
              progress={isPlaying ? 0.3 : 0}
              height="h-32"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: 'linear-gradient(135deg, #f5d442, #f5a742)',
                boxShadow: '0 4px 20px rgba(245, 212, 66, 0.4)',
              }}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-freesound-darker" />
              ) : (
                <Play className="w-6 h-6 ml-1 text-freesound-darker" />
              )}
            </button>

            <button
              onClick={handleReset}
              className="px-6 h-14 rounded-xl flex items-center gap-2 transition-all hover:bg-white/5 border-2 border-freesound-yellow/20 text-freesound-yellow/80 hover:text-freesound-yellow"
            >
              <RotateCcw className="w-5 h-5" />
              Regrabar
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl p-4 bg-freesound-yellow/10 border border-freesound-yellow/20">
            <p className="text-sm text-freesound-yellow/60 mb-1">Duración</p>
            <p className="text-xl font-bold text-freesound-yellow">
              {audioService.formatDuration(currentAudio.metadata.duration)}
            </p>
          </div>
          <div className="rounded-xl p-4 bg-freesound-orange/10 border border-freesound-orange/20">
            <p className="text-sm text-freesound-orange/60 mb-1">Sample Rate</p>
            <p className="text-xl font-bold text-freesound-orange">
              {(currentAudio.metadata.sampleRate / 1000).toFixed(1)} kHz
            </p>
          </div>
          <div className="rounded-xl p-4 bg-freesound-green/10 border border-freesound-green/20">
            <p className="text-sm text-freesound-green/60 mb-1">Canales</p>
            <p className="text-xl font-bold text-freesound-green">{currentAudio.metadata.channels}</p>
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          className="w-full py-5 rounded-xl font-bold text-lg transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #f5d442 0%, #88d442 100%)',
            boxShadow: '0 8px 32px rgba(245, 212, 66, 0.4)',
            color: '#0a0a0a',
          }}
        >
          🔍 Analizar y Buscar Sonidos Similares
        </button>
      </div>
    </div>
  );
}
