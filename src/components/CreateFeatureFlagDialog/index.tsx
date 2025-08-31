import React from 'react';
import { createRoot } from 'react-dom/client';
import { CreateFeatureFlagDialog } from './CreateFeatureFlagDialog';
import { 
  initializeExtension, 
  notifyLoadSucceeded, 
  handleExtensionError 
} from '../../utils/ExtensionInitializer';

// Initialize the extension
async function initializeCreateFeatureFlagDialog() {
  try {
    // Initialize Azure DevOps SDK
    const context = await initializeExtension({
      applyTheme: true,
      loaded: false
    });

    // Get the container element
    const container = document.getElementById('create-flag-dialog-root');
    
    if (!container) {
      throw new Error('Create Feature Flag Dialog container element not found');
    }

    // Create React root and render the component
    const root = createRoot(container);
    root.render(
      <CreateFeatureFlagDialog 
        isOpen={true}
        onClose={() => {
          // Handle dialog close
          console.log('Dialog closed');
        }}
        onSuccess={(featureFlag) => {
          // Handle successful creation
          console.log('Feature flag created:', featureFlag);
        }}
      />
    );

    // Notify Azure DevOps that the extension loaded successfully
    notifyLoadSucceeded();

    console.log('Create Feature Flag Dialog initialized successfully', context);
  } catch (error) {
    handleExtensionError(error, 'Create Feature Flag Dialog');
  }
}

// Handle global errors
window.addEventListener('error', (event) => {
  handleExtensionError(event.error, 'Create Feature Flag Dialog');
});

window.addEventListener('unhandledrejection', (event) => {
  handleExtensionError(event.reason, 'Create Feature Flag Dialog');
});

// Start initialization
initializeCreateFeatureFlagDialog();

// Export the component for testing
export { CreateFeatureFlagDialog } from './CreateFeatureFlagDialog';