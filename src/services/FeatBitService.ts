import { 
  FeatureFlag, 
  FeatBitConfig, 
  CreateFeatureFlagRequest, 
  NetworkError, 
  AuthenticationError, 
  ValidationError,
  BusinessLogicError 
} from '../types';
import ErrorHandler from '../utils/ErrorHandler';
import RetryHandler from '../utils/RetryHandler';
import DebounceHandler from '../utils/DebounceHandler';
import { HttpClient } from '../utils/HttpClient';

/**
 * HTTP client configuration for FeatBit API requests
 */
interface HttpClientConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
}

/**
 * FeatBit API response wrapper
 */
interface FeatBitApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

interface FeatBitFeatureFlagResponseList {
  data: {
    items: FeatBitFeatureFlagResponse[];
  };
}

interface FeatBitCreateFeatureFlagResponse {
  data: FeatBitFeatureFlagResponse;
}

/**
 * FeatBit API feature flag response structure
 */
interface FeatBitFeatureFlagResponse {
  id: string;
  name: string;
  description: string;
  key: string;
  isEnabled: boolean;
  isArchived: boolean;
  variationType: string;
  variations: Array<{
    id: string;
    name: string;
    value: string;
  }>;
  updatedAt: string;
  serves: {
    enabledVariations: string[];
    disabledVariation: string;
  };
  tags: string[];
}

/**
 * FeatBit API create feature flag request structure
 */
interface FeatBitCreateRequest {
  envId: string;
  name: string;
  key: string;
  isEnabled: boolean;
  description: string;
  variationType: string;
  variations: Array<{
    id: string;
    name: string;
    value: string;
  }>;
  enabledVariationId: string;
  disabledVariationId: string;
  tags: string[];
}

/**
 * Service class for interacting with FeatBit API
 * Handles feature flag operations including creation, retrieval, and toggling
 */
export class FeatBitService {
  private config: FeatBitConfig | null = null;
  private httpConfig: HttpClientConfig = {
    timeout: 10000, // 10 seconds
    retries: 3,
    retryDelay: 1000 // 1 second
  };

  // Debounced toggle function to prevent rapid API calls
  private debouncedToggle = DebounceHandler.debounce(
    this.performToggle.bind(this),
    300, // 300ms debounce delay
    { leading: false, trailing: true }
  );

  /**
   * Set the FeatBit configuration for API calls
   */
  setConfiguration(config: FeatBitConfig): void {
    this.config = config;
  }

