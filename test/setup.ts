// Jest setup file for testing environment
import '@testing-library/jest-dom';

// Mock Azure DevOps SDK
jest.mock('azure-devops-extension-sdk', () => ({
  init: jest.fn(),
  ready: jest.fn(),
  getService: jest.fn(),
  getConfiguration: jest.fn(),
  getUser: jest.fn(),
  getHost: jest.fn(),
  getExtensionContext: jest.fn()
}));

// Mock VSS SDK for Azure DevOps extensions
Object.defineProperty(window, 'VSS', {
  value: {
    init: jest.fn(),
    ready: jest.fn((callback) => callback()),
    notifyLoadSucceeded: jest.fn(),
    notifyLoadFailed: jest.fn(),
    getService: jest.fn(),
    ServiceIds: {
      ExtensionDataService: 'ms.vss-features.extension-data-service'
    }
  },
  writable: true
});

// Mock crypto for encryption functionality
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  }
});

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock btoa and atob for base64 encoding/decoding
global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));

// Global test utilities and mocks can be added here
global.console = {
  ...console,
  // Suppress console.log in tests unless needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};