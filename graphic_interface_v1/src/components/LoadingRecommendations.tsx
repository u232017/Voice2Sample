const loadingLabels = ['Searching Freesound...', 'Loading real sound previews...', 'Preparing recommendations...'];

export function LoadingRecommendations() {
  return (
    <div className="recommendation-loading-card" role="status" aria-live="polite">
      <div className="loading-orbit" aria-hidden="true">
        <div className="loading-eq">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} style={{ animationDelay: `${index * 0.08}s` }} />
          ))}
        </div>
      </div>
      <div className="loading-copy">
        {loadingLabels.map((label, index) => (
          <p key={label} style={{ animationDelay: `${index * 1}s` }}>
            {label}
          </p>
        ))}
      </div>
    </div>
  );
}
