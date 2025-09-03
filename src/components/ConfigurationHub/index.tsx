import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigurationHub } from './ConfigurationHub';
import { 
  initializeExtension, 
  notifyLoadSucceeded, 
  handleExtensionError 
} from '../../utils/ExtensionInitializer';

// Initialize the configuration hub
async function initializeConfigurationHub() {
  try {
    // Initialize Azure DevOps SDK
    const context = await initializeExtension({
      applyTheme: true,
      loaded: false
    });

    // Get the container element
    const container = document.getElementById('configuration-hub-root');
    
    if (!container) {
      throw new Error('Configuration hub root element not found');
    }

    // Create React root and render the component
    const root = createRoot(container);
    root.render(<ConfigurationHub />);

    // Notify Azure DevOps that the extension loaded successfully
    notifyLoadSucceeded();

    console.log('Configuration Hub initialized successfully', context);
  } catch (error) {
    handleExtensionError(error, 'Configuration Hub');
  }
}

// Handle global errors
window.addEventListener('error', (event) => {
  handleExtensionError(event.error, 'Configuration Hub');
});

window.addEventListener('unhandledrejection', (event) => {
  handleExtensionError(event.reason, 'Configuration Hub');
});

// Start initialization
initializeConfigurationHub();