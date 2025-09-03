import React from 'react';
import { render, screen } from '@testing-library/react';
import { CreateFeatureFlagDialog } from '../../src/components/CreateFeatureFlagDialog/CreateFeatureFlagDialog';
import { FeatBitService } from '../../src/services/FeatBitService';
import { WorkItemService } from '../../src/services/WorkItemService';
import { WorkItem } from '../../src/types';

// Mock the services
jest.mock('../../src/services/FeatBitService');
jest.mock('../../src/services/WorkItemService');

const MockedFeatBitService = FeatBitService as jest.MockedClass<typeof FeatBitService>;
const MockedWorkItemService = WorkItemService as jest.MockedClass<typeof WorkItemService>;

describe('CreateFeatureFlagDialog', () => {
  let mockFeatBitService: jest.Mocked<FeatBitService>;
  let mockWorkItemService: jest.Mocked<WorkItemService>;
  let mockOnClose: jest.Mock;
  let mockOnSuccess: jest.Mock;

  const mockWorkItem: WorkItem = {
    id: 123,
    title: 'Implement user authentication',
    workItemType: 'User Story',
    state: 'Active',
    assignedTo: 'test@example.com',
    fields: {
      projectId: 'test-project'
    }
  };

  beforeEach(() => {
    mockFeatBitService = new MockedFeatBitService() as jest.Mocked<FeatBitService>;
    mockWorkItemService = new MockedWorkItemService() as jest.Mocked<WorkItemService>;
    mockOnClose = jest.fn();
    mockOnSuccess = jest.fn();

    // Setup default mock implementations
    mockWorkItemService.getCurrentWorkItem.mockResolvedValue(mockWorkItem);
    mockFeatBitService.getFeatureFlags.mockResolvedValue([]);
    mockWorkItemService.linkFeatureFlag.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(
      <CreateFeatureFlagDialog
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        featBitService={mockFeatBitService}
        workItemService={mockWorkItemService}
      />
    );

    expect(screen.queryByText('Create Feature Flag')).not.toBeInTheDocument();
  });

  it('should render dialog when isOpen is true', () => {
    render(
      <CreateFeatureFlagDialog
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        featBitService={mockFeatBitService}
        workItemService={mockWorkItemService}
        workItem={mockWorkItem}
      />
    );

    expect(screen.getByRole('heading', { name: 'Create Feature Flag' })).toBeInTheDocument();
    expect(screen.getByLabelText('Feature Flag Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable feature flag immediately')).toBeInTheDocument();
  });
});