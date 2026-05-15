import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Chunk load error checking
      const isChunkLoadError = this.state.error?.name === 'ChunkLoadError' || 
                               this.state.error?.message?.includes('Failed to fetch dynamically imported module');
                               
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {isChunkLoadError ? 'Update Available' : 'Something went wrong'}
            </h2>
            <p className="text-slate-600 mb-6 text-sm">
              {isChunkLoadError 
                ? 'A new version of the application is available. Please refresh the page to update.' 
                : 'An unexpected error occurred while loading this component.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-[#1eb5ee] text-white font-semibold rounded-lg hover:bg-[#159bd0] transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && !isChunkLoadError && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg text-left overflow-auto text-xs text-red-500 font-mono">
                {this.state.error?.toString()}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
