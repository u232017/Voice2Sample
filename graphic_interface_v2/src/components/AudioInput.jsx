import { useRef, useState } from "react";

function shortenName(name) {
  if (!name) return "";
  return name.length > 34 ? `${name.slice(0, 18)}...${name.slice(-12)}` : name;
}

function AudioInput({ audioData, onAudioReady }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const audioUrl = URL.createObjectURL(file);

    onAudioReady({
      blob: file,
      url: audioUrl,
      name: file.name,
      sourceType: "Uploaded input",
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(blob);

        onAudioReady({
          blob,
          url: audioUrl,
          name: "Recorded audio",
          sourceType: "Recorded input",
        });

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      alert("Microphone access was not allowed.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  return (
    <section className="section-block">
      <h2>1. Input audio</h2>
      <p>You can upload an audio file or record directly from the microphone.</p>

      <div className="input-card">
        <label className="input-label">Upload an audio file</label>

        <label className="upload-button">
          ⬆ Upload
          <input type="file" accept="audio/*" onChange={handleFileUpload} />
        </label>

        {audioData?.name && (
          <span className="selected-file">{shortenName(audioData.name)}</span>
        )}

        <p className="file-hint">WAV, MP3, OGG, FLAC, M4A or WEBM</p>
      </div>

      <div className="input-card">
        <label className="input-label">Or record a sound with the microphone</label>

        {!isRecording ? (
          <button className="secondary-button" onClick={startRecording}>
            🎙 Start recording
          </button>
        ) : (
          <button className="danger-button recording-button" onClick={stopRecording}>
            ● Stop recording
          </button>
        )}
      </div>
    </section>
  );
}

export default AudioInput;