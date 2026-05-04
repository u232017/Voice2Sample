import { useState } from "react";
import { Home } from "./components/Home";
import { RecordUpload } from "./components/RecordUpload";
import { Results } from "./components/Results";
import { Layout } from "./components/Layout";

type Page = "home" | "record" | "results";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <Home onNavigate={(mode) => setCurrentPage(mode === "upload" ? "record" : "record")} />;
      case "record":
        return <RecordUpload onAnalyze={() => setCurrentPage("results")} />;
      case "results":
        return <Results onBack={() => setCurrentPage("home")} />;
      default:
        return <Home onNavigate={() => setCurrentPage("record")} />;
    }
  };

  return (
    <Layout onHome={() => setCurrentPage("home")}>
      {renderPage()}
    </Layout>
  );
}
