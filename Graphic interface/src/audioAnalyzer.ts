// Web Audio API utilities for waveform analysis

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioBuffer: AudioBuffer | null = null;

  async initializeContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  async loadAudioFile(file: File): Promise<AudioBuffer> {
    const context = await this.initializeContext();
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await context.decodeAudioData(arrayBuffer);
    return this.audioBuffer;
  }

  async loadAudioUrl(url: string): Promise<AudioBuffer> {
    const context = await this.initializeContext();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await context.decodeAudioData(arrayBuffer);
    return this.audioBuffer;
  }

  /**
   * Extract waveform data from audio buffer
   * Returns normalized amplitude values for visualization
   */
  getWaveformData(samples: number = 512): number[] {
    if (!this.audioBuffer) return [];

    const rawData = this.audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const waveData: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[i * blockSize + j]);
      }
      waveData.push(sum / blockSize);
    }

    return this.normalizeData(waveData);
  }

  /**
   * Get RMS (Root Mean Square) data for a more accurate representation
   */
  getRmsData(samples: number = 512): number[] {
    if (!this.audioBuffer) return [];

    const rawData = this.audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const rmsData: number[] = [];

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        const sample = rawData[i * blockSize + j];
        sum += sample * sample;
      }
      rmsData.push(Math.sqrt(sum / blockSize));
    }

    return this.normalizeData(rmsData);
  }

  /**
   * Get peak data (maximum absolute value in each block)
   */
  getPeakData(samples: number = 512): number[] {
    if (!this.audioBuffer) return [];

    const rawData = this.audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const peakData: number[] = [];

    for (let i = 0; i < samples; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        max = Math.max(max, Math.abs(rawData[i * blockSize + j]));
      }
      peakData.push(max);
    }

    return this.normalizeData(peakData);
  }

  /**
   * Normalize data to 0-100 range
   */
  private normalizeData(data: number[]): number[] {
    const max = Math.max(...data);
    if (max === 0) return data.map(() => 0);
    return data.map((value) => (value / max) * 100);
  }

  /**
   * Get audio duration in seconds
   */
  getDuration(): number {
    return this.audioBuffer?.duration || 0;
  }

  /**
   * Format duration as MM:SS
   */
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get audio buffer for playing
   */
  getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  /**
   * Close audio context
   */
  async close(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const audioAnalyzer = new AudioAnalyzer();
