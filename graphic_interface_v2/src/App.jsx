import { useState } from "react";
import Header from "./components/Header.jsx";
import AudioInput from "./components/AudioInput.jsx";
import AudioPreview from "./components/AudioPreview.jsx";
import LoadingAnalysis from "./components/LoadingAnalysis.jsx";
import Results from "./components/Results.jsx";
import { analyzeAudio } from "./services/api.js";

const analysisSteps = [
  {
    icon: "🎚️",
    title: "Preparing input...",
    text: "Preparing your audio for analysis.",
  },
  {
    icon: "🧠",
    title: "Extracting audio features...",
    text: "Reading pitch, energy and timbral information.",
  },
  {
    icon: "🎼",
    title: "Building the sound profile...",
    text: "Creating a clearer representation of your sound.",
  },
  {
    icon: "🔎",
    title: "Matching with the sample library...",
    text: "Comparing your input against available sounds.",
  },
  {
    icon: "📊",
    title: "Ranking best matches...",
    text: "Sorting the closest candidates.",
  },
  {
    icon: "✨",
    title: "Preparing final results...",
    text: "Preparing the recommendations for display.",
  },
];

function App() {
  const [audioData, setAudioData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasAnalyzedOnce, setHasAnalyzedOnce] = useState(false);

  function handleAudioReady(data) {
    setAudioData({
      ...data,
      trimStart: null,
      trimEnd: null,
    });

    setAnalysisResult(null);
    setErrorMessage("");
    setHasAnalyzedOnce(false);
  }

  function handleTrimChange(trimData) {
  setAudioData((current) => {
    if (!current) return current;

    if (
      current.trimStart === trimData.trimStart &&
      current.trimEnd === trimData.trimEnd
    ) {
      return current;
    }

    return {
      ...current,
      trimStart: trimData.trimStart,
      trimEnd: trimData.trimEnd,
    };
  });
}

  async function handleAnalyze() {
    if (!audioData) {
      setErrorMessage("Please upload or record an audio file first.");
      return;
    }

    try {
      setErrorMessage("");
      setAnalysisResult(null);
      setIsAnalyzing(true);
      setHasAnalyzedOnce(true);

      const result = await analyzeAudio(audioData);
      setAnalysisResult(result);
    } catch (error) {
      console.error(error);
      setErrorMessage("An error occurred while analyzing your audio. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="app">
      <Header />

      <section className="main-grid">
        <AudioInput audioData={audioData} onAudioReady={handleAudioReady} />
        <AudioPreview audioData={audioData} onTrimChange={handleTrimChange} />
      </section>

      <section className="analyze-section">
        <h2>3. Analyze</h2>
        <p>Start the analysis and let the system compare your sound with the library.</p>

        <button className="primary-button" onClick={handleAnalyze}>
          Analyze
        </button>

        <details className="analysis-details">
          <summary>View analysis process</summary>

          <div className="analysis-log">
            {analysisSteps.map((step) => (
              <div className="analysis-log-item" key={step.title}>
                <span>{step.icon}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </details>

        {audioData?.trimStart !== null &&
          audioData?.trimStart !== undefined &&
          audioData?.trimEnd !== null &&
          audioData?.trimEnd !== undefined && (
            <div className="trim-summary">
              Selected segment: {audioData.trimStart.toFixed(2)}s -{" "}
              {audioData.trimEnd.toFixed(2)}s
            </div>
          )}

        {hasAnalyzedOnce && !isAnalyzing && analysisResult && (
          <div className="success-box">Analysis completed</div>
        )}

        {errorMessage && <div className="warning-box">{errorMessage}</div>}
      </section>

      {isAnalyzing && <LoadingAnalysis />}

      {analysisResult && (
        <Results
          detectedClass={analysisResult.detected_class}
          confidence={analysisResult.confidence}
          recommendations={analysisResult.recommendations || []}
        />
      )}
    </main>
  );
}

export default App;