import React from 'react';
import { UserFriendlyMessage } from '../../utils/ErrorHandler';
import './ErrorDisplay.css';

interface ErrorDisplayProps {
  error: UserFriendlyMessage;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = ''
}) => {
  const getIconForSeverity = (retryable?: boolean) => {
    if (retryable) {
      return '⚠️';
    }
    return '❌';
  };

  return (
    <div className={`error-display ${className}`}>
      <div className="error-display__content">
        <div className="error-display__header">
          <span className="error-display__icon">
            {getIconForSeverity(error.retryable)}
          </span>
          <h4 className="error-display__title">{error.title}</h4>
          {onDismiss && (
            <button
              className="error-display__dismiss"
              onClick={onDismiss}
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
        
        <p className="error-display__message">{error.message}</p>
        
        {error.actionable && (
          <p className="error-display__actionable">{error.actionable}</p>
        )}
        
        {(onRetry && error.retryable) && (
          <div className="error-display__actions">
            <button
              className="error-display__retry-button"
              onClick={onRetry}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;