// Core data models and interfaces for FeatBit Azure DevOps Extension

export interface FeatureFlagVariation {
  id: string;
  name: string;
  value: string;
}

export interface FeatureFlagServes {
  enabledVariations: string[];
  disabledVariation: string;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  key: string;
  isEnabled: boolean;
  isArchived: boolean;
  variationType: string;
  variations: FeatureFlagVariation[];
  updatedAt: string;
  serves: FeatureFlagServes;
  tags: string[];
  projectId?: string; // Keep for internal tracking
  linkedWorkItems?: number[]; // Keep for internal tracking
}

export interface FeatBitConfig {
  serverUrl: string;
  apiKey: string;
  projectId: string;
  environmentId: string;
}

export interface CreateFeatureFlagRequest {
  envId: string;
  name: string;
  key: string;
  isEnabled: boolean;
  description: string;
  variationType: string;
  variations: FeatureFlagVariation[];
  enabledVariationId: string;
  disabledVariationId: string;
  tags: string[];
  // Internal tracking fields (not sent to FeatBit API)
  projectId?: string;
  workItemId?: number;
}

export interface WorkItem {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  assignedTo?: string;
  fields: Record<string, any>;
}

export interface WorkItemLink {
  workItemId: number;
  featureFlagId: string;
  linkType: 'feature-flag';
  createdAt: Date;
}

export interface WorkItemPermissions {
  canEdit: boolean;
  canView: boolean;
  canDelete: boolean;
}

// Error types and interfaces
export interface BaseError extends Error {
  code: string;
  timestamp: Date;
}

export interface NetworkError extends BaseError {
  type: 'network';
  code: 'TIMEOUT' | 'CONNECTION_REFUSED' | 'DNS_ERROR' | 'NETWORK_ERROR';
  statusCode?: number;
}

export interface AuthenticationError extends BaseError {
  type: 'authentication';
  code: 'INVALID_API_KEY' | 'INSUFFICIENT_PERMISSIONS' | 'TOKEN_EXPIRED' | 'AUTH_ERROR';
}

export interface ValidationError extends BaseError {
  type: 'validation';
  field: string;
  value?: any;
  constraints?: string[];
}

export interface BusinessLogicError extends BaseError {
  type: 'business';
  code: 'DUPLICATE_FLAG_NAME' | 'WORK_ITEM_NOT_FOUND' | 'PROJECT_NOT_FOUND' | 'BUSINESS_ERROR';
  details?: Record<string, any>;
}

export interface PlatformError extends BaseError {
  type: 'platform';
  source: 'azure_devops' | 'extension';
  details?: string;
}

export interface ExtensionError extends BaseError {
  type: 'extension';
  component: string;
  originalError?: Error;
}

export type FeatBitError = NetworkError | AuthenticationError | ValidationError | BusinessLogicError | PlatformError | ExtensionError;

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface UserFriendlyMessage {
  title: string;
  message: string;
  actionable?: string;
  severity: 'error' | 'warning' | 'info';
}