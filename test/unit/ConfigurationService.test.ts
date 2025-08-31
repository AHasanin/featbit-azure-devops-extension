import { ConfigurationService } from '../../src/services/ConfigurationService';
import { FeatBitConfig } from '../../src/types';

// Create a testable version of ConfigurationService that bypasses initialization
class TestableConfigurationService extends ConfigurationService {
  private testEncryptionKey: string = 'test-encryption-key-12345678901234567890123456789012';

  constructor(mockDataService: any) {
    super();
    // Override the private properties using any casting
    (this as any).extensionDataService = mockDataService;
    (this as any).encryptionKey = this.testEncryptionKey;
    (this as any).initializationPromise = Promise.resolve();
  }

  // Override ensureInitialized to skip actual initialization
  protected async ensureInitialized(): Promise<void> {
    return Promise.resolve();
  }
}

// Mock the global VSS object and crypto
const mockExtensionDataService = {
  getValue: jest.fn(),
  setValue: jest.fn()
};

const mockVSS = {
  ready: jest.fn().mockResolvedValue(undefined),
  getService: jest.fn().mockResolvedValue(mockExtensionDataService),
  ServiceIds: {
    ExtensionDataService: 'ExtensionDataService'
  }
};

// Mock crypto.getRandomValues
const mockCrypto = {
  getRandomValues: jest.fn((array: Uint8Array) => {
    // Fill with predictable values for testing
    for (let i = 0; i < array.length; i++) {
      array[i] = i % 256;
    }
    return array;
  })
};

// Mock fetch for connection testing
const mockFetch = jest.fn();

// Setup global mocks
beforeAll(() => {
  (global as any).window = {
    VSS: mockVSS
  };
  Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true,
    configurable: true
  });
  (global as any).fetch = mockFetch;
  (global as any).btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  (global as any).atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
  (global as any).AbortSignal = {
    timeout: jest.fn().mockReturnValue({})
  };
});

