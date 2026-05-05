import { RecordedAudio, AudioMetadata } from './types';

const SUPPORTED_FORMATS = (import.meta.env.VITE_SUPPORTED_FORMATS || 'wav,mp3,ogg,flac').split(',');
const MAX_FILE_SIZE = parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '52428800');

class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;

  async startRecording(): Promise<void> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Tu navegador no permite grabar audio desde esta pagina.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      const mediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      mediaStreamAudioSourceNode.connect(this.analyser);

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType(),
      });

      this.recordedChunks = [];
      this.startTime = Date.now();

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        this.recordedChunks.push(event.data);
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      if (error instanceof Error && error.name === 'NotAllowedError') {
        throw new Error('Permiso de microfono denegado. Activa el acceso al microfono para grabar.');
      }
      if (error instanceof Error && error.name === 'NotFoundError') {
        throw new Error('No se encontro ningun microfono disponible.');
      }
      throw new Error(error instanceof Error ? error.message : 'No se pudo acceder al microfono.');
    }
  }

  stopRecording(): Promise<RecordedAudio> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder!.mimeType });
          const metadata = await this.getAudioMetadata(audioBlob);
          const arrayBuffer = await audioBlob.arrayBuffer();

          resolve({
            blob: audioBlob,
            metadata,
            arrayBuffer,
            name: `Recording ${new Date().toLocaleTimeString()}`,
            source: 'recording',
            mimeType: audioBlob.type,
          });

          // Cleanup
          if (this.mediaRecorder) {
            this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
          }
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/wav',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }

  async validateFile(file: File): Promise<void> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (!file.type.startsWith('audio/') && (!extension || !SUPPORTED_FORMATS.includes(extension))) {
      throw new Error(
        `Archivo no valido. Usa un archivo de audio (${SUPPORTED_FORMATS.join(', ')}).`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `El archivo pesa ${(file.size / 1024 / 1024).toFixed(2)}MB. El maximo es ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB.`
      );
    }
  }

  async processFile(file: File): Promise<RecordedAudio> {
    await this.validateFile(file);

    const metadata = await this.getAudioMetadata(file);
    const arrayBuffer = await file.arrayBuffer();

    return {
      blob: file,
      metadata,
      arrayBuffer,
      name: file.name,
      source: 'upload',
      mimeType: file.type,
    };
  }

  private async getAudioMetadata(audioBlob: Blob): Promise<AudioMetadata> {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      return {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        bitDepth: 16,
      };
    } catch (error) {
      console.error('Error getting audio metadata:', error);
      return {
        duration: 0,
        sampleRate: 44100,
        channels: 2,
        bitDepth: 16,
      };
    }
  }

  calculateWaveformData(audioBuffer: AudioBuffer, samples: number = 512): number[] {
    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const waveformData: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[i * blockSize + j]);
      }
      waveformData.push(sum / blockSize);
    }

    return waveformData;
  }

  async decodeAudio(audioBlob: Blob): Promise<AudioBuffer> {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer);
  }

  getRecordingDuration(): number {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return 0;
    }
    return (Date.now() - this.startTime) / 1000;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording' || false;
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatPreciseDuration(seconds: number): string {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    const millis = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
}

export const audioService = new AudioService();
