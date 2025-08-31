import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FeatBitConfig, ValidationResult } from '../../types';
import { ConfigurationService } from '../../services/ConfigurationService';

// Azure DevOps UI Components
import { TextField } from "azure-devops-ui/TextField";
import { Button } from "azure-devops-ui/Button";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { Card } from "azure-devops-ui/Card";

// Azure DevOps UI Styles
import "azure-devops-ui/Core/override.css";

interface ConfigurationHubProps {
  configurationService?: ConfigurationService;
}

interface FormState {
  serverUrl: string;
  apiKey: string;
  projectId: string;
  environmentId: string;
}

interface FormErrors {
  serverUrl?: string;
  apiKey?: string;
  projectId?: string;
  environmentId?: string;
  general?: string;
}

interface LoadingStates {
  loading: boolean;
  testing: boolean;
  saving: boolean;
}

export const ConfigurationHub: React.FC<ConfigurationHubProps> = React.memo(({ 
  configurationService = new ConfigurationService() 
}) => {
  const [formState, setFormState] = useState<FormState>({
    serverUrl: '',
    apiKey: '',
    projectId: '',
    environmentId: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    loading: true,
    testing: false,
    saving: false
  });

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Load existing configuration on component mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoadingStates(prev => ({ ...prev, loading: true }));
      const config = await configurationService.getConfiguration();
      
      if (config) {
        setFormState({
          serverUrl: config.serverUrl,
          apiKey: config.apiKey,
          projectId: config.projectId,
          environmentId: config.environmentId
        });
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      setErrors({ general: 'Failed to load existing configuration' });
    } finally {
      setLoadingStates(prev => ({ ...prev, loading: false }));
    }
  };

  const handleInputChange = useCallback((field: keyof FormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Clear test and save results when form changes
    setTestResult(null);
    setSaveResult(null);
  }, [errors]);

  const validateForm = (): boolean => {
    const config: FeatBitConfig = {
      serverUrl: formState.serverUrl.trim(),
      apiKey: formState.apiKey.trim(),
      projectId: formState.projectId.trim(),
      environmentId: formState.environmentId.trim()
    };

    const validation: ValidationResult = configurationService.validateConfiguration(config);
    
    if (!validation.isValid) {
      const newErrors: FormErrors = {};
      
      validation.errors.forEach(error => {
        if (error.field in newErrors) {
          newErrors[error.field as keyof FormErrors] += `, ${error.message}`;
        } else {
          newErrors[error.field as keyof FormErrors] = error.message;
        }
      });
      
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, testing: true }));
      setTestResult(null);

      const config: FeatBitConfig = {
        serverUrl: formState.serverUrl.trim(),
        apiKey: formState.apiKey.trim(),
        projectId: formState.projectId.trim(),
        environmentId: formState.environmentId.trim()
      };

      const success = await configurationService.testConnection(config);
      
      setTestResult({
        success,
        message: success 
          ? 'Connection successful! FeatBit server is reachable and credentials are valid.'
          : 'Connection failed. Please check your server URL, API key, and project ID.'
      });

    } catch (error) {
      console.error('Connection test failed:', error);
      setTestResult({
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, testing: false }));
    }
  };

  const handleSaveConfiguration = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoadingStates(prev => ({ ...prev, saving: true }));
      setSaveResult(null);

      const config: FeatBitConfig = {
        serverUrl: formState.serverUrl.trim(),
        apiKey: formState.apiKey.trim(),
        projectId: formState.projectId.trim(),
        environmentId: formState.environmentId.trim()
      };

      await configurationService.saveConfiguration(config);
      
      setSaveResult({
        success: true,
        message: 'Configuration saved successfully!'
      });

    } catch (error) {
      console.error('Failed to save configuration:', error);
      setSaveResult({
        success: false,
        message: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoadingStates(prev => ({ ...prev, saving: false }));
    }
  };

  // Memoized computed values
  const isFormValid = useMemo(() => {
    return formState.serverUrl.trim().length > 0 && 
           formState.apiKey.trim().length > 0 && 
           formState.projectId.trim().length > 0 &&
           formState.environmentId.trim().length > 0;
  }, [formState.serverUrl, formState.apiKey, formState.projectId, formState.environmentId]);

  const isActionsDisabled = useMemo(() => {
    return loadingStates.testing || loadingStates.saving;
  }, [loadingStates.testing, loadingStates.saving]);

  if (loadingStates.loading) {
    return (
      <Card 
        className="flex-grow"
        titleProps={{ text: "FeatBit Configuration" }}
        contentProps={{ 
          contentPadding: true,
          style: { 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: '200px'
          }
        }}
      >
        <Spinner size={SpinnerSize.medium} />
        <div style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
          Loading configuration...
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className="flex-grow"
      titleProps={{ text: "FeatBit Configuration" }}
      contentProps={{ contentPadding: true }}
    >

      {errors.general && (
        <div style={{
          padding: "12px",
          marginBottom: "16px",
          backgroundColor: "#ffeaea",
          border: "1px solid #d13438",
          borderRadius: "4px",
          color: "#d13438",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>{errors.general}</span>
          <Button
            text="×"
            onClick={() => setErrors(prev => ({ ...prev, general: undefined }))}
            subtle={true}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
          Configure your connection to FeatBit to enable feature flag management from Azure DevOps.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600' }}>
            Server URL <span style={{ color: '#d13438' }}>*</span>
          </label>
          <TextField
            value={formState.serverUrl}
            onChange={(_, newValue) => handleInputChange('serverUrl', newValue)}
            placeholder="https://your-featbit-server.com"
            disabled={isActionsDisabled}
          />
          {errors.serverUrl && (
            <div style={{ fontSize: '12px', color: '#d13438', marginTop: '4px' }}>
              {errors.serverUrl}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            The URL of your FeatBit server (e.g., https://featbit.example.com)
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600' }}>
            API Key <span style={{ color: '#d13438' }}>*</span>
          </label>
          <TextField
            value={formState.apiKey}
            onChange={(_, newValue) => handleInputChange('apiKey', newValue)}
            placeholder="Enter your FeatBit API key"
            inputType="password"
            disabled={isActionsDisabled}
          />
          {errors.apiKey && (
            <div style={{ fontSize: '12px', color: '#d13438', marginTop: '4px' }}>
              {errors.apiKey}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            Your FeatBit API key with permissions to manage feature flags
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600' }}>
            Project ID <span style={{ color: '#d13438' }}>*</span>
          </label>
          <TextField
            value={formState.projectId}
            onChange={(_, newValue) => handleInputChange('projectId', newValue)}
            placeholder="Enter your FeatBit project ID"
            disabled={isActionsDisabled}
          />
          {errors.projectId && (
            <div style={{ fontSize: '12px', color: '#d13438', marginTop: '4px' }}>
              {errors.projectId}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            The ID of the FeatBit project where feature flags will be created
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600' }}>
            Environment ID <span style={{ color: '#d13438' }}>*</span>
          </label>
          <TextField
            value={formState.environmentId}
            onChange={(_, newValue) => handleInputChange('environmentId', newValue)}
            placeholder="Enter your FeatBit environment ID"
            disabled={isActionsDisabled}
          />
          {errors.environmentId && (
            <div style={{ fontSize: '12px', color: '#d13438', marginTop: '4px' }}>
              {errors.environmentId}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            The unique ID of the FeatBit environment where feature flags will be managed. You can find this in your FeatBit organization settings.
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginTop: '16px',
          flexWrap: 'wrap'
        }}>
          <Button
            text={loadingStates.testing ? "Testing Connection..." : "Test Connection"}
            primary={false}
            onClick={handleTestConnection}
            disabled={isActionsDisabled || !isFormValid}
            iconProps={loadingStates.testing ? undefined : { iconName: "PlugConnected" }}
          />

          <Button
            text={loadingStates.saving ? "Saving..." : "Save Configuration"}
            primary={true}
            onClick={handleSaveConfiguration}
            disabled={isActionsDisabled || !isFormValid}
            iconProps={loadingStates.saving ? undefined : { iconName: "Save" }}
          />
        </div>

        {testResult && (
          <div style={{
            padding: "12px",
            marginTop: "16px",
            backgroundColor: testResult.success ? "#eaf5ff" : "#ffeaea",
            border: `1px solid ${testResult.success ? "#0078d4" : "#d13438"}`,
            borderRadius: "4px",
            color: testResult.success ? "#0078d4" : "#d13438",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>{testResult.message}</span>
            <Button
              text="×"
              onClick={() => setTestResult(null)}
              subtle={true}
            />
          </div>
        )}

        {saveResult && (
          <div style={{
            padding: "12px",
            marginTop: "16px",
            backgroundColor: saveResult.success ? "#eaf5ff" : "#ffeaea",
            border: `1px solid ${saveResult.success ? "#0078d4" : "#d13438"}`,
            borderRadius: "4px",
            color: saveResult.success ? "#0078d4" : "#d13438",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>{saveResult.message}</span>
            <Button
              text="×"
              onClick={() => setSaveResult(null)}
              subtle={true}
            />
          </div>
        )}
      </div>
    </Card>
  );
});

ConfigurationHub.displayName = 'ConfigurationHub';