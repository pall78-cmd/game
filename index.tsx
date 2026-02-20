import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('Index.tsx executing...');
console.log('React version:', React.version);

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    const l = document.getElementById('loader');
    if (l) l.remove();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: 'black', height: '100vh', zIndex: 9999, position: 'relative' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  console.log('Root element found, mounting...');
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (e: any) {
    console.error('Mounting failed:', e);
  }

  // Fallback: Remove loader after 5s if it's still there
  setTimeout(() => {
    const l = document.getElementById('loader');
    if (l) {
      console.warn('Loader still present after 5s, forcing removal...');
      l.style.opacity = '0';
      setTimeout(() => l.remove(), 500);
    }
  }, 5000);
} else {
  console.error('Root element not found!');
}
