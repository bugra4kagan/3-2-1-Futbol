import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { LanguageProvider } from './game/LanguageContext.tsx';
import { initTelemetry } from './services/telemetryService.ts';
import { initPwaServiceWorker } from './services/pwaUpdateService.ts';
import './index.css';

initTelemetry();
initPwaServiceWorker();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ErrorBoundary>
);
