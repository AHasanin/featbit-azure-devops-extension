import { WorkItem, WorkItemLink, WorkItemPermissions, PlatformError } from '../types';
import * as SDK from "azure-devops-extension-sdk";
import { IWorkItemFormService, WorkItemTrackingServiceIds } from "azure-devops-extension-api/WorkItemTracking";

/**
 * Modern WorkItemService using IWorkItemFormService API instead of problematic WorkItemTrackingRestClient
 */
export class WorkItemService {
  private extensionContext: any;
  private dataService: any = null;
  private extensionDataManager: any = null;
  private readonly STORAGE_KEY = 'workitem-featureflag-links';
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Don't initialize immediately - wait for first method call
  }

  /**
   * Initialize Azure DevOps SDK services
   */
  private async initializeServices(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      // Get extension context from modern SDK
      this.extensionContext = SDK.getExtensionContext();
      
      // Note: We no longer use WorkItemTrackingRestClient as it's problematic
      // We use IWorkItemFormService instead, which is the modern recommended approach
      console.log('Using modern IWorkItemFormService API approach');
      
      // Initialize Extension Data Service for storage
      this.dataService = await SDK.getService("ms.vss-features.extension-data-service");
      console.log('Extension Data Service initialized successfully');
      
      // Initialize Extension Data Manager for getValue/setValue operations
      if (this.dataService && typeof this.dataService.getExtensionDataManager === 'function') {
        const accessToken = await SDK.getAccessToken();
        this.extensionDataManager = await this.dataService.getExtensionDataManager(this.extensionContext.id, accessToken);
        console.log('Extension Data Manager initialized successfully');
      } else {
        throw new Error('Extension Data Service does not support getExtensionDataManager');
      }
    } catch (error) {
      throw this.createPlatformError('Failed to initialize Azure DevOps services', error);
    }
  }

  /**
   * Get the current work item being viewed using modern IWorkItemFormService API
   */
  async getCurrentWorkItem(): Promise<WorkItem> {
    try {
      await this.ensureServicesInitialized();
      
      console.log('Getting work item using modern IWorkItemFormService API');
      
      // Get work item form service - this is the modern recommended approach
      const workItemFormService = await SDK.getService<IWorkItemFormService>(WorkItemTrackingServiceIds.WorkItemFormService);
      
      if (!workItemFormService || typeof workItemFormService.getId !== 'function') {
        throw this.createPlatformError('Work item form service not available or missing getId method');
      }
      
      const workItemId = await workItemFormService.getId();
      console.log('Work item ID from form service:', workItemId);
      
      if (!workItemId) {
        throw this.createPlatformError('No work item is currently loaded');
      }

      // Use IWorkItemFormService to get field values - this is the modern approach
      console.log('Getting field values using IWorkItemFormService.getFieldValues()');
      
      const fieldsToRetrieve = [
        'System.Id',
        'System.Title',
        'System.WorkItemType',
        'System.State',
        'System.AssignedTo',
        'System.CreatedDate',
        'System.ChangedDate',
        'System.TeamProject'
      ];
      
      // Get all field values using the modern API
      const fieldValues = await workItemFormService.getFieldValues(fieldsToRetrieve);
      console.log('Retrieved field values:', fieldValues);
      
      // Convert field values to our internal format
      const workItem = {
        id: workItemId,
        title: fieldValues['System.Title'] as string || '',
        workItemType: fieldValues['System.WorkItemType'] as string || '',
        state: fieldValues['System.State'] as string || '',
        assignedTo: (fieldValues['System.AssignedTo'] as any)?.displayName || 
                    (fieldValues['System.AssignedTo'] as any)?.uniqueName ||
                    fieldValues['System.AssignedTo'] as string || undefined,
        fields: fieldValues
      };
      
      console.log('Successfully created work item object:', workItem);
      return workItem;
      
    } catch (error) {
      console.error('Error in getCurrentWorkItem:', error);
      
      if (error && typeof error === 'object' && 'type' in error && error.type === 'platform') {
        throw error;
      }
      throw this.createPlatformError('Failed to get current work item using form service', error);
    }
  }

  /**
   * Check if the current user has permissions to modify the work item
   */
  async checkWorkItemPermissions(workItemId: number): Promise<WorkItemPermissions> {
    try {
      await this.ensureServicesInitialized();
      
      // Get current user context
      const userContext = SDK.getUser();
      
      // For now, we'll do a basic check by trying to get the work item
      // In a real implementation, you'd use proper permission APIs
      try {
        // Use form service to check if we can access the work item
        const workItemFormService = await SDK.getService<IWorkItemFormService>(WorkItemTrackingServiceIds.WorkItemFormService);
        const currentId = await workItemFormService.getId();
        
        // Basic permission check - if we can read, assume we can edit
        // This should be replaced with proper permission checking
        const canAccess = currentId === workItemId;
        const canEdit = canAccess && userContext.id !== undefined;
        
        return {
          canEdit,
          canView: canAccess,
          canDelete: canEdit // Simplified - same as edit for now
        };
      } catch (permissionError) {
        return {
          canEdit: false,
          canView: false,
          canDelete: false
        };
      }
    } catch (error) {
      throw this.createPlatformError('Failed to check work item permissions', error);
    }
  }

  /**
   * Link a feature flag to a work item
   */
  async linkFeatureFlag(workItemId: number, flagId: string): Promise<void> {
    try {
      await this.ensureServicesInitialized();
      
      // Check permissions first
      const permissions = await this.checkWorkItemPermissions(workItemId);
      if (!permissions.canEdit) {
        throw this.createPlatformError('Insufficient permissions to link feature flag to work item');
      }

      // Get existing links
      const existingLinks = await this.getStoredLinks();
      
      // Check if link already exists
      const existingLink = existingLinks.find(
        link => link.workItemId === workItemId && link.featureFlagId === flagId
      );
      
      if (existingLink) {
        return; // Link already exists
      }

      // Create new link
      const newLink: WorkItemLink = {
        workItemId,
        featureFlagId: flagId,
        linkType: 'feature-flag',
        createdAt: new Date()
      };

      // Add to existing links and save
      const updatedLinks = [...existingLinks, newLink];
      await this.saveLinks(updatedLinks);
      
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error && error.type === 'platform') {
        throw error;
      }
      throw this.createPlatformError('Failed to link feature flag to work item', error);
    }
  }

  /**
   * Get all feature flags linked to a work item
   */
  async getLinkedFeatureFlags(workItemId: number): Promise<string[]> {
    try {
      await this.ensureServicesInitialized();
      
      // Check permissions first
      const permissions = await this.checkWorkItemPermissions(workItemId);
      if (!permissions.canView) {
        throw this.createPlatformError('Insufficient permissions to view work item feature flags');
      }

      const links = await this.getStoredLinks();
      
      return links
        .filter(link => link.workItemId === workItemId)
        .map(link => link.featureFlagId);
        
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error && error.type === 'platform') {
        throw error;
      }
      throw this.createPlatformError('Failed to get linked feature flags', error);
    }
  }

  /**
   * Remove a feature flag link from a work item
   */
  async unlinkFeatureFlag(workItemId: number, flagId: string): Promise<void> {
    try {
      await this.ensureServicesInitialized();
      
      // Check permissions first
      const permissions = await this.checkWorkItemPermissions(workItemId);
      if (!permissions.canEdit) {
        throw this.createPlatformError('Insufficient permissions to unlink feature flag from work item');
      }

      const existingLinks = await this.getStoredLinks();
      
      // Filter out the link to remove
      const updatedLinks = existingLinks.filter(
        link => !(link.workItemId === workItemId && link.featureFlagId === flagId)
      );

      await this.saveLinks(updatedLinks);
      
    } catch (error) {
      if (error && typeof error === 'object' && 'type' in error && error.type === 'platform') {
        throw error;
      }
      throw this.createPlatformError('Failed to unlink feature flag from work item', error);
    }
  }

  /**
   * Get all work item links from storage
   */
  private async getStoredLinks(): Promise<WorkItemLink[]> {
    await this.ensureServicesInitialized();
    
    if (!this.extensionDataManager || typeof this.extensionDataManager.getValue !== 'function') {
      throw new Error('Extension Data Manager not available');
    }
    
    const storedData = await this.extensionDataManager.getValue(this.STORAGE_KEY, { scopeType: 'User' });
    return storedData ? JSON.parse(storedData) : [];
  }

  /**
   * Save work item links to storage
   */
  private async saveLinks(links: WorkItemLink[]): Promise<void> {
    await this.ensureServicesInitialized();
    
    if (!this.extensionDataManager || typeof this.extensionDataManager.setValue !== 'function') {
      throw new Error('Extension Data Manager not available');
    }
    
    const dataToStore = JSON.stringify(links);
    await this.extensionDataManager.setValue(this.STORAGE_KEY, dataToStore, { scopeType: 'User' });
  }

  /**
   * Ensure Azure DevOps services are initialized
   */
  private async ensureServicesInitialized(): Promise<void> {
    await this.initializeServices();
  }

  /**
   * Create a platform error with consistent formatting
   */
  private createPlatformError(message: string, originalError?: any): PlatformError {
    return {
      name: 'PlatformError',
      type: 'platform',
      source: 'azure_devops',
      message,
      code: 'WORKITEM_ERROR',
      timestamp: new Date(),
      details: originalError?.message || originalError?.toString()
    };
  }
}
