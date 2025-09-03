import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FeatureFlag, WorkItem, FeatBitError } from '../../types';
import { WorkItemService } from '../../services/WorkItemService';
import { FeatBitService } from '../../services/FeatBitService';
import { ConfigurationService } from '../../services/ConfigurationService';
import { CreateFeatureFlagDialog } from '../CreateFeatureFlagDialog/CreateFeatureFlagDialog';
import DebounceHandler from '../../utils/DebounceHandler';
// import usePerformanceMonitor from '../../hooks/usePerformanceMonitor';

// Azure DevOps UI Components
import { Button } from "azure-devops-ui/Button";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { Card } from "azure-devops-ui/Card";
import { Toggle } from "azure-devops-ui/Toggle";
import { Icon } from "azure-devops-ui/Icon";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Status, Statuses, StatusSize } from "azure-devops-ui/Status";

// Azure DevOps UI Styles
import "azure-devops-ui/Core/override.css";
import './FeatureFlagPanel.css';

interface FeatureFlagPanelProps {
  workItemService?: WorkItemService;
  featBitService?: FeatBitService;
  configurationService?: ConfigurationService;
}

interface FeatureFlagPanelState {
  featureFlags: FeatureFlag[];
  currentWorkItem: WorkItem | null;
  loading: boolean;
  error: string | null;
  toggleStates: Record<string, boolean>;
  deleteStates: Record<string, boolean>;
  unlinkStates: Record<string, boolean>;
  archiveStates: Record<string, boolean>;
  restoreStates: Record<string, boolean>;
  isCreateDialogOpen: boolean;
}

