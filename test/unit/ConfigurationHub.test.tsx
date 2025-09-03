import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigurationHub } from '../../src/components/ConfigurationHub/ConfigurationHub';
import { ConfigurationService } from '../../src/services/ConfigurationService';
import { FeatBitConfig } from '../../src/types';

// Mock the ConfigurationService
jest.mock('../../src/services/ConfigurationService');

const MockedConfigurationService = ConfigurationService as jest.MockedClass<typeof ConfigurationService>;

describe('ConfigurationHub', () => {
  let mockConfigService: jest.Mocked<ConfigurationService>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a mock instance
    mockConfigService = {
      getConfiguration: jest.fn(),
      saveConfiguration: jest.fn(),
      validateConfiguration: jest.fn(),
      testConnection: jest.fn(),
      clearConfiguration: jest.fn(),
      hasValidConfiguration: jest.fn()
    } as any;

    // Mock the constructor to return our mock instance
    MockedConfigurationService.mockImplementation(() => mockConfigService);
  });

  const mockValidConfig: FeatBitConfig = {
    serverUrl: 'https://featbit.example.com',
    apiKey: 'test-api-key-12345678901234567890',
    projectId: 'test-project-id',
    environmentId: 'env-prod-123'
  };

  describe('Component Rendering', () => {
    it('should render loading state initially', async () => {
      mockConfigService.getConfiguration.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    it('should render form with empty fields when no configuration exists', async () => {
      mockConfigService.getConfiguration.mockResolvedValue(null);
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('FeatBit Configuration')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/server url/i)).toHaveValue('');
      expect(screen.getByLabelText(/api key/i)).toHaveValue('');
      expect(screen.getByLabelText(/project id/i)).toHaveValue('');
      expect(screen.getByLabelText(/environment id/i)).toHaveValue('');
    });

    it('should render form with existing configuration', async () => {
      mockConfigService.getConfiguration.mockResolvedValue(mockValidConfig);
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('https://featbit.example.com')).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue('test-api-key-12345678901234567890')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test-project-id')).toBeInTheDocument();
      expect(screen.getByDisplayValue('env-prod-123')).toBeInTheDocument();
    });

    it('should show error when configuration loading fails', async () => {
      mockConfigService.getConfiguration.mockRejectedValue(new Error('Load failed'));
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load existing configuration')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      mockConfigService.getConfiguration.mockResolvedValue(null);
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: false,
        errors: [
          {
            type: 'validation',
            message: 'Server URL is required',
            code: 'VALIDATION_ERROR',
            timestamp: new Date(),
            field: 'serverUrl',
            value: '',
            constraints: ['Server URL is required']
          }
        ]
      });
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('FeatBit Configuration')).toBeInTheDocument();
      });
    });

    it('should show validation errors when test connection is clicked with invalid data', async () => {
      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Server URL is required')).toBeInTheDocument();
      });

      expect(mockConfigService.validateConfiguration).toHaveBeenCalled();
      expect(mockConfigService.testConnection).not.toHaveBeenCalled();
    });

    it('should show validation errors when save is clicked with invalid data', async () => {
      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Server URL is required')).toBeInTheDocument();
      });

      expect(mockConfigService.validateConfiguration).toHaveBeenCalled();
      expect(mockConfigService.saveConfiguration).not.toHaveBeenCalled();
    });

    it('should clear field errors when user starts typing', async () => {
      // First trigger validation error
      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Server URL is required')).toBeInTheDocument();
      });

      // Then start typing in the field
      const serverUrlInput = screen.getByLabelText(/server url/i);
      fireEvent.change(serverUrlInput, { target: { value: 'https://test.com' } });

      await waitFor(() => {
        expect(screen.queryByText('Server URL is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Interactions', () => {
    beforeEach(async () => {
      mockConfigService.getConfiguration.mockResolvedValue(null);
      mockConfigService.validateConfiguration.mockReturnValue({ isValid: true, errors: [] });
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('FeatBit Configuration')).toBeInTheDocument();
      });
    });

    it('should update form state when inputs change', () => {
      const serverUrlInput = screen.getByLabelText(/server url/i);
      const apiKeyInput = screen.getByLabelText(/api key/i);
      const projectIdInput = screen.getByLabelText(/project id/i);
      const environmentSelect = screen.getByLabelText(/environment/i);

      fireEvent.change(serverUrlInput, { target: { value: 'https://test.com' } });
      fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });
      fireEvent.change(projectIdInput, { target: { value: 'test-project' } });
      fireEvent.change(environmentSelect, { target: { value: 'development' } });

      expect(serverUrlInput).toHaveValue('https://test.com');
      expect(apiKeyInput).toHaveValue('test-key');
      expect(projectIdInput).toHaveValue('test-project');
      expect(environmentSelect).toHaveValue('development');
    });

    it('should clear test and save results when form changes', async () => {
      // First set up a test result
      mockConfigService.testConnection.mockResolvedValue(true);
      
      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
      });

      // Then change a form field
      const serverUrlInput = screen.getByLabelText(/server url/i);
      fireEvent.change(serverUrlInput, { target: { value: 'https://changed.com' } });

      // Test result should be cleared
      expect(screen.queryByText(/connection successful/i)).not.toBeInTheDocument();
    });
  });

  describe('Connection Testing', () => {
    beforeEach(async () => {
      mockConfigService.getConfiguration.mockResolvedValue(null);
      mockConfigService.validateConfiguration.mockReturnValue({ isValid: true, errors: [] });
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('FeatBit Configuration')).toBeInTheDocument();
      });
    });

    it('should show loading state during connection test', async () => {
      mockConfigService.testConnection.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Testing Connection...')).toBeInTheDocument();
      });

      expect(testButton).toBeDisabled();
      expect(screen.getByText('Save Configuration')).toBeDisabled();
    });

    it('should show success message when connection test succeeds', async () => {
      mockConfigService.testConnection.mockResolvedValue(true);
      
      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
      });

      expect(mockConfigService.testConnection).toHaveBeenCalledWith({
        serverUrl: '',
        apiKey: '',
        projectId: '',
        environmentId: ''
      });
    });

    it('should show error message when connection test fails', async () => {
      mockConfigService.testConnection.mockResolvedValue(false);
      
      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      });
    });

    it('should show error message when connection test throws exception', async () => {
      mockConfigService.testConnection.mockRejectedValue(new Error('Network error'));
      
      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/connection test failed: network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Configuration Saving', () => {
    beforeEach(async () => {
      mockConfigService.getConfiguration.mockResolvedValue(null);
      mockConfigService.validateConfiguration.mockReturnValue({ isValid: true, errors: [] });
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('FeatBit Configuration')).toBeInTheDocument();
      });
    });

    it('should show loading state during save', async () => {
      mockConfigService.saveConfiguration.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });

      expect(saveButton).toBeDisabled();
      expect(screen.getByText('Test Connection')).toBeDisabled();
    });

    it('should show success message when save succeeds', async () => {
      mockConfigService.saveConfiguration.mockResolvedValue();
      
      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/configuration saved successfully/i)).toBeInTheDocument();
      });

      expect(mockConfigService.saveConfiguration).toHaveBeenCalledWith({
        serverUrl: '',
        apiKey: '',
        projectId: '',
        environmentId: ''
      });
    });

    it('should show error message when save fails', async () => {
      mockConfigService.saveConfiguration.mockRejectedValue(new Error('Save failed'));
      
      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save configuration: save failed/i)).toBeInTheDocument();
      });
    });

    it('should trim whitespace from form values before saving', async () => {
      mockConfigService.saveConfiguration.mockResolvedValue();
      
      // Fill form with values that have whitespace
      fireEvent.change(screen.getByLabelText(/server url/i), { 
        target: { value: '  https://test.com  ' } 
      });
      fireEvent.change(screen.getByLabelText(/api key/i), { 
        target: { value: '  test-key  ' } 
      });
      fireEvent.change(screen.getByLabelText(/project id/i), { 
        target: { value: '  test-project  ' } 
      });
      fireEvent.change(screen.getByLabelText(/environment id/i), { 
        target: { value: '  test-env  ' } 
      });
      
      const saveButton = screen.getByText('Save Configuration');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockConfigService.saveConfiguration).toHaveBeenCalledWith({
          serverUrl: 'https://test.com',
          apiKey: 'test-key',
          projectId: 'test-project',
          environmentId: 'test-env'
        });
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      mockConfigService.getConfiguration.mockResolvedValue(null);
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('FeatBit Configuration')).toBeInTheDocument();
      });
    });

    it('should have proper form labels', () => {
      expect(screen.getByLabelText(/server url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/project id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/environment/i)).toBeInTheDocument();
    });

    it('should mark required fields', () => {
      const requiredElements = screen.getAllByText('*');
      expect(requiredElements).toHaveLength(4); // All fields are required
    });

    it('should have proper button roles', () => {
      expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    });

    it('should have help text for form fields', () => {
      expect(screen.getByText(/the url of your featbit server/i)).toBeInTheDocument();
      expect(screen.getByText(/your featbit api key with permissions/i)).toBeInTheDocument();
      expect(screen.getByText(/the id of the featbit project/i)).toBeInTheDocument();
      expect(screen.getByText(/the unique id of the featbit environment/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle multiple validation errors', async () => {
      mockConfigService.getConfiguration.mockResolvedValue(null);
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: false,
        errors: [
          {
            type: 'validation',
            message: 'Server URL is required',
            code: 'VALIDATION_ERROR',
            timestamp: new Date(),
            field: 'serverUrl',
            value: '',
            constraints: ['Server URL is required']
          },
          {
            type: 'validation',
            message: 'API key is required',
            code: 'VALIDATION_ERROR',
            timestamp: new Date(),
            field: 'apiKey',
            value: '',
            constraints: ['API key is required']
          }
        ]
      });
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('FeatBit Configuration')).toBeInTheDocument();
      });

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Server URL is required')).toBeInTheDocument();
        expect(screen.getByText('API key is required')).toBeInTheDocument();
      });
    });

    it('should handle multiple errors for the same field', async () => {
      mockConfigService.getConfiguration.mockResolvedValue(null);
      mockConfigService.validateConfiguration.mockReturnValue({
        isValid: false,
        errors: [
          {
            type: 'validation',
            message: 'Server URL is required',
            code: 'VALIDATION_ERROR',
            timestamp: new Date(),
            field: 'serverUrl',
            value: '',
            constraints: ['Server URL is required']
          },
          {
            type: 'validation',
            message: 'Server URL must be a valid HTTP or HTTPS URL',
            code: 'VALIDATION_ERROR',
            timestamp: new Date(),
            field: 'serverUrl',
            value: '',
            constraints: ['Server URL must be a valid HTTP or HTTPS URL']
          }
        ]
      });
      
      render(<ConfigurationHub configurationService={mockConfigService} />);
      
      await waitFor(() => {
        expect(screen.getByText('FeatBit Configuration')).toBeInTheDocument();
      });

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Server URL is required, Server URL must be a valid HTTP or HTTPS URL')).toBeInTheDocument();
      });
    });
  });
});