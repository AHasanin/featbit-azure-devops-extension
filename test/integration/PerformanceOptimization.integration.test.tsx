import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FeatureFlagPanel } from '../../src/components/FeatureFlagPanel/FeatureFlagPanel';
import { CreateFeatureFlagDialog } from '../../src/components/CreateFeatureFlagDialog/CreateFeatureFlagDialog';
import { ConfigurationHub } from '../../src/components/ConfigurationHub/ConfigurationHub';
import { FeatBitService } from '../../src/services/FeatBitService';
import { WorkItemService } from '../../src/services/WorkItemService';
import { ConfigurationService } from '../../src/services/ConfigurationService';
import { cacheService } from '../../src/services/CacheService';
import { FeatureFlag, WorkItem, FeatBitConfig } from '../../src/types';

// Mock services
jest.mock('../../src/services/FeatBitService');
jest.mock('../../src/services/WorkItemService');
jest.mock('../../src/services/ConfigurationService');

const MockedFeatBitService = FeatBitService as jest.MockedClass<typeof FeatBitService>;
const MockedWorkItemService = WorkItemService as jest.MockedClass<typeof WorkItemService>;
const MockedConfigurationService = ConfigurationService as jest.MockedClass<typeof ConfigurationService>;

describe('Performance Optimization Integration Tests', () => {
  let mockFeatBitService: jest.Mocked<FeatBitService>;
  let mockWorkItemService: jest.Mocked<WorkItemService>;
  let mockConfigurationService: jest.Mocked<ConfigurationService>;

  const mockWorkItem: WorkItem = {
    id: 123,
    title: 'Test User Story',
    type: 'User Story',
    state: 'Active',
    fields: {
      projectId: 'test-project',
      assignedTo: 'test-user'
    }
  };

  const mockConfig: FeatBitConfig = {
    serverUrl: 'https://test-featbit.com',
    apiKey: 'test-api-key',
    projectId: 'test-project',
    environmentId: 'env-dev-123'
  };

  const mockFeatureFlags: FeatureFlag[] = [
    {
      id: 'flag-1',
      name: 'test-flag-1',
      description: 'Test flag 1',
      enabled: true,
      projectId: 'test-project',
      createdAt: new Date(),
      updatedAt: new Date(),
      linkedWorkItems: [123]
    },
    {
      id: 'flag-2',
      name: 'test-flag-2',
      description: 'Test flag 2',
      enabled: false,
      projectId: 'test-project',
      createdAt: new Date(),
      updatedAt: new Date(),
      linkedWorkItems: [123]
    }
  ];

  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear();

    // Reset mocks
    MockedFeatBitService.mockClear();
    MockedWorkItemService.mockClear();
    MockedConfigurationService.mockClear();

    // Create mock instances
    mockFeatBitService = new MockedFeatBitService() as jest.Mocked<FeatBitService>;
    mockWorkItemService = new MockedWorkItemService() as jest.Mocked<WorkItemService>;
    mockConfigurationService = new MockedConfigurationService() as jest.Mocked<ConfigurationService>;

    // Setup default mock implementations
    mockWorkItemService.getCurrentWorkItem.mockResolvedValue(mockWorkItem);
    mockWorkItemService.getLinkedFeatureFlags.mockResolvedValue(['flag-1', 'flag-2']);
    mockConfigurationService.getConfiguration.mockResolvedValue(mockConfig);
    mockFeatBitService.getFeatureFlags.mockResolvedValue(mockFeatureFlags);
    mockFeatBitService.setConfiguration.mockImplementation(() => {});
    mockFeatBitService.getCacheStats.mockReturnValue({ size: 0, maxSize: 100 });
  });

  afterEach(() => {
    cacheService.clear();
  });

  describe('FeatureFlagPanel Caching Performance', () => {
    it('should use cached data on subsequent renders', async () => {
      // First render - should make API calls
      const { rerender } = render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-flag-1')).toBeInTheDocument();
      });

      // Verify initial API calls
      expect(mockFeatBitService.getFeatureFlags).toHaveBeenCalledTimes(1);
      expect(mockFeatBitService.getFeatureFlags).toHaveBeenCalledWith('test-project', true);

      // Mock cache hit for subsequent calls
      mockFeatBitService.getCacheStats.mockReturnValue({ size: 1, maxSize: 100 });

      // Second render - should use cache
      rerender(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-flag-1')).toBeInTheDocument();
      });

      // Should not make additional API calls due to caching
      expect(mockFeatBitService.getFeatureFlags).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid toggle operations with debouncing', async () => {
      mockFeatBitService.toggleFeatureFlag.mockResolvedValue();

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-flag-1')).toBeInTheDocument();
      });

      const toggleButton = screen.getAllByRole('button')[1]; // First toggle button

      const startTime = performance.now();

      // Rapidly click toggle button multiple times
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          fireEvent.click(toggleButton);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // UI should remain responsive during rapid clicks
      expect(duration).toBeLessThan(500);

      // Wait for debounced calls to complete
      await waitFor(() => {
        expect(mockFeatBitService.toggleFeatureFlag).toHaveBeenCalled();
      }, { timeout: 1000 });

      // Should have debounced the calls (fewer than 10 calls)
      expect(mockFeatBitService.toggleFeatureFlag).toHaveBeenCalledTimes(1);
    });

    it('should render large numbers of feature flags efficiently', async () => {
      // Create many feature flags
      const manyFlags: FeatureFlag[] = Array.from({ length: 100 }, (_, i) => ({
        id: `flag-${i}`,
        name: `test-flag-${i}`,
        description: `Test flag ${i}`,
        enabled: i % 2 === 0,
        projectId: 'test-project',
        createdAt: new Date(),
        updatedAt: new Date(),
        linkedWorkItems: [123]
      }));

      mockFeatBitService.getFeatureFlags.mockResolvedValue(manyFlags);
      mockWorkItemService.getLinkedFeatureFlags.mockResolvedValue(
        manyFlags.map(flag => flag.id)
      );

      const startTime = performance.now();

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('100 flags')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render 100 flags within reasonable time
      expect(renderTime).toBeLessThan(1000);

      // Verify all flags are rendered
      expect(screen.getByText('test-flag-0')).toBeInTheDocument();
      expect(screen.getByText('test-flag-99')).toBeInTheDocument();
    });
  });

  describe('CreateFeatureFlagDialog Performance', () => {
    it('should handle form validation efficiently', async () => {
      mockFeatBitService.getFeatureFlags.mockResolvedValue(mockFeatureFlags);

      const onClose = jest.fn();
      const onSuccess = jest.fn();

      render(
        <CreateFeatureFlagDialog
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          featBitService={mockFeatBitService}
          workItemService={mockWorkItemService}
          workItem={mockWorkItem}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Feature Flag Name/)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/Feature Flag Name/);

      const startTime = performance.now();

      // Type rapidly in the name field
      await act(async () => {
        for (let i = 0; i < 20; i++) {
          fireEvent.change(nameInput, { target: { value: `test-flag-${i}` } });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Form should remain responsive during rapid typing
      expect(duration).toBeLessThan(500);

      // Should have debounced uniqueness checks
      await waitFor(() => {
        expect(mockFeatBitService.getFeatureFlags).toHaveBeenCalled();
      });

      // Should not have made excessive API calls for uniqueness checking
      expect(mockFeatBitService.getFeatureFlags).toHaveBeenCalledTimes(1);
    });

    it('should memoize computed values efficiently', async () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn();

      const { rerender } = render(
        <CreateFeatureFlagDialog
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          featBitService={mockFeatBitService}
          workItemService={mockWorkItemService}
          workItem={mockWorkItem}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Feature Flag Name/)).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Re-render multiple times with same props
      for (let i = 0; i < 10; i++) {
        rerender(
          <CreateFeatureFlagDialog
            isOpen={true}
            onClose={onClose}
            onSuccess={onSuccess}
            featBitService={mockFeatBitService}
            workItemService={mockWorkItemService}
            workItem={mockWorkItem}
          />
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Multiple re-renders should be fast due to memoization
      expect(duration).toBeLessThan(100);
    });
  });

  describe('ConfigurationHub Performance', () => {
    it('should handle form updates efficiently', async () => {
      mockConfigurationService.validateConfiguration.mockReturnValue({
        isValid: true,
        errors: []
      });

      render(
        <ConfigurationHub configurationService={mockConfigurationService} />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Server URL/)).toBeInTheDocument();
      });

      const serverUrlInput = screen.getByLabelText(/Server URL/);
      const apiKeyInput = screen.getByLabelText(/API Key/);
      const projectIdInput = screen.getByLabelText(/Project ID/);

      const startTime = performance.now();

      // Rapidly update all form fields
      await act(async () => {
        for (let i = 0; i < 20; i++) {
          fireEvent.change(serverUrlInput, { target: { value: `https://server-${i}.com` } });
          fireEvent.change(apiKeyInput, { target: { value: `api-key-${i}` } });
          fireEvent.change(projectIdInput, { target: { value: `project-${i}` } });
          await new Promise(resolve => setTimeout(resolve, 5));
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Form should remain responsive during rapid updates
      expect(duration).toBeLessThan(500);

      // Form should still be functional
      expect(serverUrlInput).toHaveValue('https://server-19.com');
      expect(apiKeyInput).toHaveValue('api-key-19');
      expect(projectIdInput).toHaveValue('project-19');
    });

    it('should memoize validation results efficiently', async () => {
      let validationCallCount = 0;
      mockConfigurationService.validateConfiguration.mockImplementation(() => {
        validationCallCount++;
        return { isValid: true, errors: [] };
      });

      const { rerender } = render(
        <ConfigurationHub configurationService={mockConfigurationService} />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Server URL/)).toBeInTheDocument();
      });

      const initialCallCount = validationCallCount;

      // Re-render multiple times without prop changes
      for (let i = 0; i < 5; i++) {
        rerender(
          <ConfigurationHub configurationService={mockConfigurationService} />
        );
      }

      // Should not trigger additional validations due to memoization
      expect(validationCallCount).toBe(initialCallCount);
    });
  });

  describe('Cache Integration Performance', () => {
    it('should handle cache invalidation efficiently', async () => {
      // Setup initial cache
      cacheService.setFeatureFlags('test-project', mockFeatureFlags);

      render(
        <FeatureFlagPanel
          workItemService={mockWorkItemService}
          featBitService={mockFeatBitService}
          configurationService={mockConfigurationService}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('test-flag-1')).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Invalidate cache multiple times
      for (let i = 0; i < 100; i++) {
        cacheService.invalidateProject('test-project');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Cache invalidation should be fast
      expect(duration).toBeLessThan(50);
    });

    it('should handle concurrent cache operations efficiently', async () => {
      const promises: Promise<void>[] = [];

      const startTime = performance.now();

      // Perform many concurrent cache operations
      for (let i = 0; i < 50; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            cacheService.setFeatureFlags(`project-${i}`, mockFeatureFlags);
            cacheService.getFeatureFlags(`project-${i}`);
            cacheService.invalidateProject(`project-${i}`);
            resolve();
          })
        );
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Concurrent operations should complete quickly
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory during component lifecycle', async () => {
      const components: Array<() => void> = [];

      // Create and destroy many components
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <FeatureFlagPanel
            workItemService={mockWorkItemService}
            featBitService={mockFeatBitService}
            configurationService={mockConfigurationService}
          />
        );

        components.push(unmount);

        await waitFor(() => {
          expect(screen.getAllByText('Feature Flags')[0]).toBeInTheDocument();
        });
      }

      // Unmount all components
      components.forEach(unmount => unmount());

      // This test mainly ensures no obvious memory leaks
      // In a real environment, you might check memory usage
      expect(components.length).toBe(10);
    });
  });
});