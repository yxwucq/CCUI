import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback || (
          <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg m-4">
            <h3 className="text-red-400 font-semibold mb-2">Something went wrong</h3>
            <pre className="text-xs text-red-300 whitespace-pre-wrap">{this.state.error.message}</pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-3 px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm transition-colors"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
