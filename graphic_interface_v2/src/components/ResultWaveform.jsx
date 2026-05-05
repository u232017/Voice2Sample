import { useEffect, useRef, useState } from "react";

function ResultWaveform({ previewUrl }) {
  const canvasRef = useRef(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!previewUrl) return;

    async function loadWaveform() {
      try {
        setHasError(false);

        const response = await fetch(previewUrl);
        const arrayBuffer = await response.arrayBuffer();

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const channelData = audioBuffer.getChannelData(0);

        drawWaveform(channelData);
        audioContext.close();
      } catch (error) {
        console.error(error);
        setHasError(true);
      }
    }

    loadWaveform();
  }, [previewUrl]);

  function drawWaveform(channelData) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = 80 * dpr;

    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    context.clearRect(0, 0, width, height);

    context.fillStyle = "rgba(15, 23, 42, 0.9)";
    context.fillRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#7c3aed");
    gradient.addColorStop(0.5, "#0ea5e9");
    gradient.addColorStop(1, "#22d3ee");

    context.strokeStyle = gradient;
    context.lineWidth = 1.4 * dpr;
    context.beginPath();

    const samplesPerPixel = Math.ceil(channelData.length / width);

    for (let x = 0; x < width; x++) {
      const start = x * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);

      let min = 1;
      let max = -1;

      for (let i = start; i < end; i++) {
        const sample = channelData[i];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      context.moveTo(x, centerY + min * centerY * 0.85);
      context.lineTo(x, centerY + max * centerY * 0.85);
    }

    context.stroke();
  }

  if (hasError) {
    return <p className="missing-preview">Waveform preview unavailable.</p>;
  }

  return <canvas ref={canvasRef} className="result-waveform-canvas" />;
}

export default ResultWaveform;