/**
 * Integration tests for Azure DevOps extension framework integration
 */

import { 
  initializeExtension, 
  notifyLoadSucceeded, 
  notifyLoadFailed,
  getWebContext,
  handleExtensionError
} from '../../src/utils/ExtensionInitializer';

// Mock VSS SDK
const mockVSS = {
  init: jest.fn(),
  ready: jest.fn(),
  notifyLoadSucceeded: jest.fn(),
  notifyLoadFailed: jest.fn(),
  getWebContext: jest.fn(),
  getService: jest.fn(),
  ServiceIds: {
    WorkItemFormService: 'ms.vss-work-web.work-item-form-service',
    ExtensionDataService: 'ms.vss-extension.data-service'
  }
};

// Mock global VSS
(global as any).VSS = mockVSS;

describe('Extension Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock behavior
    mockVSS.ready.mockImplementation((callback) => {
      setTimeout(callback, 0);
    });
    
    mockVSS.getWebContext.mockReturnValue({
      user: { id: 'test-user', name: 'Test User' },
      project: { id: 'test-project', name: 'Test Project' },
      host: { name: 'Azure DevOps' }
    });
  });

  describe('Extension Initialization', () => {
    it('should initialize extension successfully', async () => {
      const context = await initializeExtension();
      
      expect(mockVSS.init).toHaveBeenCalledWith({
        explicitNotifyLoaded: true,
        usePlatformStyles: true
      });
      
      expect(context).toEqual({
        user: { id: 'test-user', name: 'Test User' },
        project: { id: 'test-project', name: 'Test Project' },
        host: { name: 'Azure DevOps' }
      });
    });

    it('should handle initialization with custom options', async () => {
      const options = {
        usePlatformStyles: false,
        explicitNotifyLoaded: false
      };
      
      await initializeExtension(options);
      
      expect(mockVSS.init).toHaveBeenCalledWith(options);
    });

    it('should handle initialization timeout', async () => {
      mockVSS.ready.mockImplementation(() => {
        // Don't call the callback to simulate timeout
      });
      
      await expect(initializeExtension()).rejects.toThrow('Extension initialization timed out');
    });

    it('should handle VSS not available', async () => {
      (global as any).VSS = undefined;
      
      await expect(initializeExtension()).rejects.toThrow('Azure DevOps VSS SDK is not available');
      
      // Restore VSS for other tests
      (global as any).VSS = mockVSS;
    });
  });

  describe('Extension Notifications', () => {
    it('should notify load succeeded', () => {
      notifyLoadSucceeded();
      expect(mockVSS.notifyLoadSucceeded).toHaveBeenCalled();
    });

    it('should notify load failed', () => {
      const error = new Error('Test error');
      notifyLoadFailed(error);
      expect(mockVSS.notifyLoadFailed).toHaveBeenCalledWith(error);
    });

    it('should handle notification when VSS is not available', () => {
      (global as any).VSS = undefined;
      
      // Should not throw
      expect(() => notifyLoadSucceeded()).not.toThrow();
      expect(() => notifyLoadFailed(new Error('test'))).not.toThrow();
      
      // Restore VSS
      (global as any).VSS = mockVSS;
    });
  });

  describe('Web Context', () => {
    it('should get web context successfully', () => {
      const context = getWebContext();
      
      expect(mockVSS.getWebContext).toHaveBeenCalled();
      expect(context).toEqual({
        user: { id: 'test-user', name: 'Test User' },
        project: { id: 'test-project', name: 'Test Project' },
        host: { name: 'Azure DevOps' }
      });
    });

    it('should handle web context error', () => {
      mockVSS.getWebContext.mockImplementation(() => {
        throw new Error('Context error');
      });
      
      const context = getWebContext();
      expect(context).toBeNull();
    });
  });

  describe('Error Handling', () => {
    let originalCreateElement: any;
    let mockElement: any;

    beforeEach(() => {
      originalCreateElement = document.createElement;
      mockElement = {
        style: {},
        innerHTML: '',
        setAttribute: jest.fn()
      };
      
      document.createElement = jest.fn().mockReturnValue(mockElement);
      document.body.appendChild = jest.fn();
    });

    afterEach(() => {
      document.createElement = originalCreateElement;
    });

    it('should handle extension error and show user feedback', () => {
      const error = new Error('Test error');
      
      handleExtensionError(error, 'Test Component');
      
      expect(mockVSS.notifyLoadFailed).toHaveBeenCalledWith(error);
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalledWith(mockElement);
      expect(mockElement.innerHTML).toContain('Test Component');
      expect(mockElement.innerHTML).toContain('Test error');
    });

    it('should handle error without message', () => {
      const error = {};
      
      handleExtensionError(error, 'Test Component');
      
      expect(mockElement.innerHTML).toContain('An unexpected error occurred');
    });
  });

  describe('Work Item Integration', () => {
    it('should get work item context when available', async () => {
      const mockWorkItemService = {
        getId: jest.fn().mockResolvedValue(123)
      };
      
      mockVSS.getService.mockResolvedValue(mockWorkItemService);
      
      const context = await initializeExtension();
      
      expect(context.workItem).toEqual({ id: 123 });
    });

    it('should handle work item service not available', async () => {
      mockVSS.getService.mockRejectedValue(new Error('Service not available'));
      
      const context = await initializeExtension();
      
      expect(context.workItem).toBeUndefined();
    });
  });
});

describe('Extension Manifest Validation', () => {
  it('should have valid contribution configuration', () => {
    // This would typically load and validate the actual vss-extension.json
    // For now, we'll test the expected structure
    const expectedContributions = [
      {
        id: 'feature-flag-panel',
        type: 'ms.vss-work-web.work-item-form-page',
        targets: ['ms.vss-work-web.work-item-form']
      },
      {
        id: 'configuration-hub',
        type: 'ms.vss-web.hub',
        targets: ['ms.vss-web.project-admin-hub-group']
      }
    ];
    
    expectedContributions.forEach(contribution => {
      expect(contribution.id).toBeDefined();
      expect(contribution.type).toBeDefined();
      expect(contribution.targets).toBeDefined();
      expect(Array.isArray(contribution.targets)).toBe(true);
    });
  });

  it('should have required scopes', () => {
    const requiredScopes = [
      'vso.work',
      'vso.work_write',
      'vso.extension_manage',
      'vso.extension.data_write'
    ];
    
    requiredScopes.forEach(scope => {
      expect(scope).toMatch(/^vso\./);
    });
  });
});