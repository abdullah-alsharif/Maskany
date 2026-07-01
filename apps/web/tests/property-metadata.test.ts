import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

describe('Property page metadata (T-049)', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.API_BASE_URL;
  });

  it('generateMetadata returns fallback title on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { generateMetadata } = await import('../src/app/properties/[id]/page');
    const result = await generateMetadata({ params: Promise.resolve({ id: 'nonexistent' }) });
    expect(result).toEqual({ title: 'Property | Maskany' });
  });

  it('generateMetadata returns fallback title when API returns non-ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    const { generateMetadata } = await import('../src/app/properties/[id]/page');
    const result = await generateMetadata({ params: Promise.resolve({ id: 'prop-1' }) });
    expect(result).toEqual({ title: 'Property | Maskany' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/properties/prop-1'),
    );
  });

  it('generateMetadata builds OpenGraph metadata from API response', async () => {
    const property = {
      title: 'Sunlit Apartment',
      summary: 'Bright apartment close to the coast',
      images: [{ url: 'https://cdn.example.com/photo.webp' }],
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(property),
    });

    const { generateMetadata } = await import('../src/app/properties/[id]/page');
    const result = await generateMetadata({ params: Promise.resolve({ id: 'prop-1' }) });

    expect(result).toEqual({
      title: 'Sunlit Apartment | Maskany',
      description: 'Bright apartment close to the coast',
      openGraph: {
        title: 'Sunlit Apartment | Maskany',
        description: 'Bright apartment close to the coast',
        images: [{ url: 'https://cdn.example.com/photo.webp' }],
        type: 'article',
      },
    });
  });

  it('generateMetadata handles missing images gracefully', async () => {
    const property = {
      title: 'No Image Property',
      summary: 'A property without images',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(property),
    });

    const { generateMetadata } = await import('../src/app/properties/[id]/page');
    const result = await generateMetadata({ params: Promise.resolve({ id: 'no-img' }) });

    expect(result).toEqual({
      title: 'No Image Property | Maskany',
      description: 'A property without images',
      openGraph: {
        title: 'No Image Property | Maskany',
        description: 'A property without images',
        images: [],
        type: 'article',
      },
    });
  });

  it('generateMetadata uses API_BASE_URL env var when set', async () => {
    process.env.API_BASE_URL = 'https://api.example.com';
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const { generateMetadata } = await import('../src/app/properties/[id]/page');
    await generateMetadata({ params: Promise.resolve({ id: 'prop-1' }) });

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/api/properties/prop-1');
  });
});
