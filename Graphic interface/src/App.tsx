import { useState } from 'react';
import { Home } from './components/Home';
import { RecordUpload } from './components/RecordUpload';
import { Results } from './components/Results';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioProvider } from './context/AudioContext';
import { FreesoundProvider } from './context/FreesoundContext';

type Page = 'home' | 'record' | 'results';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={() => setCurrentPage('record')} />;
      case 'record':
        return <RecordUpload onAnalyze={() => setCurrentPage('results')} />;
      case 'results':
        return <Results onBack={() => setCurrentPage('record')} />;
      default:
        return <Home onNavigate={() => setCurrentPage('record')} />;
    }
  };

  return (
    <ErrorBoundary>
      <AudioProvider>
        <FreesoundProvider>
          <Layout onHome={() => setCurrentPage('home')}>
            {renderPage()}
          </Layout>
        </FreesoundProvider>
      </AudioProvider>
    </ErrorBoundary>
  );
}
