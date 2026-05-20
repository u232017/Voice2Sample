import { Component, ReactNode } from 'react';
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
        <div className="m-6 rounded-lg border border-red-400/30 bg-red-950/30 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 text-red-300" size={20} />
            <div>
              <h3 className="font-bold text-red-100">Something went wrong</h3>
              <p className="mt-1 text-sm text-red-200/80">{this.state.error?.message}</p>
              <button
                onClick={this.reset}
                className="mt-3 rounded-md border border-red-300/30 bg-red-300/10 px-4 py-2 text-red-100 transition-colors hover:bg-red-300/20"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
