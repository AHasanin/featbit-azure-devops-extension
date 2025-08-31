import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeatureFlagPanel } from '../../src/components/FeatureFlagPanel/FeatureFlagPanel';
import { WorkItemService } from '../../src/services/WorkItemService';
import { FeatBitService } from '../../src/services/FeatBitService';
import { ConfigurationService } from '../../src/services/ConfigurationService';
import { 
  FeatureFlag, 
  WorkItem, 
  FeatBitConfig, 
  NetworkError, 
  AuthenticationError,
  BusinessLogicError 
} from '../../src/types';

/**
 * Integration tests for feature flag toggle functionality
 * Tests the complete workflow from UI interaction to API calls
 */
describe('Feature Flag Toggle Integration', () => {
  let workItemService: WorkItemService;
  let featBitService: FeatBitService;
  let configurationService: ConfigurationService;

  // Mock data
  const mockWorkItem: WorkItem = {
    id: 123,
    title: 'Test User Story',
    workItemType: 'User Story',
    state: 'Active',
    assignedTo: 'Test User',
    fields: {
      'System.Title': 'Test User Story',
      'System.WorkItemType': 'User Story',
      'System.State': 'Active'
    }
  };

  const mockConfig: FeatBitConfig = {
    serverUrl: 'https://test.featbit.com',
    apiKey: 'test-api-key',
    projectId: 'test-project',
    environment: 'test-env'
  };

  const mockFeatureFlags: FeatureFlag[] = [
    {
      id: 'flag-1',
      name: 'test-feature-enabled',
      description: 'Test feature flag that is enabled',
      enabled: true,
      projectId: 'test-project',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      linkedWorkItems: [123]
    },
    {
      id: 'flag-2',
      name: 'test-feature-disabled',
      description: 'Test feature flag that is disabled',
      enabled: false,
      projectId: 'test-project',
      createdAt: new Date('2023-01-02'),
      updatedAt: new Date('2023-01-02'),
      linkedWorkItems: [123]
    }
  ];

  beforeEach(() => {
    // Create fresh service instances for each test
    workItemService = new WorkItemService();
    featBitService = new FeatBitService();
    configurationService = new ConfigurationService();

    // Mock service methods
    jest.spyOn(workItemService, 'getCurrentWorkItem').mockResolvedValue(mockWorkItem);
    jest.spyOn(workItemService, 'getLinkedFeatureFlags').mockResolvedValue(['flag-1', 'flag-2']);
    jest.spyOn(configurationService, 'getConfiguration').mockResolvedValue(mockConfig);
    jest.spyOn(featBitService, 'getFeatureFlags').mockResolvedValue(mockFeatureFlags);
    jest.spyOn(featBitService, 'setConfiguration').mockImplementation(() => {});
    jest.spyOn(featBitService, 'getCacheStats').mockReturnValue({ size: 0, maxSize: 100 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful Toggle Operations', () => {
    it('should successfully toggle enabled flag to disabled', async () => {
      // Mock successful toggle operation
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag').mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // Verify initial state
      expect(screen.getByText('Enabled')).toBeInTheDocument();

      // Find and click the toggle button for enabled flag
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);

      // Verify loading state appears
      await waitFor(() => {
        expect(screen.getByTestId('toggle-loading-spinner')).toBeInTheDocument();
      });

      // Wait for debounced function to execute (300ms + some extra buffer)
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify API call was made with correct parameters
      expect(toggleSpy).toHaveBeenCalledWith('flag-1', false);

      // Wait for toggle to complete and verify UI update
      await waitFor(() => {
        expect(screen.getAllByText('Disabled')).toHaveLength(2);
      });
    });

    it('should successfully toggle disabled flag to enabled', async () => {
      // Mock successful toggle operation
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag').mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-disabled')).toBeInTheDocument();
      });

      // Verify initial state - should have one enabled and one disabled
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();

      // Find and click the toggle button for disabled flag (second button)
      const toggleButtons = screen.getAllByRole('button', { name: /enable feature flag/i });
      fireEvent.click(toggleButtons[0]); // Click the first "Enable" button

      // Verify loading state
      await waitFor(() => {
        expect(screen.getByTestId('toggle-loading-spinner')).toBeInTheDocument();
      });

      // Wait for debounced function to execute (300ms + some extra buffer)
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify API call was made with correct parameters
      expect(toggleSpy).toHaveBeenCalledWith('flag-2', true);

      // Wait for toggle to complete
      await waitFor(() => {
        expect(screen.getAllByText('Enabled')).toHaveLength(2);
      });
    });

    it('should handle multiple simultaneous toggle operations', async () => {
      // Mock successful toggle operations
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag').mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
        expect(screen.getByText('test-feature-disabled')).toBeInTheDocument();
      });

      // First, toggle the enabled flag to disabled
      const disableButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(disableButton);

      // Wait for first debounced function to execute
      await new Promise(resolve => setTimeout(resolve, 400));

      // Then toggle the disabled flag to enabled (now there should be 2 enable buttons)
      const enableButtons = screen.getAllByRole('button', { name: /enable feature flag/i });
      expect(enableButtons).toHaveLength(2);
      fireEvent.click(enableButtons[1]); // Click the second enable button (for flag-2)

      // Wait for second debounced function to execute
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify both API calls were made
      expect(toggleSpy).toHaveBeenCalledTimes(2);
      expect(toggleSpy).toHaveBeenCalledWith('flag-1', false);
      expect(toggleSpy).toHaveBeenCalledWith('flag-2', true);

      // Wait for both operations to complete - should have 1 enabled and 1 disabled
      await waitFor(() => {
        expect(screen.getAllByText('Enabled')).toHaveLength(1);
        expect(screen.getAllByText('Disabled')).toHaveLength(1);
      });
    });
  });

  describe('Toggle Error Scenarios', () => {
    it('should handle network errors during toggle operation', async () => {
      const networkError: NetworkError = {
        type: 'network',
        name: 'NetworkError',
        message: 'Connection timeout',
        code: 'TIMEOUT',
        timestamp: new Date(),
        statusCode: 408
      };

      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag')
        .mockRejectedValue(networkError);

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // Click toggle button
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);

      // Wait for debounced function to execute
      await new Promise(resolve => setTimeout(resolve, 400));

      // Wait for error to appear - match the actual error message format
      await waitFor(() => {
        expect(screen.getByText(/Failed to toggle feature flag.*Network error.*Connection timeout/)).toBeInTheDocument();
      });
    });

    it('should handle authentication errors during toggle operation', async () => {
      const authError: AuthenticationError = {
        type: 'authentication',
        name: 'AuthenticationError',
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
        timestamp: new Date()
      };

      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag')
        .mockRejectedValue(authError);

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // Click toggle button
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/Failed to toggle feature flag.*Authentication failed/)).toBeInTheDocument();
      });

      // Verify the component shows error state (flag states are not visible during error)
      expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument();

      // Verify API was called
      expect(toggleSpy).toHaveBeenCalledWith('flag-1', false);
    });

    it('should handle business logic errors during toggle operation', async () => {
      const businessError: BusinessLogicError = {
        type: 'business',
        name: 'BusinessLogicError',
        message: 'Feature flag is locked and cannot be toggled',
        code: 'BUSINESS_ERROR',
        timestamp: new Date(),
        details: { flagId: 'flag-1', locked: true }
      };

      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag')
        .mockRejectedValue(businessError);

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // Click toggle button
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/Failed to toggle feature flag.*Feature flag is locked/)).toBeInTheDocument();
      });

      // Verify the component shows error state (flag states are not visible during error)
      expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
      expect(screen.queryByText('Disabled')).not.toBeInTheDocument();

      // Verify API was called
      expect(toggleSpy).toHaveBeenCalledWith('flag-1', false);
    });

    it('should allow error recovery after failed toggle', async () => {
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag')
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // First toggle attempt (should fail)
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);

      // Wait for debounced function to execute
      await new Promise(resolve => setTimeout(resolve, 400));

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/Failed to toggle feature flag.*Temporary network error/)).toBeInTheDocument();
      });

      // Clear error by dismissing it
      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText(/Failed to toggle feature flag/)).not.toBeInTheDocument();
      });

      // Second toggle attempt (should succeed)
      const toggleButtonRetry = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButtonRetry);

      // Wait for debounced function to execute
      await new Promise(resolve => setTimeout(resolve, 400));

      // Wait for successful toggle - should now have 2 disabled flags
      await waitFor(() => {
        expect(screen.getAllByText('Disabled')).toHaveLength(2);
      });

      // Verify both API calls were made
      expect(toggleSpy).toHaveBeenCalledTimes(2);
      expect(toggleSpy).toHaveBeenNthCalledWith(1, 'flag-1', false);
      expect(toggleSpy).toHaveBeenNthCalledWith(2, 'flag-1', false);
    });
  });

  describe('Toggle UI Behavior', () => {
    it('should disable toggle button during operation', async () => {
      // Mock toggle operation with delay
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag')
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // Click toggle button
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);

      // Verify button is disabled during operation
      await waitFor(() => {
        expect(toggleButton).toBeDisabled();
      });

      // Wait for operation to complete
      await waitFor(() => {
        expect(toggleButton).not.toBeDisabled();
      }, { timeout: 3000 });
    });

    it('should show correct visual feedback during toggle states', async () => {
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag').mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // Verify initial visual state
      const enabledFlag = screen.getByText('test-feature-enabled').closest('.feature-flag-item');
      expect(enabledFlag?.querySelector('.flag-status.enabled')).toBeInTheDocument();
      expect(enabledFlag?.querySelector('.toggle-switch.on')).toBeInTheDocument();

      const disabledFlag = screen.getByText('test-feature-disabled').closest('.feature-flag-item');
      expect(disabledFlag?.querySelector('.flag-status.disabled')).toBeInTheDocument();
      expect(disabledFlag?.querySelector('.toggle-switch.off')).toBeInTheDocument();

      // Toggle the enabled flag
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);

      // Wait for toggle to complete and verify visual update
      await waitFor(() => {
        expect(enabledFlag?.querySelector('.flag-status.disabled')).toBeInTheDocument();
        expect(enabledFlag?.querySelector('.toggle-switch.off')).toBeInTheDocument();
      });
    });

    it('should maintain correct accessibility attributes during toggle', async () => {
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag').mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // Check initial accessibility attributes
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      expect(toggleButton).toHaveAttribute('title', 'Disable feature flag');

      // Toggle the flag
      fireEvent.click(toggleButton);

      // Wait for debounced function to execute
      await new Promise(resolve => setTimeout(resolve, 400));

      // Wait for toggle to complete and verify accessibility update
      await waitFor(() => {
        const updatedButtons = screen.getAllByRole('button', { name: /enable feature flag/i });
        expect(updatedButtons).toHaveLength(2);
        expect(updatedButtons[0]).toHaveAttribute('title', 'Enable feature flag');
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should not trigger unnecessary re-renders during toggle', async () => {
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag').mockResolvedValue();
      const renderSpy = jest.fn();

      const TestWrapper: React.FC = () => {
        renderSpy();
        return (
          <FeatureFlagPanel
            workItemService={workItemService}
            featBitService={featBitService}
            configurationService={configurationService}
          />
        );
      };

      render(<TestWrapper />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      const initialRenderCount = renderSpy.mock.calls.length;

      // Toggle flag
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);

      // Wait for debounced function to execute
      await new Promise(resolve => setTimeout(resolve, 400));

      // Wait for toggle to complete
      await waitFor(() => {
        expect(screen.getAllByText('Disabled')).toHaveLength(2);
      });

      // Verify minimal re-renders occurred (should be initial + loading state + success state)
      expect(renderSpy.mock.calls.length).toBeLessThanOrEqual(initialRenderCount + 3);
    });

    it('should handle rapid toggle clicks gracefully', async () => {
      let toggleCount = 0;
      const toggleSpy = jest.spyOn(featBitService, 'toggleFeatureFlag')
        .mockImplementation(() => {
          toggleCount++;
          return new Promise(resolve => setTimeout(resolve, 50));
        });

      render(
        <FeatureFlagPanel
          workItemService={workItemService}
          featBitService={featBitService}
          configurationService={configurationService}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('test-feature-enabled')).toBeInTheDocument();
      });

      // Rapidly click toggle button multiple times
      const toggleButton = screen.getByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);

      // Wait for operations to complete
      await waitFor(() => {
        expect(screen.queryByTestId('toggle-loading-spinner')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify only one API call was made (button should be disabled after first click)
      expect(toggleCount).toBe(1);
    });
  });
});