export const FeatureFlagPanel: React.FC<FeatureFlagPanelProps> = React.memo(({
  workItemService = new WorkItemService(),
  featBitService = new FeatBitService(),
  configurationService = new ConfigurationService()
}) => {
  const [state, setState] = useState<FeatureFlagPanelState>({
    featureFlags: [],
    currentWorkItem: null,
    loading: true,
    error: null,
    toggleStates: {},
    deleteStates: {},
    unlinkStates: {},
    archiveStates: {},
    restoreStates: {},
    isCreateDialogOpen: false
  });

  // Performance monitoring
  // const { trackApiCall } = usePerformanceMonitor('FeatureFlagPanel');

  /**
   * Load feature flags associated with the current work item
   */
  const loadFeatureFlags = useCallback(async () => {
    try {
      // setState(prev => ({ ...prev, loading: true, error: null }));
      debugger;
      console.log('loadFeatureFlags');
      // Get current work item
      const workItem = await workItemService.getCurrentWorkItem();
      console.log('workItem', workItem);
      
      // Get configuration
      const config = await configurationService.getConfiguration();
      console.log('config', config);
      if (!config) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'FeatBit configuration not found. Please configure the extension first.'
        }));
        return;
      }

      // Set configuration for FeatBit service
      featBitService.setConfiguration(config);

      // Get linked feature flag IDs
      const linkedFlagIds = await workItemService.getLinkedFeatureFlags(workItem.id);
      console.log('linkedFlagIds', linkedFlagIds);
      if (linkedFlagIds.length === 0) {
        setState(prev => ({
          ...prev,
          currentWorkItem: workItem,
          featureFlags: [],
          loading: false
        }));
        return;
      }

      // Get all feature flags for the project
      // trackApiCall();
      const allFlags = await featBitService.getFeatureFlags(config.projectId);
      
      // Filter to only linked flags
      const linkedFlags = allFlags.filter(flag => linkedFlagIds.indexOf(flag.id) !== -1);

      setState(prev => ({
        ...prev,
        currentWorkItem: workItem,
        featureFlags: linkedFlags,
        loading: false
      }));

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  }, [workItemService, featBitService, configurationService]);

  // Debounced toggle function to prevent rapid API calls
  
  const debouncedToggle = useMemo(
    () => DebounceHandler.debounce(
      async (flagId: string, newEnabled: boolean) => {
        await featBitService.toggleFeatureFlagImmediate(flagId, newEnabled);
      },
      300, // 300ms debounce delay
      { leading: false, trailing: true }
    ),
    [featBitService]
  );

  /**
   * Toggle a feature flag on/off with debouncing
   */
  const toggleFeatureFlag = useCallback(async (flagKey: string, currentEnabled: boolean) => {
    try {
      // Set loading state for this specific flag
      setState(prev => ({
        ...prev,
        toggleStates: { ...prev.toggleStates, [flagKey]: true }
      }));

      const newEnabled = !currentEnabled;
      
      // Optimistically update UI
      setState(prev => ({
        ...prev,
        featureFlags: prev.featureFlags.map(flag =>
          flag.key === flagKey ? { ...flag, isEnabled: newEnabled } : flag
        )
      }));

      // Perform debounced API call
      // trackApiCall();
      // await debouncedToggle(flagId, newEnabled);
      const config = await configurationService.getConfiguration();
      if (!config) {
        throw new Error('FeatBit configuration not found. Please configure the extension first.');
      }
      featBitService.setConfiguration(config);
      await featBitService.toggleFeatureFlagImmediate(flagKey, newEnabled);

      // Clear loading state
      setState(prev => ({
        ...prev,
        toggleStates: { ...prev.toggleStates, [flagKey]: false }
      }));

    } catch (error) {
      // Revert the optimistic update and show error
      setState(prev => ({
        ...prev,
        featureFlags: prev.featureFlags.map(flag =>
          flag.key === flagKey ? { ...flag, isEnabled: currentEnabled } : flag
        ),
        toggleStates: { ...prev.toggleStates, [flagKey]: false },
        error: `Failed to toggle feature flag: ${getErrorMessage(error)}`
      }));
    }
  }, [debouncedToggle]);

  /**
   * Delete a feature flag permanently from FeatBit
   */
  const deleteFeatureFlag = useCallback(async (flagId: string, flagName: string) => {
    const flag = state.featureFlags.find(f => f.id === flagId);
    const isAlreadyArchived = flag?.isArchived || false;
    
    const confirmMessage = isAlreadyArchived 
      ? `Are you sure you want to permanently delete the archived feature flag "${flagName}"?\n\nThis action cannot be undone and will remove it from FeatBit entirely.`
      : `Are you sure you want to permanently delete the feature flag "${flagName}"?\n\nThis will:\n1. Archive the feature flag\n2. Permanently delete it from FeatBit\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Set loading state for this specific flag
      setState(prev => ({
        ...prev,
        deleteStates: { ...prev.deleteStates, [flagId]: true }
      }));

      // Ensure FeatBit service is configured
      const config = await configurationService.getConfiguration();
      if (!config) {
        throw new Error('FeatBit configuration not found. Please configure the extension first.');
      }
      featBitService.setConfiguration(config);

      // Find the flag to get its key
      const flag = state.featureFlags.find(f => f.id === flagId);
      if (!flag) {
        throw new Error('Feature flag not found');
      }

      // Delete from FeatBit (pass isArchived status to skip archiving if already archived)
      await featBitService.deleteFeatureFlag(flag.key, flag.isArchived);

      // Remove from local state and unlink from work item
      setState(prev => ({
        ...prev,
        featureFlags: prev.featureFlags.filter(f => f.id !== flagId),
        deleteStates: { ...prev.deleteStates, [flagId]: false }
      }));

      // Also unlink from work item if we have a current work item
      if (state.currentWorkItem) {
        try {
          await workItemService.unlinkFeatureFlag(state.currentWorkItem.id, flagId);
        } catch (unlinkError) {
          console.warn('Failed to unlink feature flag from work item:', unlinkError);
          // Don't fail the entire operation if unlinking fails
        }
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        deleteStates: { ...prev.deleteStates, [flagId]: false },
        error: `Failed to delete feature flag: ${getErrorMessage(error)}`
      }));
    }
  }, [configurationService, featBitService, workItemService, state.featureFlags, state.currentWorkItem]);

  /**
   * Unlink a feature flag from the current work item (without deleting from FeatBit)
   */
  const unlinkFeatureFlag = useCallback(async (flagId: string, flagName: string) => {
    if (!state.currentWorkItem) {
      setState(prev => ({
        ...prev,
        error: 'No work item is currently loaded'
      }));
      return;
    }

    if (!confirm(`Are you sure you want to unlink the feature flag "${flagName}" from this work item? The flag will remain in FeatBit but will no longer be associated with this work item.`)) {
      return;
    }

    try {
      // Set loading state for this specific flag
      setState(prev => ({
        ...prev,
        unlinkStates: { ...prev.unlinkStates, [flagId]: true }
      }));

      // Unlink from work item
      await workItemService.unlinkFeatureFlag(state.currentWorkItem.id, flagId);

      // Remove from local state
      setState(prev => ({
        ...prev,
        featureFlags: prev.featureFlags.filter(f => f.id !== flagId),
        unlinkStates: { ...prev.unlinkStates, [flagId]: false }
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        unlinkStates: { ...prev.unlinkStates, [flagId]: false },
        error: `Failed to unlink feature flag: ${getErrorMessage(error)}`
      }));
    }
  }, [workItemService, state.currentWorkItem, state.featureFlags]);

  /**
   * Archive a feature flag (without deleting)
   */
  const archiveFeatureFlag = useCallback(async (flagId: string, flagName: string) => {
    if (!confirm(`Are you sure you want to archive the feature flag "${flagName}"?\n\nThis will disable the flag and mark it as archived in FeatBit. You can unarchive it later if needed.`)) {
      return;
    }

    try {
      // Set loading state for this specific flag
      setState(prev => ({
        ...prev,
        archiveStates: { ...prev.archiveStates, [flagId]: true }
      }));

      // Ensure FeatBit service is configured
      const config = await configurationService.getConfiguration();
      if (!config) {
        throw new Error('FeatBit configuration not found. Please configure the extension first.');
      }
      featBitService.setConfiguration(config);

      // Find the flag to get its key
      const flag = state.featureFlags.find(f => f.id === flagId);
      if (!flag) {
        throw new Error('Feature flag not found');
      }

      // Archive the flag
      await featBitService.archiveFeatureFlag(flag.key);

      // Update flag status in local state (mark as disabled and archived)
      setState(prev => ({
        ...prev,
        featureFlags: prev.featureFlags.map(f => 
          f.id === flagId 
            ? { ...f, isArchived: true } 
            : f
        ),
        archiveStates: { ...prev.archiveStates, [flagId]: false }
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        archiveStates: { ...prev.archiveStates, [flagId]: false },
        error: `Failed to archive feature flag: ${getErrorMessage(error)}`
      }));
    }
  }, [configurationService, featBitService, state.featureFlags]);

  /**
   * Restore (unarchive) a feature flag
   */
  const restoreFeatureFlag = useCallback(async (flagId: string, flagName: string) => {
    if (!confirm(`Are you sure you want to restore the archived feature flag "${flagName}"?\n\nThis will unarchive the flag and make it active again in FeatBit.`)) {
      return;
    }

    try {
      // Set loading state for this specific flag
      setState(prev => ({
        ...prev,
        restoreStates: { ...prev.restoreStates, [flagId]: true }
      }));

      // Ensure FeatBit service is configured
      const config = await configurationService.getConfiguration();
      if (!config) {
        throw new Error('FeatBit configuration not found. Please configure the extension first.');
      }
      featBitService.setConfiguration(config);

      // Find the flag to get its key
      const flag = state.featureFlags.find(f => f.id === flagId);
      if (!flag) {
        throw new Error('Feature flag not found');
      }

      // Restore the flag
      await featBitService.restoreFeatureFlag(flag.key);

      // Update flag status in local state (mark as unarchived)
      setState(prev => ({
        ...prev,
        featureFlags: prev.featureFlags.map(f => 
          f.id === flagId 
            ? { ...f, isArchived: false } 
            : f
        ),
        restoreStates: { ...prev.restoreStates, [flagId]: false }
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        restoreStates: { ...prev.restoreStates, [flagId]: false },
        error: `Failed to restore feature flag: ${getErrorMessage(error)}`
      }));
    }
  }, [configurationService, featBitService, state.featureFlags]);

  /**
   * Retry loading feature flags
   */
  const retryLoad = useCallback(() => {
    loadFeatureFlags();
  }, []); // Remove loadFeatureFlags from dependencies to prevent loop

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Open create feature flag dialog
   */
  const openCreateDialog = useCallback(() => {
    setState(prev => ({ ...prev, isCreateDialogOpen: true }));
  }, []);

  /**
   * Close create feature flag dialog
   */
  const closeCreateDialog = useCallback(() => {
    setState(prev => ({ ...prev, isCreateDialogOpen: false }));
  }, []);

  /**
   * Handle successful feature flag creation
   */
  const handleFeatureFlagCreated = useCallback((newFlag: FeatureFlag) => {
    // Add the new flag to the list
    setState(prev => ({
      ...prev,
      featureFlags: [...prev.featureFlags, newFlag],
      isCreateDialogOpen: false
    }));
    
    // Refresh the list to ensure data consistency
    setTimeout(() => {
      loadFeatureFlags();
    }, 100);
  }, []); // Remove loadFeatureFlags from dependencies to prevent loop

  // Memoized computed values
  const flagCount = useMemo(() => state.featureFlags.length, [state.featureFlags.length]);
  const hasFlags = useMemo(() => flagCount > 0, [flagCount]);
  const flagCountText = useMemo(() => 
    `${flagCount} flag${flagCount !== 1 ? 's' : ''}`, 
    [flagCount]
  );

  // Load feature flags on component mount
  useEffect(() => {
    console.log('loadFeatureFlags - mounting component');
    loadFeatureFlags();
  }, []); // Empty dependency array - only run on mount

  // Cleanup debounced calls on unmount
  useEffect(() => {
    return () => {
      debouncedToggle.cancel();
    };
  }, [debouncedToggle]);

  // Render loading state
  if (state.loading) {
    return (
      <Surface background={SurfaceBackground.neutral}>
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid #d0d7de",
          borderRadius: "6px",
          margin: "8px"
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #d0d7de",
            fontSize: "16px",
            fontWeight: 600,
            color: "#323130"
          }}>
            Feature Flags
          </div>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            padding: "40px 20px",
            flexDirection: "column",
            gap: "12px"
          }}>
            <Spinner size={SpinnerSize.large} />
            <span style={{ fontSize: "14px", color: "#323130" }}>Loading feature flags...</span>
        </div>
        </div>
      </Surface>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <Surface background={SurfaceBackground.neutral}>
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid #d0d7de",
          borderRadius: "6px",
          margin: "8px"
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #d0d7de",
            fontSize: "16px",
            fontWeight: 600,
            color: "#323130"
          }}>
            Feature Flags
        </div>
          <div style={{ padding: "20px" }}>
            <div style={{
              backgroundColor: "#fdf2f2",
              border: "1px solid #f5c6cb",
              borderRadius: "4px",
              padding: "12px",
              marginBottom: "16px",
              color: "#d13438",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px"
            }}>
              <Icon iconName="Error" style={{ color: "#d13438", flexShrink: 0, marginTop: "2px" }} />
            <span>{state.error}</span>
          </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button 
                text="Retry"
                primary={true}
                onClick={retryLoad}
                iconProps={{ iconName: "Refresh" }}
              />
              <Button 
                text="Dismiss"
                onClick={clearError}
                iconProps={{ iconName: "Clear" }}
              />
            </div>
          </div>
        </div>
      </Surface>
    );
  }

  // Render empty state
  if (!hasFlags) {
    return (
      <Surface background={SurfaceBackground.neutral}>
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid #d0d7de",
          borderRadius: "6px",
          margin: "8px"
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #d0d7de",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <h3 style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "#323130"
            }}>
              Feature Flags
            </h3>
            <Button
              text="Create Feature Flag"
              primary={true}
              onClick={openCreateDialog}
              iconProps={{ iconName: "Add" }}
            />
          </div>
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center", 
            padding: "60px 20px",
            textAlign: "center"
          }}>
            <Icon 
              iconName="Flag" 
              style={{ 
                fontSize: "48px", 
                color: "#605e5c", 
                marginBottom: "20px" 
              }} 
            />
            <h3 style={{ 
              fontSize: "20px", 
              fontWeight: 600, 
              margin: "0 0 12px 0", 
              color: "#323130" 
            }}>
              No feature flags found
            </h3>
            <p style={{ 
              fontSize: "14px", 
              color: "#605e5c", 
              margin: "0 0 8px 0", 
              maxWidth: "400px" 
            }}>
              This work item doesn't have any associated feature flags yet.
            </p>
            <p style={{ 
              fontSize: "14px", 
              color: "#605e5c", 
              margin: "0 0 24px 0", 
              maxWidth: "400px" 
            }}>
              Create a new feature flag to get started with feature flag-driven development.
            </p>
            <Button
              text="Create Your First Feature Flag"
              primary={true}
              onClick={openCreateDialog}
              iconProps={{ iconName: "Add" }}
            />
        </div>
          
          {/* Create Feature Flag Dialog */}
          <CreateFeatureFlagDialog
            isOpen={state.isCreateDialogOpen}
            onClose={closeCreateDialog}
            onSuccess={handleFeatureFlagCreated}
            featBitService={featBitService}
            workItemService={workItemService}
            configurationService={configurationService}
            workItem={state.currentWorkItem || undefined}
          />
        </div>
      </Surface>
    );
  }

  // Render feature flags list
  return (
    <Surface background={SurfaceBackground.neutral}>
      <div style={{
        backgroundColor: "#ffffff",
        border: "1px solid #d0d7de",
        borderRadius: "6px",
        margin: "8px"
      }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #d0d7de",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "#323130"
            }}>
              Feature Flags
            </h3>
            <span style={{
              fontSize: "12px",
              color: "#605e5c",
              marginTop: "2px"
            }}>
              {flagCountText}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              text="Refresh"
              onClick={retryLoad}
              iconProps={{ iconName: "Refresh" }}
              tooltipProps={{ text: "Refresh feature flags list" }}
            />
            <Button
              text="Create Feature Flag"
              primary={true}
              onClick={openCreateDialog}
              iconProps={{ iconName: "Add" }}
            />
          </div>
      </div>
        <div style={{ padding: "0 20px 20px 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {state.featureFlags.map(flag => (
          <FeatureFlagItem
            key={flag.id}
            flag={flag}
            isToggling={state.toggleStates[flag.id] || false}
                isDeleting={state.deleteStates[flag.id] || false}
                isUnlinking={state.unlinkStates[flag.id] || false}
                isArchiving={state.archiveStates[flag.id] || false}
                isRestoring={state.restoreStates[flag.id] || false}
            onToggle={toggleFeatureFlag}
                onDelete={deleteFeatureFlag}
                onUnlink={unlinkFeatureFlag}
                onArchive={archiveFeatureFlag}
                onRestore={restoreFeatureFlag}
          />
        ))}
          </div>
      </div>
      
        {/* Create Feature Flag Dialog */}
        <CreateFeatureFlagDialog
          isOpen={state.isCreateDialogOpen}
          onClose={closeCreateDialog}
          onSuccess={handleFeatureFlagCreated}
          featBitService={featBitService}
          workItemService={workItemService}
          configurationService={configurationService}
          workItem={state.currentWorkItem || undefined}
        />
      </div>
    </Surface>
  );
});

FeatureFlagPanel.displayName = 'FeatureFlagPanel';

/**
 * Extract user-friendly error message from error object
 */
function getErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error occurred';
  
  // Handle typed extension errors
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const typedError = error as FeatBitError;
    
    switch (typedError.type) {
      case 'network':
        if ((typedError as any).timeout) {
          return 'Request timed out. Please check your connection and try again.';
        }
        return `Network error: ${typedError.message}`;
      
      case 'authentication':
        return 'Authentication failed. Please check your FeatBit configuration.';
      
      case 'validation':
        return `Validation error: ${typedError.message}`;
      
      case 'business':
        return `Operation failed: ${typedError.message}`;
      
      case 'platform':
        return `Azure DevOps error: ${typedError.message}`;
      
      case 'extension':
        return `Extension error: ${typedError.message}`;
      
      default:
        return (typedError as any).message || 'An error occurred';
    }
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
}

// Memoized individual feature flag item component
const FeatureFlagItem: React.FC<{
  flag: FeatureFlag;
  isToggling: boolean;
  isDeleting: boolean;
  isUnlinking: boolean;
  isArchiving: boolean;
  isRestoring: boolean;
  onToggle: (flagId: string, currentEnabled: boolean) => void;
  onDelete: (flagId: string, flagName: string) => void;
  onUnlink: (flagId: string, flagName: string) => void;
  onArchive: (flagId: string, flagName: string) => void;
  onRestore: (flagId: string, flagName: string) => void;
}> = React.memo(({ flag, isToggling, isDeleting, isUnlinking, isArchiving, isRestoring, onToggle, onDelete, onUnlink, onArchive, onRestore }) => {
  const handleToggle = useCallback(() => {
    onToggle(flag.key, flag.isEnabled);
  }, [flag.key, flag.isEnabled, onToggle]);

  const handleDelete = useCallback(() => {
    onDelete(flag.id, flag.name);
  }, [flag.id, flag.name, onDelete]);

  const handleUnlink = useCallback(() => {
    onUnlink(flag.id, flag.name);
  }, [flag.id, flag.name, onUnlink]);

  const handleArchive = useCallback(() => {
    onArchive(flag.id, flag.name);
  }, [flag.id, flag.name, onArchive]);

  const handleRestore = useCallback(() => {
    onRestore(flag.id, flag.name);
  }, [flag.id, flag.name, onRestore]);

  return (
    <Card 
      className="feature-flag-item"
      style={{ 
        padding: "16px", 
        border: "1px solid #d0d7de",
        borderRadius: "6px",
        backgroundColor: "#ffffff"
      }}
    >
      <div style={{ 
        display: "flex", 
        alignItems: "flex-start", 
        justifyContent: "space-between",
        gap: "16px"
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "12px", 
            marginBottom: "8px" 
          }}>
            <h4 style={{ 
              margin: 0, 
              fontSize: "16px", 
              fontWeight: 600, 
              color: "#323130",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {flag.name}
            </h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Status
                {...(flag.isEnabled ? Statuses.Success : Statuses.Warning)}
                size={StatusSize.s}
                text={flag.isEnabled ? 'Enabled' : 'Disabled'}
              />
              {flag.isArchived && (
                <Status
                  {...Statuses.Information}
                  size={StatusSize.s}
                  text="Archived"
                />
              )}
          </div>
        </div>
        {flag.description && (
            <p style={{ 
              margin: 0, 
              fontSize: "14px", 
              color: "#605e5c",
              lineHeight: "20px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical"
            }}>
              {flag.description}
            </p>
        )}
      </div>
      
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "8px",
          flexShrink: 0 
        }}>
          {/* Toggle Controls */}
          {isToggling ? (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              padding: "0 8px"
            }}>
              <Spinner size={SpinnerSize.small} />
              <span style={{ fontSize: "12px", color: "#605e5c" }}>
                Updating...
              </span>
            </div>
          ) : (
            <Toggle
              checked={flag.isEnabled}
              onChange={handleToggle}
              disabled={isToggling || isDeleting || isUnlinking || isArchiving || isRestoring}
              text={flag.isEnabled ? 'Enabled' : 'Disabled'}
              offText="Disabled"
              onText="Enabled"
            />
          )}
          
          {/* Action Buttons */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "4px",
            marginLeft: "8px"
          }}>
            {/* Archive/Restore Button */}
            {flag.isArchived ? (
              <Button
                text={isRestoring ? "Restoring..." : "Restore"}
                onClick={handleRestore}
                disabled={isToggling || isDeleting || isUnlinking || isArchiving || isRestoring}
                subtle={true}
                iconProps={{ iconName: "Undo" }}
                tooltipProps={{ text: "Restore this archived feature flag (make it active again)" }}
                style={{ color: "#0078d4" }}
              />
            ) : (
              <Button
                text={isArchiving ? "Archiving..." : "Archive"}
                onClick={handleArchive}
                disabled={isToggling || isDeleting || isUnlinking || isArchiving || isRestoring}
                subtle={true}
                iconProps={{ iconName: "Archive" }}
                tooltipProps={{ text: "Archive this feature flag (can be restored later)" }}
                style={{ color: "#8a8886" }}
              />
            )}
            
            {/* Unlink Button */}
            <Button
              text={isUnlinking ? "Unlinking..." : "Unlink"}
              onClick={handleUnlink}
              disabled={isToggling || isDeleting || isUnlinking || isArchiving || isRestoring}
              subtle={true}
              iconProps={{ iconName: "Unlink" }}
              tooltipProps={{ text: "Remove this feature flag from the work item (flag will remain in FeatBit)" }}
            />
            
            {/* Delete Button */}
            <Button
              text={isDeleting ? (flag.isArchived ? "Deleting..." : "Archiving & Deleting...") : "Delete"}
              onClick={handleDelete}
              disabled={isToggling || isDeleting || isUnlinking || isArchiving || isRestoring}
              subtle={true}
              iconProps={{ iconName: "Delete" }}
              tooltipProps={{ 
                text: flag.isArchived 
                  ? "Permanently delete this archived feature flag from FeatBit" 
                  : "Archive and permanently delete this feature flag from FeatBit" 
              }}
              style={{ color: "#d13438" }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
});

FeatureFlagItem.displayName = 'FeatureFlagItem';