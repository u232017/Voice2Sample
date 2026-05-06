function sampleIcon(type) {
  const icons = {
    Melodic: "🎹",
    Voice: "🎤",
    Synth: "🎛️",
    Hybrid: "🎵",
  };

  return icons[type] || "🎶";
}

function ResultCard({ sample }) {
  const hasPreview = Boolean(sample.preview_url);
  const hasDownload = Boolean(sample.download_url);
  const hasFreesoundUrl = Boolean(sample.url);
  const hasWaveformImage = Boolean(sample.waveform_image);

  return (
    <article className="result-card-js">
      <div className="result-top">
        <div className="result-left">
          <div className="result-icon">{sampleIcon(sample.ui_type)}</div>

          <div>
            <h3>{sample.name}</h3>
            <p>{sample.category}</p>
          </div>
        </div>

        <span className="score-pill">{sample.match_score}% match</span>
      </div>

      {sample.meta && <p className="result-meta">{sample.meta}</p>}

      <p className="result-info">
        Type: {sample.ui_type} • Timbre: {sample.timbre || "Not specified"} • Rhythm:{" "}
        {sample.rhythm || "Not specified"}
      </p>

      <p className="result-info">
        Duration: {sample.duration}s • License: {sample.license}
      </p>

      {hasWaveformImage && (
        <img
          className="result-waveform-image"
          src={sample.waveform_image}
          alt={`Waveform of ${sample.name}`}
        />
      )}

      {hasPreview ? (
        <audio className="audio-player result-audio" src={sample.preview_url} controls />
      ) : (
        <p className="missing-preview">
          Preview will appear when the backend sends a preview URL.
        </p>
      )}

      <div className="result-actions">
        {hasDownload && (
          <a className="download-button" href={sample.download_url} download>
            ⬇ Download
          </a>
        )}

        {hasFreesoundUrl && (
          <a className="freesound-link" href={sample.url} target="_blank" rel="noreferrer">
            Open in Freesound
          </a>
        )}
      </div>
    </article>
  );
}

export default ResultCard;