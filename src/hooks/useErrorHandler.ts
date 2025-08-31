import { useState, useCallback } from 'react';
import ErrorHandler, { UserFriendlyMessage } from '../utils/ErrorHandler';
import { FeatBitError } from '../types';

interface UseErrorHandlerReturn {
  error: UserFriendlyMessage | null;
  setError: (error: FeatBitError | Error | null) => void;
  clearError: () => void;
  handleError: (error: FeatBitError | Error) => void;
  isRetryable: boolean;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const [error, setErrorState] = useState<UserFriendlyMessage | null>(null);

  const setError = useCallback((error: FeatBitError | Error | null) => {
    if (!error) {
      setErrorState(null);
      return;
    }

    let userFriendlyMessage: UserFriendlyMessage;

    if ('type' in error) {
      // It's a FeatBitError
      userFriendlyMessage = ErrorHandler.formatErrorForUser(error as FeatBitError);
    } else {
      // It's a generic Error
      userFriendlyMessage = {
        title: 'Unexpected Error',
        message: error.message || 'An unexpected error occurred.',
        actionable: 'Please try again or contact support if the problem persists.',
        retryable: true
      };
    }

    setErrorState(userFriendlyMessage);
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const handleError = useCallback((error: FeatBitError | Error) => {
    // Log the error
    ErrorHandler.logError(error, 'Component Error Handler');
    
    // Set user-friendly error message
    setError(error);
  }, [setError]);

  return {
    error,
    setError,
    clearError,
    handleError,
    isRetryable: error?.retryable ?? false
  };
};

export default useErrorHandler;