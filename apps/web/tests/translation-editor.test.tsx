/**
 * TranslationEditor — AI translation error surfacing.
 *
 * Regression tests for silent-failure fix: the "Generate with AI" button
 * previously failed without any user feedback when the /ai/translate-all
 * request errored (e.g. provider outage or rate limit).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TranslationEditor } from '../src/components/translation-editor';
import type { PropertyMetadata } from '../src/services/ai-service';

vi.mock('../src/services/ai-service', () => ({
  translateAllFields: vi.fn(),
}));

import { translateAllFields } from '../src/services/ai-service';

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const mockedTranslateAll = vi.mocked(translateAllFields);

function renderEditor() {
  return render(
    <QueryClientProvider client={queryClient}>
      <TranslationEditor
        mode="create"
        open={true}
        onToggle={vi.fn()}
        value={{ title: '', summary: '', description: '', city: '', area: '', country: '' }}
        onChange={vi.fn()}
        targetLangLabel="Arabic"
        metadata={metadata}
        locale="en"
        sourceFields={{
          title: 'Sunlit Loft',
          summary: 'A bright apartment',
          description: 'A sun-drenched loft in the old quarter.',
          city: 'Riyadh',
          area: 'Olaya',
          country: 'SA',
        }}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedTranslateAll.mockReset();
});

describe('TranslationEditor AI generation', () => {
  it('shows an error message when translation generation fails', async () => {
    mockedTranslateAll.mockRejectedValue(new Error('provider outage'));
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /generate with ai/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('AI generation failed');
    expect(alert).toHaveTextContent('Your text is unchanged — try again.');
  });

  it('shows the rate-limit message on 429 responses', async () => {
    mockedTranslateAll.mockRejectedValue({ response: { status: 429 } });
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /generate with ai/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('AI limit reached for now');
    expect(alert).toHaveTextContent('The AI limit resets shortly — try again in a minute.');
  });

  it('renders no alert when generation succeeds', async () => {
    mockedTranslateAll.mockResolvedValue({
      translation: {
        title: 'عنوان',
        summary: 'ملخص',
        description: 'وصف',
        city: 'الرياض',
        area: 'العليا',
        country: 'السعودية',
      },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /generate with ai/i }));

    await waitFor(() => expect(mockedTranslateAll).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
