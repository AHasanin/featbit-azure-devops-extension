import { NetworkError } from '../types';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

export class RetryHandler {
  private static defaultOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    retryableErrors: ['TIMEOUT', 'CONNECTION_REFUSED', 'NETWORK_ERROR']
  };

  public static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const config = { ...this.defaultOptions, ...options };
    let lastError: Error;
    let attempts = 0;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      attempts = attempt;
      
      try {
        const result = await operation();
        return {
          success: true,
          data: result,
          attempts
        };
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error as Error, config.retryableErrors)) {
          break;
        }

        // Don't wait after the last attempt
        if (attempt < config.maxAttempts) {
          const delay = this.calculateDelay(attempt, config);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError!,
      attempts
    };
  }

  private static isRetryableError(error: Error, retryableErrors: string[]): boolean {
    // Check if it's a NetworkError with a retryable code
    if ('type' in error && (error as any).type === 'network') {
      const networkError = error as unknown as NetworkError;
      return retryableErrors.includes(networkError.code);
    }

    // Check for common network error patterns in error messages
    const errorMessage = error.message.toLowerCase();
    const networkErrorPatterns = [
      'timeout',
      'connection refused',
      'network error',
      'fetch failed',
      'econnrefused',
      'etimedout'
    ];

    return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  private static calculateDelay(attempt: number, config: RetryOptions): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    return Math.min(exponentialDelay + jitter, config.maxDelay);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience method for API calls
  public static async retryApiCall<T>(
    apiCall: () => Promise<T>,
    customOptions?: Partial<RetryOptions>
  ): Promise<T> {
    const result = await this.executeWithRetry(apiCall, customOptions);
    
    if (result.success) {
      return result.data!;
    }
    
    throw result.error;
  }
}

export default RetryHandler;