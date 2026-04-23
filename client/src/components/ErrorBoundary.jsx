import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-primary flex items-center justify-center p-8">
          <div className="card p-12 max-w-xl w-full text-center bg-surface-card/60 backdrop-blur-xl border-white/[0.04] shadow-2xl">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-8 flex items-center justify-center bg-accent-rose/10 border border-accent-rose/20">
              <AlertTriangle className="w-10 h-10 text-accent-rose" />
            </div>
            <h1 className="text-3xl font-black text-text-primary mb-4 tracking-tight">System Interruption</h1>
            <p className="text-text-secondary text-base leading-relaxed mb-10 font-medium">
              We've encountered an unexpected error. The intelligence intake pipeline has been paused 
              to prevent data corruption.
            </p>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] text-left mb-10">
               <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Technical Signal</p>
               <code className="text-xs text-accent-rose break-all">{this.state.error?.message || 'Unknown Exception'}</code>
            </div>
            <button
              onClick={this.handleReset}
              className="btn-primary w-full py-5 text-base font-bold flex items-center justify-center space-x-3"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Restart Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
