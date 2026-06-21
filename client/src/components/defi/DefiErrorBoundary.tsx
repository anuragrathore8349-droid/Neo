import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  section?: string;
}

export class DefiErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[DeFi ErrorBoundary] ${this.props.section || 'unknown'}:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-200">
          <h3 className="font-semibold mb-1">
            {this.props.section || 'Section'} failed to load
          </h3>
          <p className="text-sm text-red-300">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
