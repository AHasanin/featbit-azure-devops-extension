import React from 'react';
import { createRoot } from 'react-dom/client';
import { FeatureFlagPanel } from './FeatureFlagPanel';
import { 
  initializeExtension, 
  notifyLoadSucceeded, 
  handleExtensionError 
} from '../../utils/ExtensionInitializer';

// Initialize the extension
async function initializeFeatureFlagPanel() {
  try {
    // Initialize Azure DevOps SDK
    const context = await initializeExtension({
      applyTheme: true,
      loaded: false
    });

    // Get the container element
    const container = document.getElementById('feature-flag-panel-root');
    
    if (!container) {
      throw new Error('Feature Flag Panel container element not found');
    }

    // Create React root and render the component
    const root = createRoot(container);
    root.render(<FeatureFlagPanel />);

    // Notify Azure DevOps that the extension loaded successfully
    notifyLoadSucceeded();

    console.log('Feature Flag Panel initialized successfully', context);
  } catch (error) {
    handleExtensionError(error, 'Feature Flag Panel');
  }
}

// Handle global errors
window.addEventListener('error', (event) => {
  handleExtensionError(event.error, 'Feature Flag Panel');
});

window.addEventListener('unhandledrejection', (event) => {
  handleExtensionError(event.reason, 'Feature Flag Panel');
});

// Start initialization
initializeFeatureFlagPanel();

// Export the component for testing
export { FeatureFlagPanel } from './FeatureFlagPanel';