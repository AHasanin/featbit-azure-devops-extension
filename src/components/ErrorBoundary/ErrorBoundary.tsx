import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorHandler from '../../utils/ErrorHandler';
import { PlatformError } from '../../types';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    const platformError: PlatformError = {
      name: 'PlatformError',
      type: 'platform',
      source: 'extension',
      message: error.message,
      code: 'REACT_ERROR_BOUNDARY',
      timestamp: new Date(),
      details: errorInfo.componentStack || 'No component stack available'
    };

    ErrorHandler.logError(platformError, 'React Error Boundary', {
      errorId: this.state.errorId || 'unknown',
      componentStack: errorInfo.componentStack || 'No component stack available'
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <h3 className="error-boundary__title">Something went wrong</h3>
            <p className="error-boundary__message">
              An unexpected error occurred in the extension. This has been logged for investigation.
            </p>
            {this.state.errorId && (
              <p className="error-boundary__error-id">
                Error ID: <code>{this.state.errorId}</code>
              </p>
            )}
            <div className="error-boundary__actions">
              <button 
                className="error-boundary__retry-button"
                onClick={this.handleRetry}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;