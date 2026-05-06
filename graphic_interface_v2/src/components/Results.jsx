import { useState } from "react";
import ResultCard from "./ResultCard.jsx";

function Results({ detectedClass, confidence, recommendations }) {
  const [filters, setFilters] = useState({
    category: "All",
    timbre: "All",
    rhythm: "All",
    minScore: "0",
  });

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  const filteredRecommendations = recommendations.filter((sample) => {
    const categoryMatch =
      filters.category === "All" || sample.category === filters.category;

    const timbreMatch =
      filters.timbre === "All" || sample.timbre === filters.timbre;

    const rhythmMatch =
      filters.rhythm === "All" || sample.rhythm === filters.rhythm;

    const scoreMatch = sample.match_score >= Number(filters.minScore);

    return categoryMatch && timbreMatch && rhythmMatch && scoreMatch;
  });

  return (
    <section className="results-section">
      <h2>Results</h2>

      <div className="summary-grid">
        <div className="metric-card">
          <span>Detected class</span>
          <strong>{detectedClass}</strong>
        </div>

        <div className="metric-card">
          <span>Confidence</span>
          <strong>{Math.round(confidence * 100)}%</strong>
        </div>
      </div>

      <div className="filter-card">
        <div>
          <h3>Filters</h3>
          <p>Prototype filters prepared for future backend descriptors.</p>
        </div>

        <div className="filter-grid">
          <label>
            Category
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option>All</option>
              <option>Melodic</option>
              <option>Voice</option>
              <option>Synth</option>
              <option>Hybrid</option>
            </select>
          </label>

          <label>
            Timbre
            <select
              value={filters.timbre}
              onChange={(event) => updateFilter("timbre", event.target.value)}
            >
              <option>All</option>
              <option>Bright</option>
              <option>Warm</option>
              <option>Dark</option>
              <option>Noisy</option>
              <option>Clean</option>
            </select>
          </label>

          <label>
            Rhythm
            <select
              value={filters.rhythm}
              onChange={(event) => updateFilter("rhythm", event.target.value)}
            >
              <option>All</option>
              <option>One-shot</option>
              <option>Loop</option>
              <option>Percussive</option>
              <option>Sustained</option>
            </select>
          </label>

          <label>
            Minimum match
            <select
              value={filters.minScore}
              onChange={(event) => updateFilter("minScore", event.target.value)}
            >
              <option value="0">All</option>
              <option value="70">70%+</option>
              <option value="80">80%+</option>
              <option value="90">90%+</option>
            </select>
          </label>
        </div>
      </div>

      {!recommendations || recommendations.length === 0 ? (
        <div className="warning-box">There are no results similar to your audio</div>
      ) : filteredRecommendations.length === 0 ? (
        <div className="warning-box">No samples match the selected filters.</div>
      ) : (
        <>
          <h2>Recommended samples</h2>

          <div className="results-grid">
            {filteredRecommendations.map((sample) => (
              <ResultCard key={sample.freesound_id || sample.name} sample={sample} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default Results;