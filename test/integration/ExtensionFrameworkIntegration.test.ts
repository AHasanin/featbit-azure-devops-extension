/**
 * Integration tests for Azure DevOps Extension Framework integration
 */

import { initializeExtension, getWorkItemFormService, getExtensionDataService } from '../../src/utils/ExtensionInitializer';

// Mock VSS SDK
const mockVSS = {
  init: jest.fn(),
  ready: jest.fn(),
  getWebContext: jest.fn(),
  getService: jest.fn(),
  notifyLoadSucceeded: jest.fn(),
  notifyLoadFailed: jest.fn(),
  ServiceIds: {
    WorkItemFormService: 'ms.vss-work-web.work-item-form-service',
    ExtensionDataService: 'ms.vss-web.data-service'
  }
};

// Make VSS available globally
(global as any).VSS = mockVSS;

describe('Azure DevOps Extension Framework Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default VSS mock behavior
    mockVSS.init.mockImplementation((options) => {
      // Simulate VSS initialization
      setTimeout(() => {
        if (mockVSS.ready.mock.calls.length > 0) {
          const readyCallback = mockVSS.ready.mock.calls[0][0];
          readyCallback();
        }
      }, 0);
    });

    mockVSS.getWebContext.mockReturnValue({
      user: { id: 'test-user', displayName: 'Test User' },
      project: { id: 'test-project', name: 'Test Project' },
      host: { name: 'Azure DevOps' }
    });
  });

  describe('Extension Initialization', () => {
    it('should initialize extension with default options', async () => {
      const context = await initializeExtension();

      expect(mockVSS.init).toHaveBeenCalledWith({
        explicitNotifyLoaded: true,
        usePlatformStyles: true
      });

      expect(context).toEqual({
        user: { id: 'test-user', displayName: 'Test User' },
        project: { id: 'test-project', name: 'Test Project' },
        host: { name: 'Azure DevOps' }
      });
    });

    it('should initialize extension with custom options', async () => {
      const customOptions = {
        usePlatformStyles: false,
        explicitNotifyLoaded: false
      };

      await initializeExtension(customOptions);

      expect(mockVSS.init).toHaveBeenCalledWith(customOptions);
    });

    it('should handle initialization timeout', async () => {
      // Don't call the ready callback to simulate timeout
      mockVSS.init.mockImplementation(() => {
        // Do nothing - simulate hanging initialization
      });

      await expect(initializeExtension()).rejects.toThrow('Extension initialization timed out');
    });

    it('should handle VSS not available', async () => {
      // Temporarily remove VSS
      const originalVSS = (global as any).VSS;
      delete (global as any).VSS;

      await expect(initializeExtension()).rejects.toThrow('Azure DevOps VSS SDK is not available');

      // Restore VSS
      (global as any).VSS = originalVSS;
    });
  });

  describe('Service Integration', () => {
    beforeEach(() => {
      // Setup successful initialization
      mockVSS.init.mockImplementation((options) => {
        setTimeout(() => {
          const readyCallback = mockVSS.ready.mock.calls[0][0];
          readyCallback();
        }, 0);
      });
    });

    it('should get work item form service', async () => {
      const mockService = { getId: jest.fn().mockResolvedValue(123) };
      mockVSS.getService.mockResolvedValue(mockService);

      const service = await getWorkItemFormService();

      expect(mockVSS.getService).toHaveBeenCalledWith(mockVSS.ServiceIds.WorkItemFormService);
      expect(service).toBe(mockService);
    });

    it('should get extension data service', async () => {
      const mockService = { getValue: jest.fn(), setValue: jest.fn() };
      mockVSS.getService.mockResolvedValue(mockService);

      const service = await getExtensionDataService();

      expect(mockVSS.getService).toHaveBeenCalledWith(mockVSS.ServiceIds.ExtensionDataService);
      expect(service).toBe(mockService);
    });

    it('should handle service retrieval failure', async () => {
      mockVSS.getService.mockRejectedValue(new Error('Service not available'));

      await expect(getWorkItemFormService()).rejects.toThrow('Failed to get service');
    });
  });

  describe('Work Item Context', () => {
    it('should include work item context when available', async () => {
      const mockWorkItemService = {
        getId: jest.fn().mockResolvedValue(456)
      };

      mockVSS.getService.mockResolvedValue(mockWorkItemService);

      const context = await initializeExtension();

      // Wait for work item context to be loaded
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(context.workItem).toEqual({ id: 456 });
    });

    it('should handle work item service not available', async () => {
      mockVSS.getService.mockRejectedValue(new Error('Work item service not available'));

      const context = await initializeExtension();

      expect(context.workItem).toBeUndefined();
    });
  });

  describe('Extension Manifest Integration', () => {
    it('should have proper work item form contribution', () => {
      const manifest = require('../../vss-extension.json');
      
      const featureFlagPanel = manifest.contributions.find((c: any) => c.id === 'feature-flag-panel');
      
      expect(featureFlagPanel).toBeDefined();
      expect(featureFlagPanel.type).toBe('ms.vss-work-web.work-item-form-page');
      expect(featureFlagPanel.targets).toContain('ms.vss-work-web.work-item-form');
      expect(featureFlagPanel.properties.uri).toBe('dist/feature-flag-panel.html');
    });

    it('should have proper configuration hub contribution', () => {
      const manifest = require('../../vss-extension.json');
      
      const configHub = manifest.contributions.find((c: any) => c.id === 'configuration-hub');
      
      expect(configHub).toBeDefined();
      expect(configHub.type).toBe('ms.vss-web.hub');
      expect(configHub.targets).toContain('ms.vss-web.project-admin-hub-group');
      expect(configHub.properties.uri).toBe('dist/configuration-hub.html');
    });

    it('should have required scopes', () => {
      const manifest = require('../../vss-extension.json');
      
      expect(manifest.scopes).toContain('vso.work');
      expect(manifest.scopes).toContain('vso.work_write');
      expect(manifest.scopes).toContain('vso.extension_manage');
      expect(manifest.scopes).toContain('vso.extension.data_write');
    });

    it('should target correct work item types', () => {
      const manifest = require('../../vss-extension.json');
      
      const featureFlagPanel = manifest.contributions.find((c: any) => c.id === 'feature-flag-panel');
      const workItemTypeInput = featureFlagPanel.properties.inputs.find((i: any) => i.id === 'WorkItemType');
      
      expect(workItemTypeInput.properties.WorkItemTypeRefNames).toContain('Microsoft.VSTS.WorkItemTypes.UserStory');
      expect(workItemTypeInput.properties.WorkItemTypeRefNames).toContain('System.WorkItemTypes.UserStory');
      expect(workItemTypeInput.properties.WorkItemTypeRefNames).toContain('Agile.UserStory');
      expect(workItemTypeInput.properties.WorkItemTypeRefNames).toContain('CMMI.Requirement');
      expect(workItemTypeInput.properties.WorkItemTypeRefNames).toContain('Scrum.UserStory');
    });
  });
});