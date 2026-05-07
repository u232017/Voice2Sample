import { useState } from 'react';
import { Home } from './components/Home';
import { RecordUpload } from './components/RecordUpload';
import { Results } from './components/Results';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioProvider } from './context/AudioContext';
import { FreesoundProvider } from './context/FreesoundContext';

type Page = 'home' | 'input' | 'results';
type InputMode = 'record' | 'upload';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [initialInputMode, setInitialInputMode] = useState<InputMode>('record');

  const openInput = (mode: InputMode = 'record') => {
    setInitialInputMode(mode);
    setCurrentPage('input');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={openInput} />;
      case 'input':
        return (
          <RecordUpload
            initialMode={initialInputMode}
            onAnalyze={() => setCurrentPage('results')}
            onBack={() => setCurrentPage('home')}
          />
        );
      case 'results':
        return <Results onBack={() => setCurrentPage('input')} />;
      default:
        return <Home onNavigate={() => setCurrentPage('input')} />;
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
