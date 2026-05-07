import { useState } from 'react';
import { RecordUpload } from './components/RecordUpload';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AudioProvider } from './context/AudioContext';
import { FreesoundProvider } from './context/FreesoundContext';
import { WelcomeScreen } from './components/WelcomeScreen';

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);

  return (
    <ErrorBoundary>
      <AudioProvider>
        <FreesoundProvider>
          {hasStarted ? (
            <Layout onHome={() => setHasStarted(false)}>
              <RecordUpload />
            </Layout>
          ) : (
            <WelcomeScreen onStart={() => setHasStarted(true)} />
          )}
        </FreesoundProvider>
      </AudioProvider>
    </ErrorBoundary>
  );
}
