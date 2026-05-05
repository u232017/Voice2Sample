import { useEffect, useState } from "react";

export const analysisSteps = [
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

function LoadingAnalysis() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((current) => (current + 1) % analysisSteps.length);
    }, 650);

    return () => clearInterval(interval);
  }, []);

  const currentStep = analysisSteps[stepIndex];
  const progress = ((stepIndex + 1) / analysisSteps.length) * 100;

  return (
    <section className="loading-card">
      <div className="loading-icon">{currentStep.icon}</div>
      <h3>{currentStep.title}</h3>
      <p>{currentStep.text}</p>

      <div className="loading-bar">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }}></div>
      </div>
    </section>
  );
}

export default LoadingAnalysis;