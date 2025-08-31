import { renderHook, act } from '@testing-library/react';
import { useErrorHandler } from '../../src/hooks/useErrorHandler';
import { NetworkError, AuthenticationError } from '../../src/types';
import ErrorHandler from '../../src/utils/ErrorHandler';

// Mock the ErrorHandler
jest.mock('../../src/utils/ErrorHandler');
const mockErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>;

describe('useErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockErrorHandler.logError = jest.fn();
    mockErrorHandler.formatErrorForUser = jest.fn();
  });

  it('should initialize with no error', () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(result.current.error).toBeNull();
    expect(result.current.isRetryable).toBe(false);
  });

  it('should set FeatBitError and format it', () => {
    const networkError: NetworkError = {
      type: 'network',
      code: 'TIMEOUT',
      message: 'Request timeout',
      timestamp: new Date()
    };

    const formattedError = {
      title: 'Connection Timeout',
      message: 'Request timed out',
      retryable: true
    };

    mockErrorHandler.formatErrorForUser.mockReturnValue(formattedError);

    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.setError(networkError);
    });

    expect(mockErrorHandler.formatErrorForUser).toHaveBeenCalledWith(networkError);
    expect(result.current.error).toEqual(formattedError);
    expect(result.current.isRetryable).toBe(true);
  });

  it('should set generic Error and format it', () => {
    const genericError = new Error('Something went wrong');

    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.setError(genericError);
    });

    expect(result.current.error).toEqual({
      title: 'Unexpected Error',
      message: 'Something went wrong',
      actionable: 'Please try again or contact support if the problem persists.',
      retryable: true
    });
    expect(result.current.isRetryable).toBe(true);
  });

  it('should handle Error with no message', () => {
    const errorWithoutMessage = new Error();

    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.setError(errorWithoutMessage);
    });

    expect(result.current.error).toEqual({
      title: 'Unexpected Error',
      message: 'An unexpected error occurred.',
      actionable: 'Please try again or contact support if the problem persists.',
      retryable: true
    });
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useErrorHandler());

    // Set an error first
    act(() => {
      result.current.setError(new Error('Test error'));
    });

    expect(result.current.error).not.toBeNull();

    // Clear the error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isRetryable).toBe(false);
  });

  it('should set error to null when passed null', () => {
    const { result } = renderHook(() => useErrorHandler());

    // Set an error first
    act(() => {
      result.current.setError(new Error('Test error'));
    });

    expect(result.current.error).not.toBeNull();

    // Set error to null
    act(() => {
      result.current.setError(null);
    });

    expect(result.current.error).toBeNull();
  });

  it('should handle error and log it', () => {
    const authError: AuthenticationError = {
      type: 'authentication',
      code: 'INVALID_API_KEY',
      message: 'Invalid API key',
      timestamp: new Date()
    };

    const formattedError = {
      title: 'Authentication Failed',
      message: 'Invalid API key',
      retryable: false
    };

    mockErrorHandler.formatErrorForUser.mockReturnValue(formattedError);

    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(authError);
    });

    expect(mockErrorHandler.logError).toHaveBeenCalledWith(
      authError,
      'Component Error Handler'
    );
    expect(mockErrorHandler.formatErrorForUser).toHaveBeenCalledWith(authError);
    expect(result.current.error).toEqual(formattedError);
    expect(result.current.isRetryable).toBe(false);
  });

  it('should handle generic error and log it', () => {
    const genericError = new Error('Generic error');

    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(genericError);
    });

    expect(mockErrorHandler.logError).toHaveBeenCalledWith(
      genericError,
      'Component Error Handler'
    );
    expect(result.current.error).toEqual({
      title: 'Unexpected Error',
      message: 'Generic error',
      actionable: 'Please try again or contact support if the problem persists.',
      retryable: true
    });
  });

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() => useErrorHandler());

    const initialSetError = result.current.setError;
    const initialClearError = result.current.clearError;
    const initialHandleError = result.current.handleError;

    rerender();

    expect(result.current.setError).toBe(initialSetError);
    expect(result.current.clearError).toBe(initialClearError);
    expect(result.current.handleError).toBe(initialHandleError);
  });
});