/**
 * AiEnhanceButton — error surfacing.
 *
 * Regression tests for silent-failure fix: the button previously only
 * rendered errors from the non-streaming hook, so a failed streaming
 * enhancement (description field) left the user with no feedback.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiEnhanceButton } from '../src/components/ai/ai-enhance-button';
import type { PropertyMetadata } from '../src/services/ai-service';

const metadata: PropertyMetadata = {
  propertyType: 'APARTMENT',
  rooms: 2,
  bathrooms: 1,
  city: 'Riyadh',
  country: 'SA',
  price: '1500',
  currency: 'SAR',
  priceUnit: 'per_month',
  amenities: ['wifi', 'parking'],
};

const { aiEnhanceMock, aiStreamMock } = vi.hoisted(() => ({
  aiEnhanceMock: {
    status: 'idle',
    enhancedValue: null,
    errorMessage: null,
    enhance: vi.fn(),
    reset: vi.fn(),
    clearError: vi.fn(),
  },
  aiStreamMock: {
    status: 'idle',
    enhancedValue: null,
    errorMessage: null,
    enhance: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('../src/hooks/use-ai-enhance', () => ({
  useAiEnhance: () => aiEnhanceMock,
}));
vi.mock('../src/hooks/use-ai-stream-enhance', () => ({
  useAiStreamEnhance: () => aiStreamMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  aiEnhanceMock.status = 'idle';
  aiEnhanceMock.errorMessage = null;
  aiStreamMock.status = 'idle';
  aiStreamMock.errorMessage = null;
});

describe('AiEnhanceButton', () => {
  it('renders an error message when streaming enhancement fails', () => {
    aiStreamMock.status = 'error';
    aiStreamMock.errorMessage = 'AI generation failed';

    render(
      <AiEnhanceButton
        fieldKey="description"
        currentValue="Some description"
        fieldType="description"
        metadata={metadata}
        onResult={vi.fn()}
        locale="en"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('AI generation failed');
  });

  it('shows the rate-limit message for streaming rate limiting', () => {
    aiStreamMock.status = 'rate_limited';
    aiStreamMock.errorMessage = 'AI limit reached for now';

    render(
      <AiEnhanceButton
        fieldKey="description"
        currentValue="Some description"
        fieldType="description"
        metadata={metadata}
        onResult={vi.fn()}
        locale="en"
      />,
    );

    expect(screen.getByText('AI limit reached for now')).toBeInTheDocument();
  });

  it('does not overwrite the field when streaming fails', async () => {
    aiStreamMock.enhance.mockReturnValue(Promise.reject(new Error('stream failed')));
    aiEnhanceMock.enhance.mockReturnValue(Promise.resolve('generated'));

    const onResult = vi.fn();
    render(
      <AiEnhanceButton
        fieldKey="description"
        currentValue="Original text"
        fieldType="description"
        metadata={metadata}
        onResult={onResult}
        locale="en"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /enhance/i }));
    await waitFor(() => expect(aiStreamMock.enhance).toHaveBeenCalled());
    await waitFor(() => expect(onResult).not.toHaveBeenCalled());
  });

  it('renders no alert in the idle state', () => {
    render(
      <AiEnhanceButton
        fieldKey="description"
        currentValue="Some description"
        fieldType="description"
        metadata={metadata}
        onResult={vi.fn()}
        locale="en"
      />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
