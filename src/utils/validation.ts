import { FeatBitConfig, CreateFeatureFlagRequest, ValidationError, ValidationResult } from '../types';

// Feature flag name validation rules
const FEATURE_FLAG_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const MIN_FLAG_NAME_LENGTH = 3;
const MAX_FLAG_NAME_LENGTH = 100;

// URL validation regex
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

// API key validation (basic format check)
const API_KEY_REGEX = /^[a-zA-Z0-9_-]{20,}$/;

/**
 * Validates a feature flag name according to FeatBit naming conventions
 */
export function validateFeatureFlagName(name: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!name || typeof name !== 'string') {
    errors.push(createValidationError('name', name, ['Feature flag name is required']));
    return { isValid: false, errors };
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    errors.push(createValidationError('name', name, ['Feature flag name is required']));
    return { isValid: false, errors };
  }

  if (trimmedName.length < MIN_FLAG_NAME_LENGTH) {
    errors.push(createValidationError('name', name, [`Feature flag name must be at least ${MIN_FLAG_NAME_LENGTH} characters long`]));
  }

  if (trimmedName.length > MAX_FLAG_NAME_LENGTH) {
    errors.push(createValidationError('name', name, [`Feature flag name must not exceed ${MAX_FLAG_NAME_LENGTH} characters`]));
  }

  if (!FEATURE_FLAG_NAME_REGEX.test(trimmedName)) {
    errors.push(createValidationError('name', name, [
      'Feature flag name must start with a letter and contain only letters, numbers, hyphens, and underscores'
    ]));
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates FeatBit configuration data
 */
export function validateFeatBitConfig(config: Partial<FeatBitConfig>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate server URL
  if (!config.serverUrl || typeof config.serverUrl !== 'string') {
    errors.push(createValidationError('serverUrl', config.serverUrl, ['Server URL is required']));
  } else if (!URL_REGEX.test(config.serverUrl.trim())) {
    errors.push(createValidationError('serverUrl', config.serverUrl, ['Server URL must be a valid HTTP or HTTPS URL']));
  }

  // Validate API key
  if (!config.apiKey || typeof config.apiKey !== 'string') {
    errors.push(createValidationError('apiKey', config.apiKey, ['API key is required']));
  } else if (!API_KEY_REGEX.test(config.apiKey.trim())) {
    errors.push(createValidationError('apiKey', config.apiKey, ['API key format is invalid']));
  }

  // Validate project ID
  if (!config.projectId || typeof config.projectId !== 'string') {
    errors.push(createValidationError('projectId', config.projectId, ['Project ID is required']));
  } else if (config.projectId.trim().length === 0) {
    errors.push(createValidationError('projectId', config.projectId, ['Project ID cannot be empty']));
  }

  // Validate environment ID
  if (!config.environmentId || typeof config.environmentId !== 'string') {
    errors.push(createValidationError('environmentId', config.environmentId, ['Environment ID is required']));
  } else if (config.environmentId.trim().length === 0) {
    errors.push(createValidationError('environmentId', config.environmentId, ['Environment ID cannot be empty']));
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates create feature flag request data
 */
export function validateCreateFeatureFlagRequest(request: Partial<CreateFeatureFlagRequest>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate name using the feature flag name validator
  if (request.name !== undefined) {
    const nameValidation = validateFeatureFlagName(request.name);
    errors.push(...nameValidation.errors);
  } else {
    errors.push(createValidationError('name', request.name, ['Feature flag name is required']));
  }

  // Validate key (auto-generated from name, but still validate)
  if (request.key !== undefined) {
    if (typeof request.key !== 'string' || request.key.trim().length === 0) {
      errors.push(createValidationError('key', request.key, ['Feature flag key is required']));
    }
  }

  // Validate description
  if (request.description !== undefined && typeof request.description !== 'string') {
    errors.push(createValidationError('description', request.description, ['Description must be a string']));
  }

  // Validate isEnabled flag (new field name)
  if (request.isEnabled !== undefined && typeof request.isEnabled !== 'boolean') {
    errors.push(createValidationError('isEnabled', request.isEnabled, ['IsEnabled flag must be a boolean']));
  }

  // Validate variationType
  if (request.variationType !== undefined) {
    if (typeof request.variationType !== 'string' || request.variationType.trim().length === 0) {
      errors.push(createValidationError('variationType', request.variationType, ['Variation type is required']));
    }
  }

  // Validate variations array
  if (request.variations !== undefined) {
    if (!Array.isArray(request.variations) || request.variations.length === 0) {
      errors.push(createValidationError('variations', request.variations, ['At least one variation is required']));
    }
  }

  // Validate enabled variation ID
  if (request.enabledVariationId !== undefined) {
    if (typeof request.enabledVariationId !== 'string' || request.enabledVariationId.trim().length === 0) {
      errors.push(createValidationError('enabledVariationId', request.enabledVariationId, ['Enabled variation ID is required']));
    }
  }

  // Validate disabled variation ID
  if (request.disabledVariationId !== undefined) {
    if (typeof request.disabledVariationId !== 'string' || request.disabledVariationId.trim().length === 0) {
      errors.push(createValidationError('disabledVariationId', request.disabledVariationId, ['Disabled variation ID is required']));
    }
  }

  // Validate environment ID
  if (request.envId !== undefined) {
    if (typeof request.envId !== 'string' || request.envId.trim().length === 0) {
      errors.push(createValidationError('envId', request.envId, ['Environment ID is required']));
    }
  }

  // Validate tags array
  if (request.tags !== undefined && !Array.isArray(request.tags)) {
    errors.push(createValidationError('tags', request.tags, ['Tags must be an array']));
  }

  // Validate project ID (optional for internal tracking)
  if (request.projectId !== undefined) {
    if (typeof request.projectId !== 'string' || request.projectId.trim().length === 0) {
      errors.push(createValidationError('projectId', request.projectId, ['Project ID must be a non-empty string']));
    }
  }

  // Validate work item ID (optional for internal tracking)
  if (request.workItemId !== undefined) {
    if (typeof request.workItemId !== 'number' || !Number.isInteger(request.workItemId) || request.workItemId <= 0) {
      errors.push(createValidationError('workItemId', request.workItemId, ['Work item ID must be a positive integer']));
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Generates a feature flag name from a user story title
 */
export function generateFeatureFlagName(userStoryTitle: string): string {
  if (!userStoryTitle || typeof userStoryTitle !== 'string') {
    return '';
  }

  return userStoryTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/^(\d)/, 'flag_$1') // Ensure it starts with a letter
    .substring(0, MAX_FLAG_NAME_LENGTH); // Limit length
}

/**
 * Helper function to create validation errors
 */
function createValidationError(field: string, value: any, constraints: string[]): ValidationError {
  return {
    name: 'ValidationError',
    type: 'validation',
    message: constraints.join(', '),
    code: 'VALIDATION_ERROR',
    timestamp: new Date(),
    field,
    value,
    constraints
  };
}