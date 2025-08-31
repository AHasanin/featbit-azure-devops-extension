import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CreateFeatureFlagRequest, FeatureFlag, WorkItem, ValidationResult, FeatBitError, ValidationError, FeatureFlagVariation } from '../../types';
import { FeatBitService } from '../../services/FeatBitService';
import { WorkItemService } from '../../services/WorkItemService';
import { ConfigurationService } from '../../services/ConfigurationService';
import { validateCreateFeatureFlagRequest, generateFeatureFlagName } from '../../utils/validation';

// Azure DevOps UI Components
import { TextField } from "azure-devops-ui/TextField";
import { Checkbox } from "azure-devops-ui/Checkbox";
import { Button } from "azure-devops-ui/Button";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";

// Azure DevOps UI Styles
import "azure-devops-ui/Core/override.css";
import "./CreateFeatureFlagDialog.css";

// Additional imports for proper typing

interface CreateFeatureFlagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (featureFlag: FeatureFlag) => void;
  featBitService?: FeatBitService;
  workItemService?: WorkItemService;
  configurationService?: ConfigurationService;
  workItem?: WorkItem;
}

interface FormState {
  name: string;
  description: string;
  enabled: boolean;
}

interface FormErrors {
  name?: string;
  description?: string;
  general?: string;
}

interface LoadingStates {
  loading: boolean;
  creating: boolean;
  checkingUniqueness: boolean;
}

