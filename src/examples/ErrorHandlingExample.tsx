import React, { useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { FeatBitService } from '../services/FeatBitService';
import { RetryHandler } from '../utils/RetryHandler';

/**
 * Example component demonstrating comprehensive error handling
 * This shows how all the error handling components work together
 */
export const ErrorHandlingExample: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { error, handleError, clearError } = useErrorHandler();
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);

  const featBitService = new FeatBitService();

  const handleLoadFeatureFlags = async () => {
    setIsLoading(true);
    clearError();

    try {
      // Use retry handler for API calls
      const flags = await RetryHandler.retryApiCall(
        () => featBitService.getFeatureFlags('project-123'),
        {
          maxAttempts: 3,
          baseDelay: 1000
        }
      );
      
      setFeatureFlags(flags);
    } catch (err) {
      // Use error handler to process and display user-friendly errors
      handleError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    handleLoadFeatureFlags();
  };

  return (
    <ErrorBoundary>
      <div className="error-handling-example">
        <h2>Feature Flags</h2>
        
        <button 
          onClick={handleLoadFeatureFlags}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Load Feature Flags'}
        </button>

        {/* Display errors using ErrorDisplay component */}
        {error && (
          <ErrorDisplay
            error={error}
            onRetry={error.retryable ? handleRetry : undefined}
            onDismiss={clearError}
          />
        )}

        {/* Display feature flags */}
        {featureFlags.length > 0 && (
          <div className="feature-flags-list">
            {featureFlags.map(flag => (
              <div key={flag.id} className="feature-flag-item">
                <span>{flag.name}</span>
                <span>{flag.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

/**
 * Example of a component that might throw an error
 * This demonstrates how ErrorBoundary catches and handles React errors
 */
export const ProblematicComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('This component intentionally threw an error for demonstration');
  }

  return <div>This component is working fine!</div>;
};

/**
 * Example showing ErrorBoundary usage with custom fallback
 */
export const ErrorBoundaryExample: React.FC = () => {
  const [shouldThrow, setShouldThrow] = useState(false);

  const customErrorFallback = (
    <div style={{ padding: '20px', backgroundColor: '#fee', border: '1px solid #fcc' }}>
      <h3>Custom Error Fallback</h3>
      <p>This is a custom error display instead of the default ErrorBoundary UI.</p>
      <button onClick={() => setShouldThrow(false)}>
        Reset Component
      </button>
    </div>
  );

  return (
    <div>
      <h2>Error Boundary Example</h2>
      
      <button onClick={() => setShouldThrow(!shouldThrow)}>
        {shouldThrow ? 'Fix Component' : 'Break Component'}
      </button>

      <ErrorBoundary fallback={customErrorFallback}>
        <ProblematicComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </div>
  );
};

export default ErrorHandlingExample;