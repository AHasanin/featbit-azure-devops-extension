import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorDisplay } from '../../src/components/ErrorDisplay/ErrorDisplay';
import { UserFriendlyMessage } from '../../src/utils/ErrorHandler';

describe('ErrorDisplay', () => {
  const mockRetryableError: UserFriendlyMessage = {
    title: 'Connection Timeout',
    message: 'The request to FeatBit timed out.',
    actionable: 'Try again in a few moments.',
    retryable: true
  };

  const mockNonRetryableError: UserFriendlyMessage = {
    title: 'Authentication Failed',
    message: 'The API key is invalid.',
    actionable: 'Check your API key in settings.',
    retryable: false
  };

  it('should render error with all information', () => {
    render(<ErrorDisplay error={mockRetryableError} />);

    expect(screen.getByText('Connection Timeout')).toBeInTheDocument();
    expect(screen.getByText('The request to FeatBit timed out.')).toBeInTheDocument();
    expect(screen.getByText('Try again in a few moments.')).toBeInTheDocument();
  });

  it('should show warning icon for retryable errors', () => {
    render(<ErrorDisplay error={mockRetryableError} />);

    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('should show error icon for non-retryable errors', () => {
    render(<ErrorDisplay error={mockNonRetryableError} />);

    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('should render retry button for retryable errors when onRetry is provided', () => {
    const mockOnRetry = jest.fn();

    render(
      <ErrorDisplay 
        error={mockRetryableError} 
        onRetry={mockOnRetry}
      />
    );

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('should not render retry button for non-retryable errors', () => {
    const mockOnRetry = jest.fn();

    render(
      <ErrorDisplay 
        error={mockNonRetryableError} 
        onRetry={mockOnRetry}
      />
    );

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should not render retry button when onRetry is not provided', () => {
    render(<ErrorDisplay error={mockRetryableError} />);

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should render dismiss button when onDismiss is provided', () => {
    const mockOnDismiss = jest.fn();

    render(
      <ErrorDisplay 
        error={mockRetryableError} 
        onDismiss={mockOnDismiss}
      />
    );

    const dismissButton = screen.getByLabelText('Dismiss error');
    expect(dismissButton).toBeInTheDocument();
    expect(dismissButton.textContent).toBe('×');

    fireEvent.click(dismissButton);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('should not render dismiss button when onDismiss is not provided', () => {
    render(<ErrorDisplay error={mockRetryableError} />);

    expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ErrorDisplay 
        error={mockRetryableError} 
        className="custom-error-class"
      />
    );

    expect(container.firstChild).toHaveClass('error-display', 'custom-error-class');
  });

  it('should render without actionable text when not provided', () => {
    const errorWithoutActionable: UserFriendlyMessage = {
      title: 'Simple Error',
      message: 'Something went wrong.',
      retryable: false
    };

    render(<ErrorDisplay error={errorWithoutActionable} />);

    expect(screen.getByText('Simple Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.queryByText(/actionable/)).not.toBeInTheDocument();
  });

  it('should handle empty error messages gracefully', () => {
    const emptyError: UserFriendlyMessage = {
      title: '',
      message: '',
      retryable: false
    };

    render(<ErrorDisplay error={emptyError} />);

    // Should still render the structure even with empty content
    expect(screen.queryByLabelText('Dismiss error')).not.toBeInTheDocument();
  });

  it('should render both retry and dismiss buttons when both handlers are provided', () => {
    const mockOnRetry = jest.fn();
    const mockOnDismiss = jest.fn();

    render(
      <ErrorDisplay 
        error={mockRetryableError} 
        onRetry={mockOnRetry}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss error')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    const mockOnDismiss = jest.fn();

    render(
      <ErrorDisplay 
        error={mockRetryableError} 
        onDismiss={mockOnDismiss}
      />
    );

    const dismissButton = screen.getByLabelText('Dismiss error');
    expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss error');
  });

  it('should handle long error messages properly', () => {
    const longError: UserFriendlyMessage = {
      title: 'Very Long Error Title That Might Wrap',
      message: 'This is a very long error message that contains a lot of text and might wrap to multiple lines in the UI. It should still be displayed properly without breaking the layout.',
      actionable: 'This is also a very long actionable message that provides detailed instructions on how to resolve the error condition.',
      retryable: true
    };

    render(<ErrorDisplay error={longError} />);

    expect(screen.getByText(longError.title)).toBeInTheDocument();
    expect(screen.getByText(longError.message)).toBeInTheDocument();
    expect(screen.getByText(longError.actionable!)).toBeInTheDocument();
  });
});