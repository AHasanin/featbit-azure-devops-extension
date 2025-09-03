/**
 * Extension initialization utility for Azure DevOps SDK setup
 */

import * as SDK from "azure-devops-extension-sdk";
import { IWorkItemFormService, WorkItemTrackingServiceIds } from "azure-devops-extension-api/WorkItemTracking";

export interface ExtensionInitializationOptions {
  applyTheme?: boolean;
  loaded?: boolean;
}

export interface ExtensionContext {
  workItem?: any;
  user?: any;
  project?: any;
  host?: any;
}

/**
 * Initialize the Azure DevOps extension SDK
 */
export function initializeExtension(options: ExtensionInitializationOptions = {}): Promise<ExtensionContext> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Initializing Azure DevOps Extension SDK...');
      
      // Initialize the modern Azure DevOps SDK
      await SDK.init({
        loaded: false, // We'll notify when loaded
        applyTheme: true,
        ...options
      });

      console.log('Azure DevOps SDK initialized successfully');

      // Get extension context
      const hostContext = SDK.getHost();
      const userContext = SDK.getUser();
      
      const context: ExtensionContext = {
        user: userContext,
        project: hostContext?.name ? { name: hostContext.name } : undefined,
        host: hostContext
      };

      // Try to get work item context if available
      try {
        const workItemFormService = await SDK.getService<IWorkItemFormService>(WorkItemTrackingServiceIds.WorkItemFormService);
        if (workItemFormService && typeof workItemFormService.getId === 'function') {
          const workItemId = await workItemFormService.getId();
          if (workItemId) {
            context.workItem = { id: workItemId };
          }
        }
      } catch (error) {
        console.log('Work item context not available (this is normal for non-work-item pages):', error);
        // Work item service not available, continue without it
      }

      console.log('Extension context:', context);
      resolve(context);

    } catch (error) {
      console.error('Failed to initialize Azure DevOps SDK:', error);
      reject(new Error(`Extension initialization failed: ${error}`));
    }
  });
}

/**
 * Notify Azure DevOps that the extension has loaded successfully
 */
export function notifyLoadSucceeded(): void {
  try {
    SDK.notifyLoadSucceeded();
    console.log('Notified Azure DevOps of successful load');
  } catch (error) {
    console.error('Failed to notify load succeeded:', error);
  }
}

/**
 * Notify Azure DevOps that the extension failed to load
 */
export function notifyLoadFailed(error: any): void {
  try {
    SDK.notifyLoadFailed(error);
    console.error('Notified Azure DevOps of load failure:', error);
  } catch (notifyError) {
    console.error('Failed to notify load failed:', notifyError);
  }
}

/**
 * Get Azure DevOps service by ID (deprecated - use specific getClient methods)
 * @deprecated Use specific getClient methods from azure-devops-extension-api instead
 */
export function getService<T>(serviceId: string): Promise<T> {
  return SDK.getService<T>(serviceId);
}

/**
 * Get work item form service
 */
export function getWorkItemFormService(): Promise<IWorkItemFormService> {
  return SDK.getService<IWorkItemFormService>(WorkItemTrackingServiceIds.WorkItemFormService);
}

/**
 * Get extension data service for secure storage
 */
export function getExtensionDataService(): Promise<any> {
  return SDK.getService("ms.vss-features.extension-data-service");
}

/**
 * Get web context information
 */
export function getWebContext(): any {
  try {
    return {
      user: SDK.getUser(),
      host: SDK.getHost()
    };
  } catch (error) {
    console.error('Failed to get web context:', error);
    return null;
  }
}

/**
 * Handle extension errors and provide user feedback
 */
export function handleExtensionError(error: any, componentName: string): void {
  console.error(`${componentName} Error:`, error);
  
  // Try to notify Azure DevOps of the failure
  notifyLoadFailed(error);
  
  // Show user-friendly error message
  const errorMessage = error?.message || 'An unexpected error occurred';
  const errorElement = document.createElement('div');
  errorElement.style.cssText = `
    padding: 20px;
    background-color: #fdf2f2;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    color: #721c24;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 20px;
  `;
  errorElement.innerHTML = `
    <h3>Extension Error</h3>
    <p><strong>${componentName}</strong> failed to load: ${errorMessage}</p>
    <p>Please try refreshing the page or contact your administrator if the problem persists.</p>
  `;
  
  document.body.appendChild(errorElement);
}