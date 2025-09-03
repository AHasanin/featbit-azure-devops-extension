import RetryHandler from '../../src/utils/RetryHandler';
import { NetworkError } from '../../src/types';

describe('RetryHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should return success on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await RetryHandler.executeWithRetry(mockOperation);

      expect(result).toEqual({
        success: true,
        data: 'success',
        attempts: 1
      });
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const networkError: NetworkError = {
        type: 'network',
        code: 'TIMEOUT',
        message: 'Request timeout',
        timestamp: new Date()
      };

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await RetryHandler.executeWithRetry(mockOperation, {
        maxAttempts: 3,
        baseDelay: 10 // Short delay for testing
      });

      expect(result).toEqual({
        success: true,
        data: 'success',
        attempts: 3
      });
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const authError = {
        type: 'authentication',
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
        timestamp: new Date()
      };

      const mockOperation = jest.fn().mockRejectedValue(authError);

      const result = await RetryHandler.executeWithRetry(mockOperation, {
        maxAttempts: 3,
        baseDelay: 10
      });

      expect(result).toEqual({
        success: false,
        error: authError,
        attempts: 1
      });
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max attempts', async () => {
      const networkError = new Error('Network error');
      const mockOperation = jest.fn().mockRejectedValue(networkError);

      const result = await RetryHandler.executeWithRetry(mockOperation, {
        maxAttempts: 2,
        baseDelay: 10
      });

      expect(result).toEqual({
        success: false,
        error: networkError,
        attempts: 2
      });
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should use exponential backoff', async () => {
      const networkError = new Error('timeout');
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const startTime = Date.now();
      
      await RetryHandler.executeWithRetry(mockOperation, {
        maxAttempts: 3,
        baseDelay: 100,
        backoffMultiplier: 2
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should have waited at least 100ms + 200ms = 300ms
      // (allowing some tolerance for test execution time)
      expect(totalTime).toBeGreaterThan(250);
    });

    it('should respect max delay', async () => {
      const networkError = new Error('timeout');
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const startTime = Date.now();
      
      await RetryHandler.executeWithRetry(mockOperation, {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 50, // Very low max delay
        backoffMultiplier: 10
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should not exceed max delay significantly
      expect(totalTime).toBeLessThan(200);
    });

    it('should identify retryable errors by message patterns', async () => {
      const timeoutError = new Error('Request timeout occurred');
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue('success');

      const result = await RetryHandler.executeWithRetry(mockOperation, {
        maxAttempts: 2,
        baseDelay: 10
      });

      expect(result.success).toBe(true);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should identify non-retryable errors by message patterns', async () => {
      const validationError = new Error('Invalid input data');
      const mockOperation = jest.fn().mockRejectedValue(validationError);

      const result = await RetryHandler.executeWithRetry(mockOperation, {
        maxAttempts: 3,
        baseDelay: 10
      });

      expect(result.success).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryApiCall', () => {
    it('should return data on success', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'test' });

      const result = await RetryHandler.retryApiCall(mockApiCall);

      expect(result).toEqual({ data: 'test' });
    });

    it('should throw error on failure', async () => {
      const error = new Error('API call failed');
      const mockApiCall = jest.fn().mockRejectedValue(error);

      await expect(RetryHandler.retryApiCall(mockApiCall, {
        maxAttempts: 1,
        baseDelay: 10
      })).rejects.toThrow('API call failed');
    });

    it('should use custom options', async () => {
      const networkError = new Error('timeout');
      const mockApiCall = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const result = await RetryHandler.retryApiCall(mockApiCall, {
        maxAttempts: 2,
        baseDelay: 10
      });

      expect(result).toBe('success');
      expect(mockApiCall).toHaveBeenCalledTimes(2);
    });
  });

  describe('error pattern matching', () => {
    const testCases = [
      { message: 'Request timeout', shouldRetry: true },
      { message: 'Connection refused', shouldRetry: true },
      { message: 'Network error occurred', shouldRetry: true },
      { message: 'fetch failed', shouldRetry: true },
      { message: 'ECONNREFUSED', shouldRetry: true },
      { message: 'ETIMEDOUT', shouldRetry: true },
      { message: 'Invalid input', shouldRetry: false },
      { message: 'Authentication failed', shouldRetry: false },
      { message: 'Permission denied', shouldRetry: false }
    ];

    testCases.forEach(({ message, shouldRetry }) => {
      it(`should ${shouldRetry ? 'retry' : 'not retry'} for error: ${message}`, async () => {
        const error = new Error(message);
        const mockOperation = jest.fn().mockRejectedValue(error);

        const result = await RetryHandler.executeWithRetry(mockOperation, {
          maxAttempts: 2,
          baseDelay: 10
        });

        if (shouldRetry) {
          expect(mockOperation).toHaveBeenCalledTimes(2);
        } else {
          expect(mockOperation).toHaveBeenCalledTimes(1);
        }
      });
    });
  });
});