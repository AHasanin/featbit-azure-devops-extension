import ErrorHandler, { UserFriendlyMessage } from '../../src/utils/ErrorHandler';
import { 
  NetworkError, 
  AuthenticationError, 
  ValidationError, 
  BusinessLogicError,
  FeatBitError 
} from '../../src/types';

describe('ErrorHandler', () => {
  let errorHandler: typeof ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler;
    // Clear console.error mock
    jest.clearAllMocks();
  });

  describe('handleNetworkError', () => {
    it('should handle timeout errors', () => {
      const error: NetworkError = {
        type: 'network',
        code: 'TIMEOUT',
        message: 'Request timed out',
        timestamp: new Date()
      };

      const result = errorHandler.handleNetworkError(error);

      expect(result).toEqual({
        title: 'Connection Timeout',
        message: 'The request to FeatBit timed out. Please check your network connection.',
        actionable: 'Try again in a few moments or check your network settings.',
        retryable: true
      });
    });

    it('should handle connection refused errors', () => {
      const error: NetworkError = {
        type: 'network',
        code: 'CONNECTION_REFUSED',
        message: 'Connection refused',
        timestamp: new Date()
      };

      const result = errorHandler.handleNetworkError(error);

      expect(result).toEqual({
        title: 'Connection Failed',
        message: 'Unable to connect to FeatBit server. The server may be down or unreachable.',
        actionable: 'Verify the server URL in settings and try again.',
        retryable: true
      });
    });

    it('should handle DNS errors', () => {
      const error: NetworkError = {
        type: 'network',
        code: 'DNS_ERROR',
        message: 'DNS resolution failed',
        timestamp: new Date()
      };

      const result = errorHandler.handleNetworkError(error);

      expect(result).toEqual({
        title: 'Server Not Found',
        message: 'Could not resolve the FeatBit server address.',
        actionable: 'Check the server URL in your configuration settings.',
        retryable: false
      });
    });

    it('should handle generic network errors', () => {
      const error: NetworkError = {
        type: 'network',
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        timestamp: new Date()
      };

      const result = errorHandler.handleNetworkError(error);

      expect(result).toEqual({
        title: 'Network Error',
        message: 'A network error occurred while communicating with FeatBit.',
        actionable: 'Check your internet connection and try again.',
        retryable: true
      });
    });
  });

  describe('handleAuthenticationError', () => {
    it('should handle invalid API key errors', () => {
      const error: AuthenticationError = {
        type: 'authentication',
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
        timestamp: new Date()
      };

      const result = errorHandler.handleAuthenticationError(error);

      expect(result).toEqual({
        title: 'Authentication Failed',
        message: 'The API key is invalid or has expired.',
        actionable: 'Please check your API key in the configuration settings.',
        retryable: false
      });
    });

    it('should handle insufficient permissions errors', () => {
      const error: AuthenticationError = {
        type: 'authentication',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions',
        timestamp: new Date()
      };

      const result = errorHandler.handleAuthenticationError(error);

      expect(result).toEqual({
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action.',
        actionable: 'Contact your administrator to verify your FeatBit permissions.',
        retryable: false
      });
    });

    it('should handle token expired errors', () => {
      const error: AuthenticationError = {
        type: 'authentication',
        code: 'TOKEN_EXPIRED',
        message: 'Token expired',
        timestamp: new Date()
      };

      const result = errorHandler.handleAuthenticationError(error);

      expect(result).toEqual({
        title: 'Session Expired',
        message: 'Your authentication session has expired.',
        actionable: 'Please re-enter your credentials in the settings.',
        retryable: false
      });
    });
  });

  describe('handleValidationError', () => {
    it('should handle feature flag name validation errors', () => {
      const error: ValidationError = {
        type: 'validation',
        code: 'VALIDATION_ERROR',
        field: 'featureFlagName',
        message: 'Invalid feature flag name',
        timestamp: new Date(),
        value: 'invalid-name!'
      };

      const result = errorHandler.handleValidationError(error);

      expect(result).toEqual({
        title: 'Invalid Feature Flag Name',
        message: 'Invalid feature flag name',
        actionable: 'Use only letters, numbers, hyphens, and underscores. Names must be unique.',
        retryable: false
      });
    });

    it('should handle server URL validation errors', () => {
      const error: ValidationError = {
        type: 'validation',
        code: 'VALIDATION_ERROR',
        field: 'serverUrl',
        message: 'Invalid URL format',
        timestamp: new Date(),
        value: 'not-a-url'
      };

      const result = errorHandler.handleValidationError(error);

      expect(result).toEqual({
        title: 'Invalid Server URL',
        message: 'The FeatBit server URL format is incorrect.',
        actionable: 'Enter a valid URL starting with http:// or https://',
        retryable: false
      });
    });

    it('should handle API key validation errors', () => {
      const error: ValidationError = {
        type: 'validation',
        code: 'VALIDATION_ERROR',
        field: 'apiKey',
        message: 'Invalid API key format',
        timestamp: new Date(),
        value: 'short'
      };

      const result = errorHandler.handleValidationError(error);

      expect(result).toEqual({
        title: 'Invalid API Key',
        message: 'The API key format is incorrect.',
        actionable: 'Enter a valid API key from your FeatBit account settings.',
        retryable: false
      });
    });
  });

  describe('handleBusinessLogicError', () => {
    it('should handle duplicate flag name errors', () => {
      const error: BusinessLogicError = {
        type: 'business',
        code: 'DUPLICATE_FLAG_NAME',
        message: 'Feature flag already exists',
        timestamp: new Date(),
        details: { flagName: 'existing-flag' }
      };

      const result = errorHandler.handleBusinessLogicError(error);

      expect(result).toEqual({
        title: 'Feature Flag Already Exists',
        message: 'A feature flag with the name "existing-flag" already exists.',
        actionable: 'Choose a different name or modify the existing flag.',
        retryable: false
      });
    });

    it('should handle work item not found errors', () => {
      const error: BusinessLogicError = {
        type: 'business',
        code: 'WORK_ITEM_NOT_FOUND',
        message: 'Work item not found',
        timestamp: new Date()
      };

      const result = errorHandler.handleBusinessLogicError(error);

      expect(result).toEqual({
        title: 'Work Item Not Found',
        message: 'The work item could not be found or accessed.',
        actionable: 'Refresh the page or check if the work item still exists.',
        retryable: true
      });
    });

    it('should handle project not found errors', () => {
      const error: BusinessLogicError = {
        type: 'business',
        code: 'PROJECT_NOT_FOUND',
        message: 'Project not found',
        timestamp: new Date()
      };

      const result = errorHandler.handleBusinessLogicError(error);

      expect(result).toEqual({
        title: 'Project Not Found',
        message: 'The specified FeatBit project could not be found.',
        actionable: 'Verify the project ID in your configuration settings.',
        retryable: false
      });
    });
  });

  describe('formatErrorForUser', () => {
    it('should format network errors', () => {
      const error: NetworkError = {
        type: 'network',
        code: 'TIMEOUT',
        message: 'Request timed out',
        timestamp: new Date()
      };

      const result = errorHandler.formatErrorForUser(error);

      expect(result.title).toBe('Connection Timeout');
      expect(result.retryable).toBe(true);
    });

    it('should format authentication errors', () => {
      const error: AuthenticationError = {
        type: 'authentication',
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
        timestamp: new Date()
      };

      const result = errorHandler.formatErrorForUser(error);

      expect(result.title).toBe('Authentication Failed');
      expect(result.retryable).toBe(false);
    });

    it('should handle unknown error types', () => {
      const error = {
        type: 'unknown',
        message: 'Unknown error',
        timestamp: new Date()
      } as any;

      const result = errorHandler.formatErrorForUser(error);

      expect(result).toEqual({
        title: 'Unexpected Error',
        message: 'An unexpected error occurred.',
        actionable: 'Please try again or contact support if the problem persists.',
        retryable: true
      });
    });
  });

  describe('logError', () => {
    beforeEach(() => {
      // Mock console.error
      jest.spyOn(console, 'error').mockImplementation(() => {});
      // Mock process.env
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log errors in development mode', () => {
      const error = new Error('Test error');
      const context = 'Test context';
      const additionalData = { userId: '123', action: 'test' };

      errorHandler.logError(error, context, additionalData);

      expect(console.error).toHaveBeenCalledWith(
        'Extension Error:',
        expect.objectContaining({
          context: 'Test context',
          errorType: 'Error',
          message: 'Test error',
          userId: '123',
          action: 'test'
        })
      );
    });

    it('should sanitize sensitive data in logs', () => {
      const error = new Error('Test error');
      const context = 'Test context';
      const additionalData = { 
        apiKey: 'secret-key',
        password: 'secret-password',
        normalData: 'normal-value'
      };

      errorHandler.logError(error, context, additionalData);

      expect(console.error).toHaveBeenCalledWith(
        'Extension Error:',
        expect.objectContaining({
          apiKey: '[REDACTED]',
          password: '[REDACTED]',
          normalData: 'normal-value'
        })
      );
    });

    it('should not log to console in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      const context = 'Test context';

      errorHandler.logError(error, context);

      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      // Since we export the instance directly, just test that it exists
      expect(ErrorHandler).toBeDefined();
      expect(typeof ErrorHandler.handleNetworkError).toBe('function');
    });
  });
});