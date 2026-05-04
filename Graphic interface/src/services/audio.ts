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
      throw new Error('Unable to access microphone. Please check permissions.');
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

    if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
      throw new Error(
        `Unsupported format: ${extension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(2)}MB`
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

  private calculateWaveformData(audioBuffer: AudioBuffer, samples: number = 512): number[] {
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

  getRecordingDuration(): number {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return 0;
    }
    return (Date.now() - this.startTime) / 1000;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording' ?? false;
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export const audioService = new AudioService();
