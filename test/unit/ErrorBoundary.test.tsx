import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '../../src/components/ErrorBoundary/ErrorBoundary';
import ErrorHandler from '../../src/utils/ErrorHandler';

// Mock the ErrorHandler
jest.mock('../../src/utils/ErrorHandler');
const mockErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>;

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockErrorHandler.logError = jest.fn();
    
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred in the extension/)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should log error when component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(mockErrorHandler.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'platform',
        source: 'extension',
        message: 'Test error',
        code: 'REACT_ERROR_BOUNDARY'
      }),
      'React Error Boundary',
      expect.objectContaining({
        errorId: expect.stringMatching(/^error_\d+_[a-z0-9]+$/),
        componentStack: expect.any(String)
      })
    );
  });

  it('should display error ID', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const errorIdElement = screen.getByText(/Error ID:/);
    expect(errorIdElement).toBeInTheDocument();
    expect(errorIdElement.textContent).toMatch(/Error ID: error_\d+_[a-z0-9]+/);
  });

  it('should call custom onError handler when provided', () => {
    const mockOnError = jest.fn();

    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('should reset error state when retry button is clicked', async () => {
    const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>No error</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    // After clicking retry, re-render with a non-throwing component
    rerender(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    // Wait for the component to re-render properly
    await waitFor(() => {
      expect(screen.getByText('No error')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should generate unique error IDs for different errors', () => {
    const { unmount, rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const firstErrorId = screen.getByText(/Error ID:/).textContent;
    
    unmount();

    // Render a new error boundary with a different error
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const secondErrorId = screen.getByText(/Error ID:/).textContent;
    
    expect(firstErrorId).not.toBe(secondErrorId);
  });

  it('should handle errors without componentStack gracefully', () => {
    // Test the static method directly without spying
    const testError = new Error('Test error without stack');

    const result = ErrorBoundary.getDerivedStateFromError(testError);

    expect(result).toEqual({
      hasError: true,
      error: testError,
      errorId: expect.stringMatching(/^error_\d+_[a-z0-9]+$/)
    });
  });
});