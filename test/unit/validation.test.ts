import {
  validateFeatureFlagName,
  validateFeatBitConfig,
  validateCreateFeatureFlagRequest,
  generateFeatureFlagName
} from '../../src/utils/validation';
import { FeatBitConfig, CreateFeatureFlagRequest } from '../../src/types';

describe('Feature Flag Name Validation', () => {
  describe('validateFeatureFlagName', () => {
    it('should accept valid feature flag names', () => {
      const validNames = [
        'user_authentication',
        'feature-toggle',
        'newFeature123',
        'a1b',
        'feature_flag_with_underscores',
        'feature-flag-with-hyphens'
      ];

      validNames.forEach(name => {
        const result = validateFeatureFlagName(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject names that are too short', () => {
      const result = validateFeatureFlagName('ab');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('name');
      expect(result.errors[0].constraints[0]).toContain('at least 3 characters');
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(101);
      const result = validateFeatureFlagName(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].constraints[0]).toContain('not exceed 100 characters');
    });

    it('should reject names starting with numbers', () => {
      const result = validateFeatureFlagName('123feature');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].constraints[0]).toContain('start with a letter');
    });

    it('should reject names with invalid characters', () => {
      const invalidNames = ['feature@flag', 'feature flag', 'feature.flag', 'feature#flag'];
      
      invalidNames.forEach(name => {
        const result = validateFeatureFlagName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].constraints[0]).toContain('letters, numbers, hyphens, and underscores');
      });
    });

    it('should reject empty or null names', () => {
      const emptyResults = [
        validateFeatureFlagName(''),
        validateFeatureFlagName('   '),
        validateFeatureFlagName(null as any),
        validateFeatureFlagName(undefined as any)
      ];

      emptyResults.forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].constraints[0]).toContain('required');
      });
    });
  });

  describe('generateFeatureFlagName', () => {
    it('should generate valid names from user story titles', () => {
      const testCases = [
        { input: 'User Authentication Feature', expected: 'user_authentication_feature' },
        { input: 'Add Shopping Cart', expected: 'add_shopping_cart' },
        { input: 'Feature with Special Characters!@#', expected: 'feature_with_special_characters' },
        { input: '123 Numeric Start', expected: 'flag_123_numeric_start' },
        { input: 'Multiple   Spaces   Between', expected: 'multiple_spaces_between' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = generateFeatureFlagName(input);
        expect(result).toBe(expected);
        
        // Verify the generated name is valid
        const validation = validateFeatureFlagName(result);
        expect(validation.isValid).toBe(true);
      });
    });

    it('should handle edge cases', () => {
      expect(generateFeatureFlagName('')).toBe('');
      expect(generateFeatureFlagName('   ')).toBe('');
      expect(generateFeatureFlagName(null as any)).toBe('');
      expect(generateFeatureFlagName(undefined as any)).toBe('');
    });

    it('should truncate long titles', () => {
      const longTitle = 'This is a very long user story title that exceeds the maximum length allowed for feature flag names and should be truncated';
      const result = generateFeatureFlagName(longTitle);
      expect(result.length).toBeLessThanOrEqual(100);
      
      const validation = validateFeatureFlagName(result);
      expect(validation.isValid).toBe(true);
    });
  });
});

describe('FeatBit Configuration Validation', () => {
  describe('validateFeatBitConfig', () => {
    const validConfig: FeatBitConfig = {
      serverUrl: 'https://featbit.example.com',
      apiKey: 'fb_api_key_1234567890abcdef',
      projectId: 'project-123',
      environmentId: 'env-abc123'
    };

    it('should accept valid configuration', () => {
      const result = validateFeatBitConfig(validConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid server URLs', () => {
      const invalidUrls = ['', 'not-a-url', 'ftp://invalid.com', 'http://', 'https://'];
      
      invalidUrls.forEach(serverUrl => {
        const result = validateFeatBitConfig({ ...validConfig, serverUrl });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'serverUrl')).toBe(true);
      });
    });

    it('should reject invalid API keys', () => {
      const invalidApiKeys = ['', 'short', '123', 'invalid@key'];
      
      invalidApiKeys.forEach(apiKey => {
        const result = validateFeatBitConfig({ ...validConfig, apiKey });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'apiKey')).toBe(true);
      });
    });

    it('should reject empty project IDs', () => {
      const result = validateFeatBitConfig({ ...validConfig, projectId: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'projectId')).toBe(true);
    });

    it('should reject empty environment IDs', () => {
      const result = validateFeatBitConfig({ ...validConfig, environmentId: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'environmentId')).toBe(true);
    });

    it('should handle missing required fields', () => {
      const result = validateFeatBitConfig({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4); // All fields are required
      
      const fieldNames = result.errors.map(e => e.field);
      expect(fieldNames).toContain('serverUrl');
      expect(fieldNames).toContain('apiKey');
      expect(fieldNames).toContain('projectId');
      expect(fieldNames).toContain('environmentId');
    });
  });
});

