import { FeatBitError, NetworkError, AuthenticationError, ValidationError, BusinessLogicError } from '../types';

export interface UserFriendlyMessage {
  title: string;
  message: string;
  actionable?: string;
  retryable?: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private logLevel: 'error' | 'warn' | 'info' = 'error';

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleNetworkError(error: NetworkError): UserFriendlyMessage {
    switch (error.code) {
      case 'TIMEOUT':
        return {
          title: 'Connection Timeout',
          message: 'The request to FeatBit timed out. Please check your network connection.',
          actionable: 'Try again in a few moments or check your network settings.',
          retryable: true
        };
      case 'CONNECTION_REFUSED':
        return {
          title: 'Connection Failed',
          message: 'Unable to connect to FeatBit server. The server may be down or unreachable.',
          actionable: 'Verify the server URL in settings and try again.',
          retryable: true
        };
      case 'DNS_ERROR':
        return {
          title: 'Server Not Found',
          message: 'Could not resolve the FeatBit server address.',
          actionable: 'Check the server URL in your configuration settings.',
          retryable: false
        };
      default:
        return {
          title: 'Network Error',
          message: 'A network error occurred while communicating with FeatBit.',
          actionable: 'Check your internet connection and try again.',
          retryable: true
        };
    }
  }

  public handleAuthenticationError(error: AuthenticationError): UserFriendlyMessage {
    switch (error.code) {
      case 'INVALID_API_KEY':
        return {
          title: 'Authentication Failed',
          message: 'The API key is invalid or has expired.',
          actionable: 'Please check your API key in the configuration settings.',
          retryable: false
        };
      case 'INSUFFICIENT_PERMISSIONS':
        return {
          title: 'Access Denied',
          message: 'You don\'t have permission to perform this action.',
          actionable: 'Contact your administrator to verify your FeatBit permissions.',
          retryable: false
        };
      case 'TOKEN_EXPIRED':
        return {
          title: 'Session Expired',
          message: 'Your authentication session has expired.',
          actionable: 'Please re-enter your credentials in the settings.',
          retryable: false
        };
      default:
        return {
          title: 'Authentication Error',
          message: 'Authentication with FeatBit failed.',
          actionable: 'Verify your credentials in the configuration settings.',
          retryable: false
        };
    }
  }

  public handleValidationError(error: ValidationError): UserFriendlyMessage {
    switch (error.field) {
      case 'featureFlagName':
        return {
          title: 'Invalid Feature Flag Name',
          message: error.message || 'The feature flag name is invalid.',
          actionable: 'Use only letters, numbers, hyphens, and underscores. Names must be unique.',
          retryable: false
        };
      case 'serverUrl':
        return {
          title: 'Invalid Server URL',
          message: 'The FeatBit server URL format is incorrect.',
          actionable: 'Enter a valid URL starting with http:// or https://',
          retryable: false
        };
      case 'apiKey':
        return {
          title: 'Invalid API Key',
          message: 'The API key format is incorrect.',
          actionable: 'Enter a valid API key from your FeatBit account settings.',
          retryable: false
        };
      default:
        return {
          title: 'Validation Error',
          message: error.message || 'The provided data is invalid.',
          actionable: 'Please check your input and try again.',
          retryable: false
        };
    }
  }

  public handleBusinessLogicError(error: BusinessLogicError): UserFriendlyMessage {
    switch (error.code) {
      case 'DUPLICATE_FLAG_NAME':
        return {
          title: 'Feature Flag Already Exists',
          message: `A feature flag with the name "${error.details?.flagName}" already exists.`,
          actionable: 'Choose a different name or modify the existing flag.',
          retryable: false
        };
      case 'WORK_ITEM_NOT_FOUND':
        return {
          title: 'Work Item Not Found',
          message: 'The work item could not be found or accessed.',
          actionable: 'Refresh the page or check if the work item still exists.',
          retryable: true
        };
      case 'PROJECT_NOT_FOUND':
        return {
          title: 'Project Not Found',
          message: 'The specified FeatBit project could not be found.',
          actionable: 'Verify the project ID in your configuration settings.',
          retryable: false
        };
      default:
        return {
          title: 'Operation Failed',
          message: error.message || 'The operation could not be completed.',
          actionable: 'Please try again or contact support if the problem persists.',
          retryable: true
        };
    }
  }

  public logError(error: Error, context: string, additionalData?: Record<string, any>): void {
    // Create sanitized log entry that doesn't include sensitive data
    const sanitizedData = this.sanitizeLogData(additionalData);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      context,
      errorType: error.constructor.name,
      message: error.message,
      stack: error.stack,
      ...sanitizedData
    };

    // In a real implementation, this would send to a logging service
    // For now, we'll use console.error in development
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      console.error('Extension Error:', logEntry);
    }

    // In production, send to Azure DevOps extension logging or external service
    this.sendToLoggingService(logEntry);
  }

  public formatErrorForUser(error: FeatBitError): UserFriendlyMessage {
    switch (error.type) {
      case 'network':
        return this.handleNetworkError(error as NetworkError);
      case 'authentication':
        return this.handleAuthenticationError(error as AuthenticationError);
      case 'validation':
        return this.handleValidationError(error as ValidationError);
      case 'business':
        return this.handleBusinessLogicError(error as BusinessLogicError);
      default:
        return {
          title: 'Unexpected Error',
          message: 'An unexpected error occurred.',
          actionable: 'Please try again or contact support if the problem persists.',
          retryable: true
        };
    }
  }

  private sanitizeLogData(data?: Record<string, any>): Record<string, any> {
    if (!data) return {};

    const sanitized = { ...data };
    const sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'key'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sendToLoggingService(logEntry: any): void {
    // Implementation would depend on the logging service used
    // This could be Azure Application Insights, custom logging endpoint, etc.
    // For now, this is a placeholder
  }
}

export default ErrorHandler.getInstance();