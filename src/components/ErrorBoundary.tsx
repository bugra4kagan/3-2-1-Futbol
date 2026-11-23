import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { captureError } from '../services/telemetryService';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Beklenmeyen bir hata oluştu.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureError(error, {
      componentStack: String(info?.componentStack || '').slice(0, 280),
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleHardReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        data-testid="global-error-boundary"
        className="min-h-[100dvh] w-full bg-slate-950 text-white flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/45 p-6 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-400/40 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Bir şeyler ters gitti</h1>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Oyun geçici bir hatayla karşılaştı. İlerlemen güvende — hemen yeniden deneyebilirsin.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-slate-400 break-words">
            {this.state.errorMessage}
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              data-testid="error-boundary-retry-btn"
              onClick={this.handleRetry}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Yeniden Dene</span>
            </button>
            <button
              type="button"
              data-testid="error-boundary-reload-btn"
              onClick={this.handleHardReload}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Sayfayı Yenile</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