  /**
   * Validate connection to FeatBit API
   */
  async validateConnection(config: FeatBitConfig): Promise<boolean> {
    try {
      const response = await this.makeRequest<any>(`/api/v1/envs/${config.environmentId}/feature-flags?pageIndex=0&pageSize=1`, 'GET', null, config);
      return response.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new feature flag in FeatBit
   */
  async createFeatureFlag(request: CreateFeatureFlagRequest): Promise<FeatureFlag> {
    if (!this.config) {
      const error = this.createAuthenticationError('Configuration not set', 'INVALID_API_KEY');
      ErrorHandler.logError(error, 'FeatBitService.createFeatureFlag');
      throw error;
    }

    const featBitRequest: FeatBitCreateRequest = {
      envId: request.envId,
      name: request.name,
      key: request.key,
      isEnabled: request.isEnabled,
      description: request.description,
      variationType: request.variationType,
      variations: request.variations,
      enabledVariationId: request.enabledVariationId,
      disabledVariationId: request.disabledVariationId,
      tags: request.tags
    };

    try {
      const response = await RetryHandler.retryApiCall(
        () => this.makeRequest<FeatBitCreateFeatureFlagResponse>(
          `/api/v1/envs/${request.envId}/feature-flags`,
          'POST',
          featBitRequest
        ),
        { maxAttempts: 2 } // Fewer retries for create operations
      );

      if (!response.success || !response.data) {
        const error = this.createBusinessLogicError(
          response.error || 'Failed to create feature flag',
          'BUSINESS_ERROR'
        );
        ErrorHandler.logError(error, 'FeatBitService.createFeatureFlag');
        throw error;
      }

      const newFlag = this.mapFeatBitResponseToFeatureFlag(response.data.data, request.workItemId ? [request.workItemId] : []);
      
      return newFlag;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        const validationError = this.createValidationError(
          'Feature flag name already exists',
          'featureFlagName',
          request.name
        );
        ErrorHandler.logError(validationError, 'FeatBitService.createFeatureFlag');
        throw validationError;
      }
      
      ErrorHandler.logError(error as Error, 'FeatBitService.createFeatureFlag', {
        requestName: request.name,
        projectId: request.projectId
      });
      throw error;
    }
  }

  /**
   * Retrieve feature flags for a project
   */
  async getFeatureFlags(projectId: string): Promise<FeatureFlag[]> {
    if (!this.config) {
      const error = this.createAuthenticationError('Configuration not set', 'INVALID_API_KEY');
      ErrorHandler.logError(error, 'FeatBitService.getFeatureFlags');
      throw error;
    }

    try {
      console.log('Fetching both active and archived feature flags...');
      
      // Make two parallel API calls: one for active flags, one for archived flags
      const [activeResponse, archivedResponse] = await Promise.all([
        RetryHandler.retryApiCall(
          () => this.makeRequest<FeatBitFeatureFlagResponseList>(
            `/api/v1/envs/${this.config?.environmentId || 'default'}/feature-flags?IsArchived=false`,
            'GET'
          )
        ),
        RetryHandler.retryApiCall(
          () => this.makeRequest<FeatBitFeatureFlagResponseList>(
            `/api/v1/envs/${this.config?.environmentId || 'default'}/feature-flags?IsArchived=true`,
            'GET'
          )
        )
      ]);

      // Check if both requests succeeded
      if (!activeResponse.success || !activeResponse.data) {
        const error = this.createBusinessLogicError(
          activeResponse.error || 'Failed to retrieve active feature flags',
          'PROJECT_NOT_FOUND'
        );
        ErrorHandler.logError(error, 'FeatBitService.getFeatureFlags');
        throw error;
      }

      if (!archivedResponse.success || !archivedResponse.data) {
        console.warn('Failed to retrieve archived feature flags, continuing with active flags only');
        // Continue with just active flags if archived request fails
        const activeFlags = activeResponse.data.data.items.map(flag => this.mapFeatBitResponseToFeatureFlag(flag, []));
        console.log(`Retrieved ${activeFlags.length} active feature flags`);
        return activeFlags;
      }

      // Combine active and archived flags
      const activeFlags = activeResponse.data.data.items.map(flag => this.mapFeatBitResponseToFeatureFlag(flag, []));
      const archivedFlags = archivedResponse.data.data.items.map(flag => this.mapFeatBitResponseToFeatureFlag(flag, [], true));
      
      const allFlags = [...activeFlags, ...archivedFlags];
      
      console.log(`Retrieved ${activeFlags.length} active and ${archivedFlags.length} archived feature flags (total: ${allFlags.length})`);
      
      return allFlags;
    } catch (error) {
      ErrorHandler.logError(error as Error, 'FeatBitService.getFeatureFlags', { projectId });
      throw error;
    }
  }

  /**
   * Archive a feature flag (required before deletion)
   */
  async archiveFeatureFlag(flagKey: string): Promise<void> {
    if (!this.config) {
      const error = this.createAuthenticationError('Configuration not set. Please ensure setConfiguration() is called before archive operations.', 'INVALID_API_KEY');
      ErrorHandler.logError(error, 'FeatBitService.archiveFeatureFlag');
      throw error;
    }

    const config = this.config; // Store reference to avoid null check issues

    try {
      const response = await RetryHandler.retryApiCall(
        () => this.makeRequest<void>(
          `/api/v1/envs/${config.environmentId}/feature-flags/${flagKey}/archive`,
          'PUT'
        )
      );

      if (!response.success) {
        const error = this.createBusinessLogicError(
          response.error || 'Failed to archive feature flag',
          'BUSINESS_ERROR'
        );
        ErrorHandler.logError(error, 'FeatBitService.archiveFeatureFlag');
        throw error;
      }

      console.log(`Feature flag '${flagKey}' archived successfully`);
    } catch (error) {
      ErrorHandler.logError(error as Error, 'FeatBitService.archiveFeatureFlag', { flagKey });
      throw error;
    }
  }

  /**
   * Restore (unarchive) a feature flag
   */
  async restoreFeatureFlag(flagKey: string): Promise<void> {
    if (!this.config) {
      const error = this.createAuthenticationError('Configuration not set. Please ensure setConfiguration() is called before restore operations.', 'INVALID_API_KEY');
      ErrorHandler.logError(error, 'FeatBitService.restoreFeatureFlag');
      throw error;
    }

    const config = this.config; // Store reference to avoid null check issues

    try {
      const response = await RetryHandler.retryApiCall(
        () => this.makeRequest<void>(
          `/api/v1/envs/${config.environmentId}/feature-flags/${flagKey}/restore`,
          'PUT'
        )
      );

      if (!response.success) {
        const error = this.createBusinessLogicError(
          response.error || 'Failed to restore feature flag',
          'BUSINESS_ERROR'
        );
        ErrorHandler.logError(error, 'FeatBitService.restoreFeatureFlag');
        throw error;
      }

      console.log(`Feature flag '${flagKey}' restored successfully`);
    } catch (error) {
      ErrorHandler.logError(error as Error, 'FeatBitService.restoreFeatureFlag', { flagKey });
      throw error;
    }
  }

  /**
   * Delete a feature flag permanently (must be archived first)
   */
  async deleteFeatureFlag(flagKey: string, isAlreadyArchived: boolean = false): Promise<void> {
    if (!this.config) {
      const error = this.createAuthenticationError('Configuration not set. Please ensure setConfiguration() is called before delete operations.', 'INVALID_API_KEY');
      ErrorHandler.logError(error, 'FeatBitService.deleteFeatureFlag');
      throw error;
    }

    const config = this.config; // Store reference to avoid null check issues

    try {
      if (isAlreadyArchived) {
        console.log(`Deleting already archived feature flag '${flagKey}'...`);
      } else {
        console.log(`Starting archive-then-delete process for feature flag '${flagKey}'`);
        
        // Step 1: Archive the feature flag first (required by FeatBit API)
        console.log(`Archiving feature flag '${flagKey}'...`);
        await this.archiveFeatureFlag(flagKey);
      }
      
      // Step 2: Delete the (now) archived feature flag
      console.log(`Deleting archived feature flag '${flagKey}'...`);
      const response = await RetryHandler.retryApiCall(
        () => this.makeRequest<void>(
          `/api/v1/envs/${config.environmentId}/feature-flags/${flagKey}`,
          'DELETE'
        )
      );

      if (!response.success) {
        const error = this.createBusinessLogicError(
          response.error || 'Failed to delete feature flag',
          'BUSINESS_ERROR'
        );
        ErrorHandler.logError(error, 'FeatBitService.deleteFeatureFlag');
        throw error;
      }

      console.log(`Feature flag '${flagKey}' successfully deleted`);
    } catch (error) {
      ErrorHandler.logError(error as Error, 'FeatBitService.deleteFeatureFlag', { flagKey });
      throw error;
    }
  }

  /**
   * Toggle a feature flag on/off with debouncing
   */
  async toggleFeatureFlag(flagId: string, enabled: boolean): Promise<void> {
    if (!this.config) {
      const error = this.createAuthenticationError('Configuration not set', 'INVALID_API_KEY');
      ErrorHandler.logError(error, 'FeatBitService.toggleFeatureFlag');
      throw error;
    }

    // Use debounced toggle to prevent rapid API calls
    return this.debouncedToggle(flagId, enabled);
  }

  /**
   * Toggle a feature flag on/off without debouncing (for when debouncing is handled externally)
   */
  async toggleFeatureFlagImmediate(flagKey: string, enabled: boolean): Promise<void> {
    // Call performToggle directly without debouncing
    return this.performToggle(flagKey, enabled);
  }

  /**
   * Internal method to perform the actual toggle operation
   */
  private async performToggle(flagKey: string, enabled: boolean): Promise<void> {
    if (!this.config) {
      const error = this.createAuthenticationError('Configuration not set. Please ensure setConfiguration() is called before toggle operations.', 'INVALID_API_KEY');
      ErrorHandler.logError(error, 'FeatBitService.performToggle');
      throw error;
    }

    const config = this.config; // Store reference to avoid null check issues

    try {
      const response = await RetryHandler.retryApiCall(
        () => this.makeRequest<void>(
          `/api/v1/envs/${config.environmentId}/feature-flags/${flagKey}`,
          'PATCH',
          [
            {
              "value": enabled,
              "path": "isEnabled",
              "op": "replace"
            }
          ]
        )
      );

      if (!response.success) {
        const error = this.createBusinessLogicError(
          response.error || 'Failed to toggle feature flag',
          'BUSINESS_ERROR',
          { flagKey, enabled }
        );
        ErrorHandler.logError(error, 'FeatBitService.performToggle');
        throw error;
      }

    } catch (error) {
      ErrorHandler.logError(error as Error, 'FeatBitService.performToggle', {
        flagKey,
        enabled
      });
      throw error;
    }
  }

  /**
   * Make HTTP request to FeatBit API with error handling and retries
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
    body?: any,
    configOverride?: FeatBitConfig
  ): Promise<FeatBitApiResponse<T>> {
    const config = configOverride || this.config;
    if (!config) {
      throw this.createAuthenticationError('Configuration not set', 'INVALID_API_KEY');
    }

    const url = `${config.serverUrl.replace(/\/$/, '')}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `${config.apiKey}`
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.httpConfig.retries; attempt++) {
      try {
        // Use custom HTTP client to bypass Azure DevOps extension validation
        const response = await HttpClient.request({
          url,
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          timeout: this.httpConfig.timeout
        });

        if (!response) {
          throw this.createNetworkError('No response received');
        }

        if (response.status === 401 || response.status === 403) {
          throw this.createAuthenticationError(
            'Invalid API credentials or insufficient permissions',
            response.status === 401 ? 'INVALID_API_KEY' : 'INSUFFICIENT_PERMISSIONS'
          );
        }

        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw this.createValidationError(
            errorData.message || 'Invalid request data',
            'request',
            body
          );
        }

        if (response.status === 409) {
          const errorData = await response.json().catch(() => ({}));
          // Handle duplicate feature flag name
          if (errorData.message && errorData.message.includes('already exists')) {
            throw this.createValidationError(
              'Feature flag name already exists',
              'featureFlagName',
              body?.name || 'unknown'
            );
          }
          throw this.createBusinessLogicError(
            errorData.message || 'Conflict occurred',
            'DUPLICATE_FLAG_NAME'
          );
        }

        if (!response.ok) {
          throw this.createNetworkError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          );
        }

        const data = method === 'GET' || method === 'PATCH' || method === 'POST' 
          ? await response.json() 
          : undefined;

        return {
          success: true,
          data: data as T
        };

      } catch (error) {
        lastError = error as Error;

        // Don't retry authentication, validation, or business logic errors
        const errorObj = error as any;
        if (errorObj.type === 'authentication' || 
            errorObj.type === 'validation' || 
            errorObj.type === 'business') {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === this.httpConfig.retries) {
          break;
        }

        // Wait before retrying
        await this.delay((this.httpConfig.retryDelay as number) * (attempt + 1));
      }
    }

    // Handle timeout errors
    if (lastError?.name === 'AbortError') {
      throw this.createNetworkError('Request timeout', 504);
    }

    // Handle network errors
    if (lastError?.message.includes('fetch')) {
      throw this.createNetworkError('Network connection failed');
    }

    throw lastError || this.createNetworkError('Unknown network error');
  }

  /**
   * Map FeatBit API response to internal FeatureFlag model
   */
  private mapFeatBitResponseToFeatureFlag(
    response: FeatBitFeatureFlagResponse, 
    linkedWorkItems: number[] = [],
    isArchived: boolean = false
  ): FeatureFlag {
    return {
      id: response.id,
      name: response.name,
      description: response.description,
      key: response.key,
      isEnabled: response.isEnabled,
      isArchived: isArchived, // Default to false if not provided
      variationType: response.variationType,
      variations: response.variations,
      updatedAt: response.updatedAt,
      serves: response.serves,
      tags: response.tags,
      linkedWorkItems
    };
  }

  /**
   * Create a network error with proper typing
   */
  private createNetworkError(message: string, statusCode?: number): NetworkError {
    let code: NetworkError['code'] = 'NETWORK_ERROR';
    
    if (message.includes('timeout') || message.includes('AbortError')) {
      code = 'TIMEOUT';
    } else if (message.includes('connection') || message.includes('refused')) {
      code = 'CONNECTION_REFUSED';
    } else if (message.includes('DNS') || message.includes('resolve')) {
      code = 'DNS_ERROR';
    }

    return {
      name: 'NetworkError',
      type: 'network',
      message,
      code,
      timestamp: new Date(),
      statusCode
    };
  }

  /**
   * Create an authentication error with proper typing
   */
  private createAuthenticationError(
    message: string, 
    code: AuthenticationError['code']
  ): AuthenticationError {
    return {
      name: 'AuthenticationError',
      type: 'authentication',
      message,
      code,
      timestamp: new Date()
    };
  }

  /**
   * Create a validation error with proper typing
   */
  private createValidationError(
    message: string,
    field: string,
    value?: any
  ): ValidationError {
    return {
      name: 'ValidationError',
      type: 'validation',
      message,
      code: 'VALIDATION_ERROR',
      timestamp: new Date(),
      field,
      value
    };
  }

  /**
   * Create a business logic error with proper typing
   */
  private createBusinessLogicError(
    message: string,
    code: BusinessLogicError['code'],
    details?: Record<string, any>
  ): BusinessLogicError {
    return {
      name: 'BusinessLogicError',
      type: 'business',
      message,
      code,
      timestamp: new Date(),
      details
    };
  }



  /**
   * Utility method for delays in retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}