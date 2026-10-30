import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-100">Something went wrong</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                An unexpected application error occurred. We have isolated the problem so your saved data remains safe.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-left overflow-x-auto text-[11px] font-mono text-rose-300/80 max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                onClick={this.handleReset}
                className="w-full sm:w-auto"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Home size={14} />}
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="w-full sm:w-auto"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