export const CreateFeatureFlagDialog: React.FC<CreateFeatureFlagDialogProps> = React.memo(({
  isOpen,
  onClose,
  onSuccess,
  featBitService = new FeatBitService(),
  workItemService = new WorkItemService(),
  configurationService = new ConfigurationService(),
  workItem
}) => {
  const [formState, setFormState] = useState<FormState>({
    name: '',
    description: '',
    enabled: false
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    loading: false,
    creating: false,
    checkingUniqueness: false
  });

  const [currentWorkItem, setCurrentWorkItem] = useState<WorkItem | null>(workItem || null);
  const [nameCheckTimeout, setNameCheckTimeout] = useState<number | null>(null);

  // Helper function to create default boolean variations
  const createDefaultBooleanVariations = (): FeatureFlagVariation[] => {
    return [
      {
        id: crypto.randomUUID(),
        name: "True",
        value: "true"
      },
      {
        id: crypto.randomUUID(),
        name: "False", 
        value: "false"
      }
    ];
  };

  // Helper function to create variation IDs for enabled/disabled states
  const createVariationIds = (variations: FeatureFlagVariation[]): { enabledId: string, disabledId: string } => {
    const trueVariation = variations.find(v => v.value === "true");
    const falseVariation = variations.find(v => v.value === "false");
    
    return {
      enabledId: trueVariation?.id || variations[0]?.id || "",
      disabledId: falseVariation?.id || variations[1]?.id || ""
    };
  };

  // Load current work item if not provided
  useEffect(() => {
    if (!currentWorkItem && isOpen) {
      loadCurrentWorkItem();
    }
  }, [isOpen, currentWorkItem]);

  // Auto-generation removed - users will manually enter feature flag names

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setLoadingStates({
        loading: false,
        creating: false,
        checkingUniqueness: false
      });
      loadConfiguration();
    } else {
      // Reset form when dialog closes
      setFormState({
        name: '',
        description: '',
        enabled: false
      });
      setErrors({});
    }
  }, [isOpen]);

  // Load and set FeatBit configuration
  const loadConfiguration = async () => {
    try {
      const config = await configurationService.getConfiguration();
      if (!config) {
        setErrors({ general: 'FeatBit configuration not found. Please configure the extension first.' });
        return;
      }
      
      // Set configuration for FeatBit service
      featBitService.setConfiguration(config);
      console.log('FeatBit configuration loaded and set in CreateFeatureFlagDialog');
    } catch (error) {
      console.error('Failed to load FeatBit configuration:', error);
      setErrors({ general: 'Failed to load FeatBit configuration. Please try again.' });
    }
  };

  const loadCurrentWorkItem = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, loading: true }));
      const workItem = await workItemService.getCurrentWorkItem();
      setCurrentWorkItem(workItem);
    } catch (error) {
      console.error('Failed to load current work item:', error);
      setErrors({ general: 'Failed to load current work item. Please try again.' });
    } finally {
      setLoadingStates(prev => ({ ...prev, loading: false }));
    }
  };

  const handleInputChange = useCallback((field: keyof FormState, value: string | boolean) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Clear general error when form changes
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: undefined }));
    }

    // Check name uniqueness with debouncing
    if (field === 'name' && typeof value === 'string') {
      if (nameCheckTimeout) {
        clearTimeout(nameCheckTimeout);
      }

      const timeout = setTimeout(() => {
        checkNameUniqueness(value);
      }, 500); // 500ms debounce

      setNameCheckTimeout(timeout);
    }
  }, [errors, nameCheckTimeout]);

  const checkNameUniqueness = async (name: string) => {
    if (!name.trim() || !currentWorkItem) {
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, checkingUniqueness: true }));
      
      // Get existing feature flags to check for duplicates
      const existingFlags = await featBitService.getFeatureFlags(currentWorkItem.fields.projectId || 'default');
      const isDuplicate = existingFlags.some(flag => 
        flag.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (isDuplicate) {
        setErrors(prev => ({ 
          ...prev, 
          name: 'A feature flag with this name already exists. Please choose a different name.' 
        }));
      }
    } catch (error) {
      // Don't show error for uniqueness check failures - just log them
      console.warn('Failed to check name uniqueness:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, checkingUniqueness: false }));
    }
  };

  const validateForm = (): boolean => {
    if (!currentWorkItem) {
      setErrors({ general: 'No work item available. Please try again.' });
      return false;
    }

    const variations = createDefaultBooleanVariations();
    const variationIds = createVariationIds(variations);

    // Create a partial request for validation (just the required fields)
    const request: Partial<CreateFeatureFlagRequest> = {
      envId: 'temp-env-id', // Will be set from config during actual creation
      name: formState.name.trim(),
      key: formState.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
      isEnabled: formState.enabled,
      description: formState.description.trim(),
      variationType: 'boolean',
      variations: variations,
      enabledVariationId: variationIds.enabledId,
      disabledVariationId: variationIds.disabledId,
      tags: [],
      // Internal tracking fields
      projectId: currentWorkItem.fields.projectId || 'default',
      workItemId: currentWorkItem.id
    };

    const validation: ValidationResult = validateCreateFeatureFlagRequest(request);
    
    if (!validation.isValid) {
      const newErrors: FormErrors = {};
      
      validation.errors.forEach(error => {
        if (error.field === 'name') {
          newErrors.name = error.message;
        } else if (error.field === 'description') {
          newErrors.description = error.message;
        } else {
          newErrors.general = error.message;
        }
      });
      
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !currentWorkItem) {
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, creating: true }));

      const variations = createDefaultBooleanVariations();
      const variationIds = createVariationIds(variations);
      
      // Get environment ID from configuration
      const config = await configurationService.getConfiguration();
      if (!config) {
        setErrors({ general: 'FeatBit configuration not found. Please configure the extension first.' });
        return;
      }

      const request: CreateFeatureFlagRequest = {
        envId: config.environmentId,
        name: formState.name.trim(),
        key: formState.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
        isEnabled: formState.enabled,
        description: formState.description.trim(),
        variationType: 'boolean',
        variations: variations,
        enabledVariationId: variationIds.enabledId,
        disabledVariationId: variationIds.disabledId,
        tags: [],
        // Internal tracking fields
        projectId: currentWorkItem.fields.projectId || 'default',
        workItemId: currentWorkItem.id
      };

      const createdFlag = await featBitService.createFeatureFlag(request);
      
      // Link the feature flag to the work item
      await workItemService.linkFeatureFlag(currentWorkItem.id, createdFlag.id);

      onSuccess(createdFlag);
      onClose();

    } catch (error) {
      console.error('Failed to create feature flag:', error);
      
      const featBitError = error as FeatBitError;
      let errorMessage = 'Failed to create feature flag. Please try again.';

      if (featBitError.type === 'validation' && (featBitError as ValidationError).field === 'name') {
        setErrors({ name: featBitError.message });
        return;
      } else if (featBitError.type === 'authentication') {
        errorMessage = 'Authentication failed. Please check your FeatBit configuration.';
      } else if (featBitError.type === 'network') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (featBitError.message) {
        errorMessage = featBitError.message;
      }

      setErrors({ general: errorMessage });
    } finally {
      setLoadingStates(prev => ({ ...prev, creating: false }));
    }
  };

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Memoized computed values
  const isFormValid = useMemo(() => {
    return formState.name.trim().length > 0 && !errors.name;
  }, [formState.name, errors.name]);

  const isSubmitDisabled = useMemo(() => {
    return loadingStates.creating || loadingStates.loading || !!errors.name || !isFormValid;
  }, [loadingStates.creating, loadingStates.loading, errors.name, isFormValid]);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px"
    }} onClick={handleCancel}>
      <div 
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "4px",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          minWidth: "500px",
          maxWidth: "600px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px 16px 24px",
          borderBottom: "1px solid #e1dfdd"
        }}>
          <h3 style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 600,
            color: "#323130"
          }}>
            Create Feature Flag
          </h3>
          <Button
            iconProps={{ iconName: "Cancel" }}
            onClick={handleCancel}
            disabled={loadingStates.creating}
            ariaLabel="Close dialog"
            subtle={true}
          />
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto" }}>
          {loadingStates.loading ? (
            <div style={{ display: "flex", alignItems: "center", padding: "20px" }}>
              <Spinner size={SpinnerSize.medium} />
              <span style={{ marginLeft: "10px" }}>Loading work item...</span>
            </div>
          ) : (
            <>
              {currentWorkItem && (
                <div style={{
                  backgroundColor: "#f3f2f1",
                  border: "1px solid #e1dfdd",
                  borderRadius: "4px",
                  padding: "12px",
                  marginBottom: "16px",
                  fontSize: "14px"
                }}>
                  <strong>Work Item:</strong> {currentWorkItem.title}
                </div>
              )}

              {errors.general && (
                <div style={{
                  backgroundColor: "#fdf2f2",
                  border: "1px solid #f5c6cb",
                  borderRadius: "4px",
                  padding: "12px",
                  marginBottom: "16px",
                  color: "#d13438"
                }}>
                  <strong>Error:</strong> {errors.general}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label style={{ 
                    fontSize: "14px", 
                    fontWeight: 600, 
                    color: "#323130",
                    display: "block",
                    marginBottom: "6px"
                  }}>
                    Feature Flag Name <span style={{ color: "#d13438" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <TextField
                      value={formState.name}
                      onChange={(e, newValue) => handleInputChange('name', newValue)}
                      placeholder="Enter feature flag name"
                      disabled={loadingStates.creating}
                      maxLength={100}
                    />
                    {loadingStates.checkingUniqueness && (
                      <div style={{ 
                        position: "absolute", 
                        right: "8px", 
                        top: "50%", 
                        transform: "translateY(-50%)" 
                      }}>
                        <Spinner size={SpinnerSize.small} />
                      </div>
                    )}
                  </div>
                  {errors.name && (
                    <div style={{ fontSize: "12px", color: "#d13438", marginTop: "4px" }}>
                      {errors.name}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#605e5c", marginTop: "4px" }}>
                    Must start with a letter and contain only letters, numbers, hyphens, and underscores
                  </div>
                </div>

                <div>
                  <label style={{ 
                    fontSize: "14px", 
                    fontWeight: 600, 
                    color: "#323130",
                    display: "block",
                    marginBottom: "6px"
                  }}>
                    Description
                  </label>
                  <TextField
                    value={formState.description}
                    onChange={(e, newValue) => handleInputChange('description', newValue)}
                    placeholder="Enter a description for this feature flag"
                    disabled={loadingStates.creating}
                    maxLength={500}
                    multiline={true}
                    rows={3}
                  />
                  {errors.description && (
                    <div style={{ fontSize: "12px", color: "#d13438", marginTop: "4px" }}>
                      {errors.description}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#605e5c", marginTop: "4px" }}>
                    Optional description to help identify the purpose of this feature flag
                  </div>
                </div>

                <div>
                  <Checkbox
                    checked={formState.enabled}
                    onChange={(e, checked) => handleInputChange('enabled', checked)}
                    disabled={loadingStates.creating}
                    label="Enable feature flag immediately"
                  />
                  <div style={{ fontSize: "12px", color: "#605e5c", marginTop: "4px" }}>
                    When checked, the feature flag will be enabled when created
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex",
          gap: "12px",
          padding: "16px 24px 20px 24px",
          borderTop: "1px solid #e1dfdd",
          justifyContent: "flex-end"
        }}>
          <Button
            text="Cancel"
            onClick={handleCancel}
            disabled={loadingStates.creating}
          />
          <Button
            text={loadingStates.creating ? "Creating..." : "Create Feature Flag"}
            primary={true}
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            iconProps={loadingStates.creating ? { iconName: "StatusCircleRing" } : undefined}
          />
        </div>
      </div>
    </div>
  );
});

CreateFeatureFlagDialog.displayName = 'CreateFeatureFlagDialog';