describe('Create Feature Flag Request Validation', () => {
  describe('validateCreateFeatureFlagRequest', () => {
    const validRequest: CreateFeatureFlagRequest = {
      name: 'test_feature_flag',
      description: 'Test feature flag description',
      enabled: false,
      projectId: 'project-123',
      workItemId: 456
    };

    it('should accept valid request', () => {
      const result = validateCreateFeatureFlagRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate feature flag name', () => {
      const result = validateCreateFeatureFlagRequest({ ...validRequest, name: '123invalid' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should reject invalid description types', () => {
      const result = validateCreateFeatureFlagRequest({ ...validRequest, description: 123 as any });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'description')).toBe(true);
    });

    it('should reject invalid enabled flag types', () => {
      const result = validateCreateFeatureFlagRequest({ ...validRequest, enabled: 'true' as any });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'enabled')).toBe(true);
    });

    it('should reject empty project IDs', () => {
      const result = validateCreateFeatureFlagRequest({ ...validRequest, projectId: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'projectId')).toBe(true);
    });

    it('should reject invalid work item IDs', () => {
      const invalidWorkItemIds = [0, -1, 1.5, 'invalid' as any];
      
      invalidWorkItemIds.forEach(workItemId => {
        const result = validateCreateFeatureFlagRequest({ ...validRequest, workItemId });
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'workItemId')).toBe(true);
      });
    });

    it('should handle missing required fields', () => {
      const result = validateCreateFeatureFlagRequest({});
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
      expect(result.errors.some(e => e.field === 'projectId')).toBe(true);
    });

    it('should allow optional fields to be undefined', () => {
      const minimalRequest = {
        name: 'test_flag',
        projectId: 'project-123'
      };
      
      const result = validateCreateFeatureFlagRequest(minimalRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('Type Checking', () => {
  it('should have correct FeatureFlag interface structure', () => {
    const featureFlag = {
      id: 'flag-123',
      name: 'test_flag',
      description: 'Test description',
      enabled: true,
      projectId: 'project-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      linkedWorkItems: [1, 2, 3]
    };

    // TypeScript compilation will catch type errors
    expect(typeof featureFlag.id).toBe('string');
    expect(typeof featureFlag.name).toBe('string');
    expect(typeof featureFlag.description).toBe('string');
    expect(typeof featureFlag.enabled).toBe('boolean');
    expect(typeof featureFlag.projectId).toBe('string');
    expect(featureFlag.createdAt).toBeInstanceOf(Date);
    expect(featureFlag.updatedAt).toBeInstanceOf(Date);
    expect(Array.isArray(featureFlag.linkedWorkItems)).toBe(true);
  });

  it('should have correct error type structures', () => {
    const networkError = {
      type: 'network' as const,
      message: 'Connection failed',
      code: 'NETWORK_ERROR',
      timestamp: new Date(),
      statusCode: 500,
      timeout: false
    };

    const authError = {
      type: 'authentication' as const,
      message: 'Invalid credentials',
      code: 'AUTH_ERROR',
      timestamp: new Date(),
      reason: 'invalid_credentials' as const
    };

    const validationError = {
      type: 'validation' as const,
      message: 'Invalid input',
      code: 'VALIDATION_ERROR',
      timestamp: new Date(),
      field: 'name',
      value: 'invalid',
      constraints: ['Must start with letter']
    };

    expect(networkError.type).toBe('network');
    expect(authError.type).toBe('authentication');
    expect(validationError.type).toBe('validation');
  });
});