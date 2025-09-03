import { FeatBitConfig, ValidationResult, ValidationError } from '../types';
import * as SDK from "azure-devops-extension-sdk";
import { HttpClient } from '../utils/HttpClient';

/**
 * Service for managing FeatBit configuration and secure storage in Azure DevOps
 */
export class ConfigurationService {
  private static readonly CONFIG_KEY = 'featbit-config';
  private static readonly ENCRYPTION_KEY = 'featbit-encryption-key';
  private extensionDataService: any = null;
  private extensionDataManager: any = null;
  private encryptionKey: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Ensure the service is initialized before use
   */
  protected async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeDataService();
    return this.initializationPromise;
  }

  /**
   * Initialize the Azure DevOps Extension Data Service
   */
  private async initializeDataService(): Promise<void> {
    try {
      // Use Azure DevOps SDK to get the extension data service
      
      try {
        // Try the modern service ID first
        this.extensionDataService = await SDK.getService("ms.vss-features.extension-data-service");
        console.log('Successfully connected to Extension Data Service');
        
        // Get the extension data manager
        const extensionContext = SDK.getExtensionContext();
        const accessToken = await SDK.getAccessToken();
        this.extensionDataManager = await this.extensionDataService.getExtensionDataManager(extensionContext.id, accessToken);
        console.log('Successfully initialized Extension Data Manager');
      } catch (error) {
        console.warn('Modern extension data service not available, trying fallback...');
        
      }
      
    } catch (error) {
      console.error('Failed to initialize Extension Data Service:', error);
      throw new Error(`Failed to initialize Azure DevOps Extension Data Service: ${error}`);
    }
  }

  /**
   * Initialize or retrieve the encryption key for sensitive data
   */
  private async initializeEncryptionKey(): Promise<void> {
    try {
      console.log('[ConfigurationService] Starting encryption key initialization...');
      
      // Try to retrieve existing encryption key with special handling
      try {
        console.log('[ConfigurationService] Attempting to retrieve existing encryption key...');
        this.encryptionKey = await this.getValueWithFallback(ConfigurationService.ENCRYPTION_KEY);
        
        if (this.encryptionKey) {
          console.log('[ConfigurationService] Successfully retrieved existing encryption key');
          return;
        }
      } catch (retrieveError) {
        console.warn('[ConfigurationService] Failed to retrieve existing encryption key:', retrieveError);
      }

      // Generate new key if none exists or retrieval failed
      console.log('[ConfigurationService] Generating new encryption key...');
      this.encryptionKey = this.generateEncryptionKey();
      
      try {
        console.log('[ConfigurationService] Saving new encryption key...');
        await this.setValueWithFallback(ConfigurationService.ENCRYPTION_KEY, this.encryptionKey);
        console.log('[ConfigurationService] Successfully saved new encryption key');
      } catch (saveError) {
        console.warn('[ConfigurationService] Failed to save encryption key, using session-only key:', saveError);
        // Continue with session-only encryption key
      }
      
      console.log('[ConfigurationService] Encryption key initialization completed');
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw new Error(`Failed to initialize encryption key: ${error}`);
    }
  }

  /**
   * Generate a new encryption key
   */
  private generateEncryptionKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Reset encryption key (useful for debugging/recovery)
   * This is a public method that can be called to recover from encryption key issues
   */
  async resetEncryptionKey(): Promise<void> {
    console.log('[ConfigurationService] Resetting encryption key...');
    
    try {
      // Clear the in-memory encryption key
      this.encryptionKey = null;
      
      // Try to clear stored encryption key using fallback strategies
      try {
        await this.setValueWithFallback(ConfigurationService.ENCRYPTION_KEY, null);
        console.log('[ConfigurationService] Cleared stored encryption key');
      } catch (clearError) {
        console.warn('[ConfigurationService] Failed to clear stored encryption key:', clearError);
      }
      
      // Re-initialize encryption key
      await this.ensureEncryptionKey();
      
      console.log('[ConfigurationService] Encryption key reset completed');
    } catch (error) {
      console.error('[ConfigurationService] Failed to reset encryption key:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data using simple XOR encryption
   * Note: This is a basic implementation. In production, consider using Web Crypto API
   */
  private encrypt(data: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const result = [];
    for (let i = 0; i < data.length; i++) {
      const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
      const dataChar = data.charCodeAt(i);
      result.push(String.fromCharCode(dataChar ^ keyChar));
    }
    
    // Base64 encode the result
    return btoa(result.join(''));
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      // Base64 decode first - this will throw if the data is not valid base64
      const data = atob(encryptedData);
      const result = [];
      
      for (let i = 0; i < data.length; i++) {
        const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        const dataChar = data.charCodeAt(i);
        result.push(String.fromCharCode(dataChar ^ keyChar));
      }
      
      return result.join('');
    } catch (error) {
      throw new Error('Failed to decrypt data: Invalid format or key');
    }
  }

  /**
   * Generic getValue method using Azure DevOps Extension Data Manager
   */
  private async getValue(key: string): Promise<string | null> {
    await this.ensureInitialized();
    
    if (!this.extensionDataManager) {
      throw new Error('Extension Data Manager not initialized');
    }

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`getValue timeout for key: ${key}`)), 10000);
    });
    
    try {
      const result = await Promise.race([
        this.extensionDataManager.getValue(key, { scopeType: 'User' }),
        timeoutPromise
      ]);
      
      return result || null;
    } catch (error) {
      console.error(`getValue failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Enhanced getValue with multiple fallback strategies for encryption key
   */
  private async getValueWithFallback(key: string): Promise<string | null> {
    await this.ensureInitialized();
    
    if (!this.extensionDataManager) {
      throw new Error('Extension Data Manager not initialized');
    }

    // Multiple strategies for retrieving the encryption key
    const strategy = { scopeType: 'User', timeout: 8000, description: 'User scope' }


    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${strategy.timeout}ms`)), strategy.timeout);
      });

      const options = strategy.scopeType ? { scopeType: strategy.scopeType } : {};
      const result = await Promise.race([
        this.extensionDataManager.getValue(key, options),
        timeoutPromise
      ]);

      if (result) {
        return result;
      }
    } catch (error) {
      console.warn(`[ConfigurationService] Attempt failed for key "${key}":`, error);
      return null;
    }
    return null;
  }

  /**
   * Ensure encryption key is initialized (separate from data service initialization)
   */
  private async ensureEncryptionKey(): Promise<void> {
    if (this.encryptionKey) {
      return; // Already initialized
    }

    await this.initializeEncryptionKey();
  }

  /**
   * Generic setValue method using Azure DevOps Extension Data Manager
   */
  private async setValue(key: string, value: string | null): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.extensionDataManager) {
      throw new Error('Extension Data Manager not initialized');
    }

    await this.extensionDataManager.setValue(key, value, { scopeType: 'User' });
  }

  /**
   * Enhanced setValue with multiple fallback strategies for encryption key
   */
  private async setValueWithFallback(key: string, value: string | null): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.extensionDataManager) {
      throw new Error('Extension Data Manager not initialized');
    }

    // Multiple strategies for saving the encryption key
    const strategy = { scopeType: 'User', description: 'User scope' }

    console.log(`[ConfigurationService] setValue attempt ${1} for key "${key}" using ${strategy.description}`);

    try {
      const options = strategy.scopeType ? { scopeType: strategy.scopeType } : {};
      await this.extensionDataManager.setValue(key, value, options);
      console.log(`[ConfigurationService] setValue succeeded for key "${key}" on attempt ${1}`);
      return;
    } catch (error) {
      console.warn(`[ConfigurationService] setValue attempt ${1} failed for key "${key}":`, error);
      throw new Error(`Failed to set value for key "${key}" after all attempts: ${error}`);
    }
  }

  /**
   * Save FeatBit configuration settings
   */
  async saveConfiguration(config: FeatBitConfig): Promise<void> {
    // Validate configuration before saving
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.map((e: ValidationError) => e.message).join(', ')}`);
    }

    try {
      // Ensure data service is initialized
      await this.ensureInitialized();
      
      // Ensure encryption key is available
      await this.ensureEncryptionKey();

      // Create a copy of config with encrypted sensitive data
      const configToStore = {
        ...config,
        apiKey: this.encrypt(config.apiKey)
      };

      // Store configuration using Azure DevOps Extension Data Service
      await this.setValue(ConfigurationService.CONFIG_KEY, JSON.stringify(configToStore));

    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw new Error('Failed to save configuration settings');
    }
  }

  /**
   * Retrieve FeatBit configuration settings
   */
  async getConfiguration(): Promise<FeatBitConfig | null> {
    try {
      // Ensure data service is initialized
      await this.ensureInitialized();

      // Retrieve configuration from Azure DevOps Extension Data Service
      const storedConfig = await this.getValue(ConfigurationService.CONFIG_KEY);

      if (!storedConfig) {
        return null;
      }

      const config: FeatBitConfig = JSON.parse(storedConfig);
      
      // Ensure encryption key is available for decryption
      await this.ensureEncryptionKey();

      // Decrypt sensitive data
      const decryptedApiKey = this.decrypt(config.apiKey);
      
      // Validate that decryption produced a reasonable result
      if (!decryptedApiKey || decryptedApiKey.length < 10) {
        throw new Error('Decrypted API key appears to be invalid');
      }

      const updatedConfig: FeatBitConfig = {
        ...config,
        apiKey: decryptedApiKey
      };

      return updatedConfig;

    } catch (error) {
      console.error('Failed to retrieve configuration:', error);
      throw new Error('Failed to retrieve configuration settings');
    }
  }

  /**
   * Validate FeatBit configuration
   */
  validateConfiguration(config: FeatBitConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate server URL
    if (!config.serverUrl || typeof config.serverUrl !== 'string') {
      errors.push({
        name: 'ValidationError',
        type: 'validation',
        message: 'Server URL is required',
        code: 'VALIDATION_ERROR',
        timestamp: new Date(),
        field: 'serverUrl',
        value: config.serverUrl,
        constraints: ['Server URL is required']
      });
    }

    // Validate API key
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      errors.push({
        name: 'ValidationError',
        type: 'validation', 
        message: 'API key is required',
        code: 'VALIDATION_ERROR',
        timestamp: new Date(),
        field: 'apiKey',
        value: config.apiKey,
        constraints: ['API key is required']
      });
    }

    // Validate project ID
    if (!config.projectId || typeof config.projectId !== 'string') {
      errors.push({
        name: 'ValidationError',
        type: 'validation',
        message: 'Project ID is required', 
        code: 'VALIDATION_ERROR',
        timestamp: new Date(),
        field: 'projectId',
        value: config.projectId,
        constraints: ['Project ID is required']
      });
    }

    // Validate environment ID
    if (!config.environmentId || typeof config.environmentId !== 'string') {
      errors.push({
        name: 'ValidationError',
        type: 'validation',
        message: 'Environment ID is required',
        code: 'VALIDATION_ERROR',
        timestamp: new Date(),
        field: 'environmentId',
        value: config.environmentId,
        constraints: ['Environment ID is required']
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Clear stored configuration
   */
  async clearConfiguration(): Promise<void> {
    try {
      // Ensure data service is initialized
      await this.ensureInitialized();

      // Remove configuration from storage
      await this.setValue(ConfigurationService.CONFIG_KEY, null);

    } catch (error) {
      console.error('Failed to clear configuration:', error);
      throw new Error('Failed to clear configuration settings');
    }
  }

  /**
   * Check if configuration exists and is valid
   */
  async hasValidConfiguration(): Promise<boolean> {
    try {
      const config = await this.getConfiguration();
      if (!config) {
        return false;
      }

      const validation = this.validateConfiguration(config);
      return validation.isValid;

    } catch (error) {
      console.error('Failed to check configuration validity:', error);
      return false;
    }
  }

  /**
   * Test connection to FeatBit using the provided configuration
   * This method will be used by the UI to validate settings before saving
   */
  async testConnection(config: FeatBitConfig): Promise<boolean> {
    // Validate configuration first
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    try {
      // Make a simple API call to test connectivity using custom HTTP client to bypass Azure validation
      const url = `${config.serverUrl.replace(/\/$/, '')}/api/v1/envs/${config.environmentId}/feature-flags?pageIndex=0&pageSize=1`;
      
      console.log('Testing connection to:', url);

      const response = await HttpClient.request({
        url,
        method: 'GET',
        headers: {
          'Authorization': `${config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error('Response body:', responseText);
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      return response.ok;

    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}