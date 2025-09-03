import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FeatureFlagPanel } from '../../src/components/FeatureFlagPanel/FeatureFlagPanel';
import { WorkItemService } from '../../src/services/WorkItemService';
import { FeatBitService } from '../../src/services/FeatBitService';
import { ConfigurationService } from '../../src/services/ConfigurationService';
import { FeatureFlag, WorkItem, FeatBitConfig } from '../../src/types';

// Mock services
const mockWorkItemService = {
  getCurrentWorkItem: jest.fn(),
  getLinkedFeatureFlags: jest.fn(),
  linkFeatureFlag: jest.fn(),
  unlinkFeatureFlag: jest.fn(),
  checkWorkItemPermissions: jest.fn()
} as Partial<WorkItemService> as jest.Mocked<WorkItemService>;

const mockFeatBitService = {
  setConfiguration: jest.fn(),
  validateConnection: jest.fn(),
  createFeatureFlag: jest.fn(),
  getFeatureFlags: jest.fn(),
  toggleFeatureFlag: jest.fn(),
  getCacheStats: jest.fn(),
  invalidateCache: jest.fn(),
  clearCache: jest.fn()
} as Partial<FeatBitService> as jest.Mocked<FeatBitService>;

const mockConfigurationService = {
  getConfiguration: jest.fn(),
  saveConfiguration: jest.fn(),
  validateConfiguration: jest.fn()
} as Partial<ConfigurationService> as jest.Mocked<ConfigurationService>;

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
    name: 'test-feature-1',
    description: 'Test feature flag 1',
    enabled: true,
    projectId: 'test-project',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    linkedWorkItems: [123]
  },
  {
    id: 'flag-2',
    name: 'test-feature-2',
    description: 'Test feature flag 2',
    enabled: false,
    projectId: 'test-project',
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
    linkedWorkItems: [123]
  }
];

