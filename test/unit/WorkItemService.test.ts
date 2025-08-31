import { WorkItemService } from '../../src/services/WorkItemService';
import { WorkItem, WorkItemLink, WorkItemPermissions } from '../../src/types';

// Mock VSS SDK
const mockVSS = {
  getExtensionContext: jest.fn(),
  getService: jest.fn(),
  getWebContext: jest.fn(),
  ServiceIds: {
    WorkItemTracking: 'WorkItemTracking',
    ExtensionData: 'ExtensionData',
    WorkItemFormService: 'WorkItemFormService',
    Security: 'Security'
  }
};

// Mock work item tracking client
const mockWorkItemTrackingClient = {
  getWorkItem: jest.fn()
};

// Mock work item form service
const mockWorkItemFormService = {
  getId: jest.fn()
};

// Mock extension data service
const mockDataService = {
  getValue: jest.fn(),
  setValue: jest.fn()
};

// Mock security service
const mockSecurityService = {};

// Set up global VSS mock
(global as any).VSS = mockVSS;

describe('WorkItemService', () => {
  let workItemService: WorkItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockVSS.getExtensionContext.mockReturnValue({ id: 'test-extension' });
    mockVSS.getWebContext.mockReturnValue({
      user: { id: 'test-user', displayName: 'Test User' }
    });
    
    mockVSS.getService.mockImplementation((serviceId) => {
      switch (serviceId) {
        case 'WorkItemTracking':
          return Promise.resolve(mockWorkItemTrackingClient);
        case 'ExtensionData':
          return Promise.resolve(mockDataService);
        case 'WorkItemFormService':
          return Promise.resolve(mockWorkItemFormService);
        case 'Security':
          return Promise.resolve(mockSecurityService);
        default:
          return Promise.resolve({});
      }
    });

    workItemService = new WorkItemService();
  });

  describe('getCurrentWorkItem', () => {
    it('should return current work item successfully', async () => {
      // Arrange
      const mockWorkItemId = 123;
      const mockWorkItemData = {
        id: mockWorkItemId,
        fields: {
          'System.Title': 'Test User Story',
          'System.WorkItemType': 'User Story',
          'System.State': 'Active',
          'System.AssignedTo': { displayName: 'John Doe' }
        }
      };

      mockWorkItemFormService.getId.mockResolvedValue(mockWorkItemId);
      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue(mockWorkItemData);

      // Act
      const result = await workItemService.getCurrentWorkItem();

      // Assert
      expect(result).toEqual({
        id: mockWorkItemId,
        title: 'Test User Story',
        workItemType: 'User Story',
        state: 'Active',
        assignedTo: 'John Doe',
        fields: mockWorkItemData.fields
      });
      expect(mockWorkItemFormService.getId).toHaveBeenCalled();
      expect(mockWorkItemTrackingClient.getWorkItem).toHaveBeenCalledWith(mockWorkItemId);
    });

    it('should throw error when no work item is loaded', async () => {
      // Arrange
      mockWorkItemFormService.getId.mockResolvedValue(null);

      // Act & Assert
      await expect(workItemService.getCurrentWorkItem()).rejects.toMatchObject({
        type: 'platform',
        message: 'No work item is currently loaded'
      });
    });

    it('should handle work item tracking client errors', async () => {
      // Arrange
      mockWorkItemFormService.getId.mockResolvedValue(123);
      mockWorkItemTrackingClient.getWorkItem.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(workItemService.getCurrentWorkItem()).rejects.toMatchObject({
        type: 'platform',
        message: 'Failed to get current work item'
      });
    });
  });

  describe('checkWorkItemPermissions', () => {
    it('should return permissions when user can access work item', async () => {
      // Arrange
      const workItemId = 123;
      const mockWorkItem = { id: workItemId, fields: {} };
      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue(mockWorkItem);

      // Act
      const result = await workItemService.checkWorkItemPermissions(workItemId);

      // Assert
      expect(result).toEqual({
        canEdit: true,
        canView: true,
        canDelete: true
      });
      expect(mockWorkItemTrackingClient.getWorkItem).toHaveBeenCalledWith(workItemId);
    });

    it('should return no permissions when user cannot access work item', async () => {
      // Arrange
      const workItemId = 123;
      mockWorkItemTrackingClient.getWorkItem.mockRejectedValue(new Error('Access denied'));

      // Act
      const result = await workItemService.checkWorkItemPermissions(workItemId);

      // Assert
      expect(result).toEqual({
        canEdit: false,
        canView: false,
        canDelete: false
      });
    });
  });

  describe('linkFeatureFlag', () => {
    it('should successfully link feature flag to work item', async () => {
      // Arrange
      const workItemId = 123;
      const flagId = 'flag-123';
      const existingLinks: WorkItemLink[] = [];

      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue({ id: workItemId });
      mockDataService.getValue.mockResolvedValue(JSON.stringify(existingLinks));
      mockDataService.setValue.mockResolvedValue(undefined);

      // Act
      await workItemService.linkFeatureFlag(workItemId, flagId);

      // Assert
      expect(mockDataService.setValue).toHaveBeenCalledWith(
        'workitem-featureflag-links',
        expect.stringContaining(flagId)
      );
    });

    it('should not create duplicate links', async () => {
      // Arrange
      const workItemId = 123;
      const flagId = 'flag-123';
      const existingLinks: WorkItemLink[] = [{
        workItemId,
        featureFlagId: flagId,
        linkType: 'feature-flag',
        createdAt: new Date()
      }];

      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue({ id: workItemId });
      mockDataService.getValue.mockResolvedValue(JSON.stringify(existingLinks));

      // Act
      await workItemService.linkFeatureFlag(workItemId, flagId);

      // Assert
      expect(mockDataService.setValue).not.toHaveBeenCalled();
    });

    it('should throw error when user lacks permissions', async () => {
      // Arrange
      const workItemId = 123;
      const flagId = 'flag-123';
      mockWorkItemTrackingClient.getWorkItem.mockRejectedValue(new Error('Access denied'));

      // Act & Assert
      await expect(workItemService.linkFeatureFlag(workItemId, flagId))
        .rejects.toMatchObject({
          type: 'platform',
          message: 'Insufficient permissions to link feature flag to work item'
        });
    });
  });

  describe('getLinkedFeatureFlags', () => {
    it('should return linked feature flags for work item', async () => {
      // Arrange
      const workItemId = 123;
      const links: WorkItemLink[] = [
        {
          workItemId,
          featureFlagId: 'flag-1',
          linkType: 'feature-flag',
          createdAt: new Date()
        },
        {
          workItemId,
          featureFlagId: 'flag-2',
          linkType: 'feature-flag',
          createdAt: new Date()
        },
        {
          workItemId: 456, // Different work item
          featureFlagId: 'flag-3',
          linkType: 'feature-flag',
          createdAt: new Date()
        }
      ];

      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue({ id: workItemId });
      mockDataService.getValue.mockResolvedValue(JSON.stringify(links));

      // Act
      const result = await workItemService.getLinkedFeatureFlags(workItemId);

      // Assert
      expect(result).toEqual(['flag-1', 'flag-2']);
    });

    it('should return empty array when no links exist', async () => {
      // Arrange
      const workItemId = 123;
      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue({ id: workItemId });
      mockDataService.getValue.mockResolvedValue(null);

      // Act
      const result = await workItemService.getLinkedFeatureFlags(workItemId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw error when user lacks view permissions', async () => {
      // Arrange
      const workItemId = 123;
      mockWorkItemTrackingClient.getWorkItem.mockRejectedValue(new Error('Access denied'));

      // Act & Assert
      await expect(workItemService.getLinkedFeatureFlags(workItemId))
        .rejects.toMatchObject({
          type: 'platform',
          message: 'Insufficient permissions to view work item feature flags'
        });
    });
  });

  describe('unlinkFeatureFlag', () => {
    it('should successfully unlink feature flag from work item', async () => {
      // Arrange
      const workItemId = 123;
      const flagId = 'flag-123';
      const existingLinks: WorkItemLink[] = [
        {
          workItemId,
          featureFlagId: flagId,
          linkType: 'feature-flag',
          createdAt: new Date()
        },
        {
          workItemId,
          featureFlagId: 'flag-456',
          linkType: 'feature-flag',
          createdAt: new Date()
        }
      ];

      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue({ id: workItemId });
      mockDataService.getValue.mockResolvedValue(JSON.stringify(existingLinks));
      mockDataService.setValue.mockResolvedValue(undefined);

      // Act
      await workItemService.unlinkFeatureFlag(workItemId, flagId);

      // Assert
      const savedData = JSON.parse(mockDataService.setValue.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].featureFlagId).toBe('flag-456');
    });

    it('should handle unlinking non-existent link gracefully', async () => {
      // Arrange
      const workItemId = 123;
      const flagId = 'non-existent-flag';
      const existingLinks: WorkItemLink[] = [];

      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue({ id: workItemId });
      mockDataService.getValue.mockResolvedValue(JSON.stringify(existingLinks));
      mockDataService.setValue.mockResolvedValue(undefined);

      // Act
      await workItemService.unlinkFeatureFlag(workItemId, flagId);

      // Assert
      expect(mockDataService.setValue).toHaveBeenCalledWith(
        'workitem-featureflag-links',
        JSON.stringify([])
      );
    });

    it('should throw error when user lacks permissions', async () => {
      // Arrange
      const workItemId = 123;
      const flagId = 'flag-123';
      mockWorkItemTrackingClient.getWorkItem.mockRejectedValue(new Error('Access denied'));

      // Act & Assert
      await expect(workItemService.unlinkFeatureFlag(workItemId, flagId))
        .rejects.toMatchObject({
          type: 'platform',
          message: 'Insufficient permissions to unlink feature flag from work item'
        });
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Arrange
      const workItemId = 123;
      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue({ id: workItemId });
      mockDataService.getValue.mockRejectedValue(new Error('Storage error'));

      // Act
      const result = await workItemService.getLinkedFeatureFlags(workItemId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw platform error when storage save fails', async () => {
      // Arrange
      const workItemId = 123;
      const flagId = 'flag-123';
      mockWorkItemTrackingClient.getWorkItem.mockResolvedValue({ id: workItemId });
      mockDataService.getValue.mockResolvedValue('[]');
      mockDataService.setValue.mockRejectedValue(new Error('Storage save error'));

      // Act & Assert
      await expect(workItemService.linkFeatureFlag(workItemId, flagId))
        .rejects.toMatchObject({
          type: 'platform',
          message: 'Failed to save work item links'
        });
    });
  });
});