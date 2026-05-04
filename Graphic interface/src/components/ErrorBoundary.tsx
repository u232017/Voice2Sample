import React, { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught by boundary:', error);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-900/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-1" size={20} />
            <div>
              <h3 className="font-bold text-red-400">Algo salió mal</h3>
              <p className="text-sm text-red-300/70 mt-1">{this.state.error?.message}</p>
              <button
                onClick={this.reset}
                className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