describe('FeatureFlagPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockWorkItemService.getCurrentWorkItem.mockResolvedValue(mockWorkItem);
    mockConfigurationService.getConfiguration.mockResolvedValue(mockConfig);
    mockWorkItemService.getLinkedFeatureFlags.mockResolvedValue(['flag-1', 'flag-2']);
    mockFeatBitService.getFeatureFlags.mockResolvedValue(mockFeatureFlags);
    mockFeatBitService.getCacheStats.mockReturnValue({ size: 0, maxSize: 100 });
  });

  describe('Loading State', () => {
    it('should display loading spinner while loading feature flags', () => {
      // Make the service calls hang to test loading state
      mockWorkItemService.getCurrentWorkItem.mockImplementation(() => new Promise(() => {}));
      
      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      expect(screen.getByText('Loading feature flags...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Feature Flag Display', () => {
    it('should display feature flags with correct information', async () => {
      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
        expect(screen.getByText('test-feature-2')).toBeInTheDocument();
      });

      // Check flag details
      expect(screen.getByText('Test feature flag 1')).toBeInTheDocument();
      expect(screen.getByText('Test feature flag 2')).toBeInTheDocument();
      
      // Check flag states
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
      
      // Check flag count
      expect(screen.getByText('2 flags')).toBeInTheDocument();
    });

    it('should display single flag count correctly', async () => {
      mockWorkItemService.getLinkedFeatureFlags.mockResolvedValue(['flag-1']);
      mockFeatBitService.getFeatureFlags.mockResolvedValue([mockFeatureFlags[0]]);

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1 flag')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no feature flags are linked', async () => {
      mockWorkItemService.getLinkedFeatureFlags.mockResolvedValue([]);

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No feature flags found')).toBeInTheDocument();
        expect(screen.getByText('This work item doesn\'t have any associated feature flags yet.')).toBeInTheDocument();
      });
    });
  });

  describe('Toggle Functionality', () => {
    it('should toggle feature flag when toggle button is clicked', async () => {
      mockFeatBitService.toggleFeatureFlag.mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
      });

      // Find and click the toggle button for the first flag (enabled)
      const toggleButtons = screen.getAllByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButtons[0]);

      // Verify the service was called
      await waitFor(() => {
        expect(mockFeatBitService.toggleFeatureFlag).toHaveBeenCalledWith('flag-1', false);
      });
    });

    it('should show loading state during toggle operation', async () => {
      // Make toggle operation hang to test loading state
      mockFeatBitService.toggleFeatureFlag.mockImplementation(() => new Promise(() => {}));

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
      });

      // Click toggle button
      const toggleButtons = screen.getAllByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButtons[0]);

      // Check for loading spinner in toggle button
      await waitFor(() => {
        expect(screen.getByTestId('toggle-loading-spinner')).toBeInTheDocument();
      });
    });

    it('should handle toggle errors gracefully', async () => {
      const errorMessage = 'Network error occurred';
      mockFeatBitService.toggleFeatureFlag.mockRejectedValue(new Error(errorMessage));

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
      });

      // Click toggle button
      const toggleButtons = screen.getAllByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButtons[0]);

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText(`Failed to toggle feature flag: ${errorMessage}`)).toBeInTheDocument();
      });
    });

    it('should update UI optimistically after successful toggle', async () => {
      mockFeatBitService.toggleFeatureFlag.mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
        expect(screen.getByText('Enabled')).toBeInTheDocument();
      });

      // Click toggle button to disable
      const toggleButtons = screen.getAllByRole('button', { name: /disable feature flag/i });
      fireEvent.click(toggleButtons[0]);

      // Wait for toggle to complete and check UI update
      // There should now be 2 "Disabled" states since we toggled the enabled flag to disabled
      await waitFor(() => {
        expect(screen.getAllByText('Disabled')).toHaveLength(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when configuration is missing', async () => {
      mockConfigurationService.getConfiguration.mockResolvedValue(null);

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('FeatBit configuration not found. Please configure the extension first.')).toBeInTheDocument();
      });
    });

    it('should display error when work item loading fails', async () => {
      const errorMessage = 'Failed to load work item';
      mockWorkItemService.getCurrentWorkItem.mockRejectedValue(new Error(errorMessage));

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should display error when feature flags loading fails', async () => {
      const errorMessage = 'Failed to load feature flags';
      mockFeatBitService.getFeatureFlags.mockRejectedValue(new Error(errorMessage));

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should allow retrying after error', async () => {
      const errorMessage = 'Network error';
      mockFeatBitService.getFeatureFlags.mockRejectedValueOnce(new Error(errorMessage));
      mockFeatBitService.getFeatureFlags.mockResolvedValue(mockFeatureFlags);

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Wait for successful load
      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
      });
    });

    it('should allow dismissing error', async () => {
      const errorMessage = 'Network error';
      mockFeatBitService.getFeatureFlags.mockRejectedValue(new Error(errorMessage));

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Click dismiss button
      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);

      // Error should be cleared but empty state should show
      await waitFor(() => {
        expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh feature flags when refresh button is clicked', async () => {
      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
      });

      // Clear previous calls
      jest.clearAllMocks();
      mockWorkItemService.getCurrentWorkItem.mockResolvedValue(mockWorkItem);
      mockConfigurationService.getConfiguration.mockResolvedValue(mockConfig);
      mockWorkItemService.getLinkedFeatureFlags.mockResolvedValue(['flag-1', 'flag-2']);
      mockFeatBitService.getFeatureFlags.mockResolvedValue(mockFeatureFlags);

      // Click refresh button
      const refreshButton = screen.getByText('🔄 Refresh');
      fireEvent.click(refreshButton);

      // Verify services were called again
      await waitFor(() => {
        expect(mockWorkItemService.getCurrentWorkItem).toHaveBeenCalled();
        expect(mockFeatBitService.getFeatureFlags).toHaveBeenCalled();
      });
    });
  });

  describe('Service Integration', () => {
    it('should call services in correct order during initialization', async () => {
      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
      });

      expect(mockWorkItemService.getCurrentWorkItem).toHaveBeenCalled();
      expect(mockConfigurationService.getConfiguration).toHaveBeenCalled();
      expect(mockFeatBitService.setConfiguration).toHaveBeenCalledWith(mockConfig);
      expect(mockWorkItemService.getLinkedFeatureFlags).toHaveBeenCalledWith(123);
      expect(mockFeatBitService.getFeatureFlags).toHaveBeenCalledWith('test-project', true);
    });

    it('should filter feature flags to only show linked ones', async () => {
      const allFlags = [
        ...mockFeatureFlags,
        {
          id: 'flag-3',
          name: 'unlinked-flag',
          description: 'This flag is not linked',
          enabled: true,
          projectId: 'test-project',
          createdAt: new Date(),
          updatedAt: new Date(),
          linkedWorkItems: []
        }
      ];

      mockFeatBitService.getFeatureFlags.mockResolvedValue(allFlags);

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-feature-1')).toBeInTheDocument();
        expect(screen.getByText('test-feature-2')).toBeInTheDocument();
      });

      // Unlinked flag should not be displayed
      expect(screen.queryByText('unlinked-flag')).not.toBeInTheDocument();
      expect(screen.getByText('2 flags')).toBeInTheDocument();
    });
  });
});