describe('ConfigurationService', () => {
  let configService: TestableConfigurationService;
  let validConfig: FeatBitConfig;

  const setupMocks = () => {
    // Mock successful VSS initialization
    mockVSS.ready.mockResolvedValue(undefined);
    mockVSS.getService.mockResolvedValue(mockExtensionDataService);
    
    // Setup default mock responses - encryption key doesn't exist, will be generated
    mockExtensionDataService.getValue.mockImplementation((key: string) => {
      if (key === 'featbit-encryption-key') {
        return Promise.resolve(null); // No existing key, will generate new one
      }
      return Promise.resolve(null); // No config exists by default
    });
    mockExtensionDataService.setValue.mockResolvedValue(undefined);
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup valid test configuration
    validConfig = {
      serverUrl: 'https://featbit.example.com',
      apiKey: 'test-api-key-1234567890',
      projectId: 'test-project-id',
      environment: 'development'
    };

    setupMocks();
    configService = new TestableConfigurationService(mockExtensionDataService);
  });

  describe('initialization', () => {
    it('should work with testable service (bypasses real initialization)', async () => {
      // Since we're using TestableConfigurationService, initialization is bypassed
      // Just verify that the service can save configuration
      await configService.saveConfiguration(validConfig);

      expect(mockExtensionDataService.setValue).toHaveBeenCalledWith(
        'featbit-config',
        expect.objectContaining({
          serverUrl: validConfig.serverUrl,
          projectId: validConfig.projectId,
          environment: validConfig.environment,
          apiKey: expect.not.stringMatching(validConfig.apiKey) // Should be encrypted
        }),
        { scopeType: 'User' }
      );
    });

    it('should use predefined encryption key in test', async () => {
      // The TestableConfigurationService uses a predefined encryption key
      // Just verify that encryption/decryption works
      await configService.saveConfiguration(validConfig);
      
      // Get the saved encrypted config
      const savedCall = mockExtensionDataService.setValue.mock.calls.find(
        call => call[0] === 'featbit-config'
      );
      const encryptedConfig = savedCall[1];

      // Mock retrieval and verify decryption works
      mockExtensionDataService.getValue.mockResolvedValue(encryptedConfig);
      const retrievedConfig = await configService.getConfiguration();

      expect(retrievedConfig?.apiKey).toBe(validConfig.apiKey);
    });

    it('should handle service operations correctly', async () => {
      // Test that the service can perform basic operations
      await configService.saveConfiguration(validConfig);
      await configService.clearConfiguration();
      
      expect(mockExtensionDataService.setValue).toHaveBeenCalledTimes(2);
    });
  });

  describe('saveConfiguration', () => {
    it('should save valid configuration with encrypted API key', async () => {
      await configService.saveConfiguration(validConfig);

      expect(mockExtensionDataService.setValue).toHaveBeenCalledWith(
        'featbit-config',
        expect.objectContaining({
          serverUrl: validConfig.serverUrl,
          projectId: validConfig.projectId,
          environment: validConfig.environment,
          apiKey: expect.not.stringMatching(validConfig.apiKey) // Should be encrypted
        }),
        { scopeType: 'User' }
      );
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        ...validConfig,
        serverUrl: 'invalid-url'
      };

      await expect(configService.saveConfiguration(invalidConfig))
        .rejects.toThrow('Invalid configuration');
    });

    it('should handle data service errors', async () => {
      mockExtensionDataService.setValue.mockRejectedValue(new Error('Storage error'));

      await expect(configService.saveConfiguration(validConfig))
        .rejects.toThrow('Failed to save configuration settings');
    });
  });

  describe('getConfiguration', () => {
    it('should return null when no configuration exists', async () => {
      mockExtensionDataService.getValue.mockResolvedValue(null);

      const result = await configService.getConfiguration();

      expect(result).toBeNull();
    });

    it('should retrieve and decrypt configuration', async () => {
      // First save a configuration to get encrypted data
      await configService.saveConfiguration(validConfig);
      
      // Get the encrypted config that was saved
      const savedCall = mockExtensionDataService.setValue.mock.calls.find(
        call => call[0] === 'featbit-config'
      );
      const encryptedConfig = savedCall[1];

      // Mock retrieval of encrypted config
      mockExtensionDataService.getValue.mockResolvedValue(encryptedConfig);

      const result = await configService.getConfiguration();

      expect(result).toEqual(validConfig);
    });

    it('should handle decryption errors', async () => {
      // Use corrupted config that will result in invalid decrypted API key
      const corruptedConfig = {
        ...validConfig,
        apiKey: 'YWJj' // This decodes to "abc" which is too short
      };
      mockExtensionDataService.getValue.mockResolvedValue(corruptedConfig);

      await expect(configService.getConfiguration())
        .rejects.toThrow('Failed to retrieve configuration settings');
    });

    it('should handle data service errors', async () => {
      mockExtensionDataService.getValue.mockRejectedValue(new Error('Storage error'));

      await expect(configService.getConfiguration())
        .rejects.toThrow('Failed to retrieve configuration settings');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const result = configService.validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with invalid server URL', () => {
      const invalidConfig = {
        ...validConfig,
        serverUrl: 'not-a-url'
      };

      const result = configService.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('serverUrl');
    });

    it('should reject configuration with missing API key', () => {
      const invalidConfig = {
        ...validConfig,
        apiKey: ''
      };

      const result = configService.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'apiKey')).toBe(true);
    });

    it('should reject configuration with missing project ID', () => {
      const invalidConfig = {
        ...validConfig,
        projectId: ''
      };

      const result = configService.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'projectId')).toBe(true);
    });

    it('should reject configuration with missing environment', () => {
      const invalidConfig = {
        ...validConfig,
        environment: ''
      };

      const result = configService.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'environment')).toBe(true);
    });
  });

  describe('clearConfiguration', () => {
    it('should clear stored configuration', async () => {
      await configService.clearConfiguration();

      expect(mockExtensionDataService.setValue).toHaveBeenCalledWith(
        'featbit-config',
        null,
        { scopeType: 'User' }
      );
    });

    it('should handle data service errors', async () => {
      mockExtensionDataService.setValue.mockRejectedValue(new Error('Storage error'));

      await expect(configService.clearConfiguration())
        .rejects.toThrow('Failed to clear configuration settings');
    });
  });

  describe('hasValidConfiguration', () => {
    it('should return true for valid stored configuration', async () => {
      // Mock valid configuration retrieval
      await configService.saveConfiguration(validConfig);
      const savedCall = mockExtensionDataService.setValue.mock.calls.find(
        call => call[0] === 'featbit-config'
      );
      mockExtensionDataService.getValue.mockResolvedValue(savedCall[1]);

      const result = await configService.hasValidConfiguration();

      expect(result).toBe(true);
    });

    it('should return false when no configuration exists', async () => {
      mockExtensionDataService.getValue.mockResolvedValue(null);

      const result = await configService.hasValidConfiguration();

      expect(result).toBe(false);
    });

    it('should return false for invalid configuration', async () => {
      const invalidConfig = {
        ...validConfig,
        serverUrl: 'invalid-url',
        apiKey: 'encrypted-invalid-key'
      };
      mockExtensionDataService.getValue.mockResolvedValue(invalidConfig);

      const result = await configService.hasValidConfiguration();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockExtensionDataService.getValue.mockRejectedValue(new Error('Storage error'));

      const result = await configService.hasValidConfiguration();

      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await configService.testConnection(validConfig);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${validConfig.serverUrl}/api/v1/projects/${validConfig.projectId}`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': `${validConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should return false for failed connection', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      });

      const result = await configService.testConnection(validConfig);

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await configService.testConnection(validConfig);

      expect(result).toBe(false);
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        ...validConfig,
        serverUrl: 'invalid-url'
      };

      await expect(configService.testConnection(invalidConfig))
        .rejects.toThrow('Invalid configuration');
    });

    it('should handle server URL with trailing slash', async () => {
      const configWithTrailingSlash = {
        ...validConfig,
        serverUrl: 'https://featbit.example.com/'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      await configService.testConnection(configWithTrailingSlash);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://featbit.example.com/api/v1/projects/${validConfig.projectId}`,
        expect.any(Object)
      );
    });
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const testData = 'sensitive-api-key-12345';
      
      // Save configuration to trigger encryption
      const testConfig = { ...validConfig, apiKey: testData };
      await configService.saveConfiguration(testConfig);

      // Get the encrypted version
      const savedCall = mockExtensionDataService.setValue.mock.calls.find(
        call => call[0] === 'featbit-config'
      );
      const encryptedConfig = savedCall[1];

      // Verify API key is encrypted (different from original)
      expect(encryptedConfig.apiKey).not.toBe(testData);

      // Mock retrieval and verify decryption
      mockExtensionDataService.getValue.mockResolvedValue(encryptedConfig);
      const retrievedConfig = await configService.getConfiguration();

      expect(retrievedConfig?.apiKey).toBe(testData);
    });
  });
});