import { useEffect, useRef, useState } from "react";

function AudioPreview({ audioData, onTrimChange }) {
  const canvasRef = useRef(null);
  const originalChannelDataRef = useRef(null);
  const originalAudioBufferRef = useRef(null);
  const originalDurationRef = useRef(0);
  const dragAnchorRef = useRef(null);
  const selectedAudioUrlRef = useRef(null);

  const [metrics, setMetrics] = useState({
    duration: "-",
    sampleRate: "-",
    peak: "-",
  });

  const [audioError, setAudioError] = useState("");
  const [trimRange, setTrimRange] = useState(null);
  const [displayedAudioUrl, setDisplayedAudioUrl] = useState(null);
  const [isSelectionPending, setIsSelectionPending] = useState(false);
  const [isSelectionConfirmed, setIsSelectionConfirmed] = useState(false);

  useEffect(() => {
    if (!audioData?.blob) {
      clearCanvas();
      resetPreviewState();
      return;
    }

    async function analyzePreview() {
      try {
        setAudioError("");
        setTrimRange(null);
        setIsSelectionPending(false);
        setIsSelectionConfirmed(false);
        dragAnchorRef.current = null;

        if (selectedAudioUrlRef.current) {
          URL.revokeObjectURL(selectedAudioUrlRef.current);
          selectedAudioUrlRef.current = null;
        }

        setDisplayedAudioUrl(audioData.url);

        const arrayBuffer = await audioData.blob.arrayBuffer();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const channelData = audioBuffer.getChannelData(0);

        originalAudioBufferRef.current = audioBuffer;
        originalChannelDataRef.current = channelData;
        originalDurationRef.current = audioBuffer.duration;

        updateMetrics(channelData, audioBuffer.duration, audioBuffer.sampleRate);
        drawWaveform(channelData, null);

        audioContext.close();
      } catch (error) {
        console.error(error);
        setAudioError("Audio not recognizable, please try again");
        clearCanvas();
      }
    }

    analyzePreview();

    return () => {
      if (selectedAudioUrlRef.current) {
        URL.revokeObjectURL(selectedAudioUrlRef.current);
        selectedAudioUrlRef.current = null;
      }
    };
  }, [audioData?.blob]);

  function resetPreviewState() {
    originalChannelDataRef.current = null;
    originalAudioBufferRef.current = null;
    originalDurationRef.current = 0;
    dragAnchorRef.current = null;

    if (selectedAudioUrlRef.current) {
      URL.revokeObjectURL(selectedAudioUrlRef.current);
      selectedAudioUrlRef.current = null;
    }

    setDisplayedAudioUrl(null);
    setTrimRange(null);
    setIsSelectionPending(false);
    setIsSelectionConfirmed(false);

    setMetrics({
      duration: "-",
      sampleRate: "-",
      peak: "-",
    });
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function updateMetrics(channelData, duration, sampleRate) {
    let peak = 0;

    for (let i = 0; i < channelData.length; i++) {
      const value = Math.abs(channelData[i]);
      if (value > peak) peak = value;
    }

    setMetrics({
      duration: `${duration.toFixed(2)}s`,
      sampleRate: `${Math.round(sampleRate / 1000)} kHz`,
      peak: peak.toFixed(2),
    });
  }

  function getMouseTime(event) {
    const canvas = canvasRef.current;
    if (!canvas || !originalDurationRef.current) return 0;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));

    return ratio * originalDurationRef.current;
  }

  function getSelectedChannelData(startTime, endTime) {
    const audioBuffer = originalAudioBufferRef.current;
    if (!audioBuffer) return null;

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);

    const originalChannelData = audioBuffer.getChannelData(0);
    return originalChannelData.slice(startSample, endSample);
  }

  function createWavBlobFromSelection(startTime, endTime) {
    const audioBuffer = originalAudioBufferRef.current;
    if (!audioBuffer) return null;

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const selectedLength = Math.max(1, endSample - startSample);

    const selectedData = audioBuffer.getChannelData(0).slice(startSample, endSample);

    const wavBuffer = encodeWav(selectedData, sampleRate);
    return new Blob([wavBuffer], { type: "audio/wav" });
  }

  function encodeWav(samples, sampleRate) {
    const numChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(view, 8, "WAVE");

    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);

    writeString(view, 36, "data");
    view.setUint32(40, samples.length * bytesPerSample, true);

    let offset = 44;

    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    return buffer;
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function drawWaveform(channelData, range) {
    const canvas = canvasRef.current;
    if (!canvas || !channelData) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = 210 * dpr;

    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#0f172a");
    background.addColorStop(1, "#18122f");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(34, 211, 238, 0.14)";
    context.lineWidth = 1 * dpr;

    for (let i = 0; i < 6; i++) {
      const y = (height / 5) * i;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#38bdf8");
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

    if (range && originalDurationRef.current) {
      const startX = (range.start / originalDurationRef.current) * width;
      const endX = (range.end / originalDurationRef.current) * width;
      const selectedWidth = Math.max(2, endX - startX);

      context.fillStyle = "rgba(34, 211, 238, 0.18)";
      context.fillRect(startX, 0, selectedWidth, height);

      context.strokeStyle = "#22d3ee";
      context.lineWidth = 2 * dpr;

      context.beginPath();
      context.moveTo(startX, 0);
      context.lineTo(startX, height);
      context.moveTo(endX, 0);
      context.lineTo(endX, height);
      context.stroke();
    }
  }

  function handleMouseDown(event) {
    if (!originalChannelDataRef.current || !originalDurationRef.current) return;

    const time = getMouseTime(event);

    dragAnchorRef.current = time;

    const newRange = {
      start: time,
      end: time,
    };

    setTrimRange(newRange);
    setIsSelectionPending(false);
    setIsSelectionConfirmed(false);
    drawWaveform(originalChannelDataRef.current, newRange);
  }

  function handleMouseMove(event) {
    if (dragAnchorRef.current === null || !originalChannelDataRef.current) return;

    const currentTime = getMouseTime(event);

    const newRange = {
      start: Math.min(dragAnchorRef.current, currentTime),
      end: Math.max(dragAnchorRef.current, currentTime),
    };

    drawWaveform(originalChannelDataRef.current, newRange);
  }

  function handleMouseUp(event) {
    if (dragAnchorRef.current === null || !originalChannelDataRef.current) return;

    const currentTime = getMouseTime(event);

    const newRange = {
      start: Math.min(dragAnchorRef.current, currentTime),
      end: Math.max(dragAnchorRef.current, currentTime),
    };

    dragAnchorRef.current = null;

    if (newRange.end - newRange.start < 0.05) {
      drawWaveform(originalChannelDataRef.current, null);
      setTrimRange(null);
      return;
    }

    applyTemporarySelection(newRange);
  }

  function applyTemporarySelection(newRange) {
    const selectedChannelData = getSelectedChannelData(newRange.start, newRange.end);
    const selectedBlob = createWavBlobFromSelection(newRange.start, newRange.end);

    if (!selectedChannelData || !selectedBlob) return;

    if (selectedAudioUrlRef.current) {
      URL.revokeObjectURL(selectedAudioUrlRef.current);
    }

    const selectedUrl = URL.createObjectURL(selectedBlob);
    selectedAudioUrlRef.current = selectedUrl;

    const selectedDuration = newRange.end - newRange.start;
    const sampleRate = originalAudioBufferRef.current.sampleRate;

    setDisplayedAudioUrl(selectedUrl);
    setTrimRange(newRange);
    setIsSelectionPending(true);
    setIsSelectionConfirmed(false);

    updateMetrics(selectedChannelData, selectedDuration, sampleRate);
    drawWaveform(selectedChannelData, null);
  }

  function confirmSelection() {
    if (!trimRange || !onTrimChange) return;

    onTrimChange({
      trimStart: trimRange.start,
      trimEnd: trimRange.end,
    });

    setIsSelectionPending(false);
    setIsSelectionConfirmed(true);
  }

  function clearTrim() {
    setTrimRange(null);
    setIsSelectionPending(false);
    setIsSelectionConfirmed(false);
    dragAnchorRef.current = null;

    if (selectedAudioUrlRef.current) {
      URL.revokeObjectURL(selectedAudioUrlRef.current);
      selectedAudioUrlRef.current = null;
    }

    setDisplayedAudioUrl(audioData?.url || null);

    if (originalChannelDataRef.current && originalAudioBufferRef.current) {
      updateMetrics(
        originalChannelDataRef.current,
        originalAudioBufferRef.current.duration,
        originalAudioBufferRef.current.sampleRate
      );

      drawWaveform(originalChannelDataRef.current, null);
    }

    if (onTrimChange) {
      onTrimChange({
        trimStart: null,
        trimEnd: null,
      });
    }
  }

  return (
    <section className="section-block preview-block">
      <h2>2. Preview</h2>

      {!audioData ? (
        <div className="info-box">You have not uploaded or recorded any audio yet.</div>
      ) : (
        <>
          <p>{audioData.sourceType} ready for analysis.</p>

          <span className="helper-text">
            This audio will be used as the reference for sample matching.
          </span>

          <audio className="audio-player preview-audio" src={displayedAudioUrl || audioData.url} controls />

          {audioError && <div className="warning-box">{audioError}</div>}

          <div className="waveform-wrapper">
            <canvas
              ref={canvasRef}
              className="waveform-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            <span className="trim-helper">
              Drag over the waveform to create a temporary cut. Listen to it and confirm the segment before analyzing.
            </span>
          </div>

          {trimRange && (
            <div className="trim-panel">
              <span>
                Selected: {trimRange.start.toFixed(2)}s - {trimRange.end.toFixed(2)}s
              </span>

              <div className="trim-actions">
                {isSelectionPending && (
                  <button onClick={confirmSelection}>Confirm selection</button>
                )}

                <button onClick={clearTrim}>Back to full audio</button>
              </div>
            </div>
          )}

          {isSelectionConfirmed && (
            <div className="success-box">
              Selection confirmed. The analysis will use this segment.
            </div>
          )}

          <div className="metric-grid">
            <div className="metric-card">
              <span>Duration</span>
              <strong>{metrics.duration}</strong>
            </div>

            <div className="metric-card">
              <span>Sample rate</span>
              <strong>{metrics.sampleRate}</strong>
            </div>

            <div className="metric-card">
              <span>Peak</span>
              <strong>{metrics.peak}</strong>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default AudioPreview;