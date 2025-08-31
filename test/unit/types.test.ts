import { 
  FeatureFlag, 
  FeatBitConfig, 
  CreateFeatureFlagRequest, 
  WorkItemLink,
  NetworkError,
  AuthenticationError,
  ValidationError,
  BusinessLogicError,
  PlatformError,
  ExtensionError,
  ValidationResult,
  UserFriendlyMessage
} from '../../src/types';

describe('TypeScript Interface Validation', () => {
  describe('FeatureFlag interface', () => {
    it('should accept valid FeatureFlag objects', () => {
      const featureFlag: FeatureFlag = {
        id: 'flag-123',
        name: 'test_feature',
        description: 'Test feature flag',
        enabled: true,
        projectId: 'project-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        linkedWorkItems: [1, 2, 3]
      };

      expect(featureFlag.id).toBe('flag-123');
      expect(featureFlag.name).toBe('test_feature');
      expect(featureFlag.enabled).toBe(true);
      expect(Array.isArray(featureFlag.linkedWorkItems)).toBe(true);
    });
  });

  describe('FeatBitConfig interface', () => {
    it('should accept valid FeatBitConfig objects', () => {
      const config: FeatBitConfig = {
        serverUrl: 'https://featbit.example.com',
        apiKey: 'fb_api_key_1234567890',
        projectId: 'project-123',
        environment: 'development'
      };

      expect(config.serverUrl).toBe('https://featbit.example.com');
      expect(config.apiKey).toBe('fb_api_key_1234567890');
      expect(config.projectId).toBe('project-123');
      expect(config.environment).toBe('development');
    });
  });

  describe('CreateFeatureFlagRequest interface', () => {
    it('should accept valid CreateFeatureFlagRequest objects', () => {
      const request: CreateFeatureFlagRequest = {
        name: 'new_feature',
        description: 'New feature description',
        enabled: false,
        projectId: 'project-123',
        workItemId: 456
      };

      expect(request.name).toBe('new_feature');
      expect(request.enabled).toBe(false);
      expect(request.workItemId).toBe(456);
    });
  });

  describe('WorkItemLink interface', () => {
    it('should accept valid WorkItemLink objects', () => {
      const link: WorkItemLink = {
        workItemId: 123,
        featureFlagId: 'flag-456',
        linkType: 'feature-flag',
        createdAt: new Date()
      };

      expect(link.workItemId).toBe(123);
      expect(link.featureFlagId).toBe('flag-456');
      expect(link.linkType).toBe('feature-flag');
      expect(link.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Error interfaces', () => {
    it('should accept valid NetworkError objects', () => {
      const error: NetworkError = {
        type: 'network',
        message: 'Connection failed',
        code: 'NETWORK_ERROR',
        timestamp: new Date(),
        statusCode: 500,
        timeout: true
      };

      expect(error.type).toBe('network');
      expect(error.statusCode).toBe(500);
      expect(error.timeout).toBe(true);
    });

    it('should accept valid AuthenticationError objects', () => {
      const error: AuthenticationError = {
        type: 'authentication',
        message: 'Invalid credentials',
        code: 'AUTH_ERROR',
        timestamp: new Date(),
        reason: 'invalid_credentials'
      };

      expect(error.type).toBe('authentication');
      expect(error.reason).toBe('invalid_credentials');
    });

    it('should accept valid ValidationError objects', () => {
      const error: ValidationError = {
        type: 'validation',
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        timestamp: new Date(),
        field: 'name',
        value: 'invalid',
        constraints: ['Must start with letter']
      };

      expect(error.type).toBe('validation');
      expect(error.field).toBe('name');
      expect(Array.isArray(error.constraints)).toBe(true);
    });

    it('should accept valid BusinessLogicError objects', () => {
      const error: BusinessLogicError = {
        type: 'business',
        message: 'Operation failed',
        code: 'BUSINESS_ERROR',
        timestamp: new Date(),
        operation: 'createFlag',
        context: { flagName: 'test' }
      };

      expect(error.type).toBe('business');
      expect(error.operation).toBe('createFlag');
      expect(error.context).toEqual({ flagName: 'test' });
    });

    it('should accept valid PlatformError objects', () => {
      const error: PlatformError = {
        type: 'platform',
        message: 'Platform error',
        code: 'PLATFORM_ERROR',
        timestamp: new Date(),
        source: 'azure_devops',
        details: 'SDK initialization failed'
      };

      expect(error.type).toBe('platform');
      expect(error.source).toBe('azure_devops');
      expect(error.details).toBe('SDK initialization failed');
    });

    it('should accept ExtensionError union type', () => {
      const errors: ExtensionError[] = [
        {
          type: 'network',
          message: 'Network error',
          code: 'NET_ERR',
          timestamp: new Date()
        },
        {
          type: 'authentication',
          message: 'Auth error',
          code: 'AUTH_ERR',
          timestamp: new Date(),
          reason: 'expired_token'
        },
        {
          type: 'validation',
          message: 'Validation error',
          code: 'VAL_ERR',
          timestamp: new Date(),
          field: 'test',
          value: 'invalid',
          constraints: ['required']
        }
      ];

      expect(errors).toHaveLength(3);
      expect(errors[0].type).toBe('network');
      expect(errors[1].type).toBe('authentication');
      expect(errors[2].type).toBe('validation');
    });
  });

  describe('Utility interfaces', () => {
    it('should accept valid ValidationResult objects', () => {
      const validResult: ValidationResult = {
        isValid: true,
        errors: []
      };

      const invalidResult: ValidationResult = {
        isValid: false,
        errors: [{
          type: 'validation',
          message: 'Error',
          code: 'ERR',
          timestamp: new Date(),
          field: 'test',
          value: 'invalid',
          constraints: ['required']
        }]
      };

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
    });

    it('should accept valid UserFriendlyMessage objects', () => {
      const message: UserFriendlyMessage = {
        title: 'Error Title',
        message: 'Error message',
        actionable: 'Please check your settings',
        severity: 'error'
      };

      expect(message.title).toBe('Error Title');
      expect(message.severity).toBe('error');
      expect(message.actionable).toBe('Please check your settings');
    });
  });
});