import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient } from '@/services/api';
import {
  toPropertyPayload,
  createProperty,
  updateProperty,
  savePropertyTranslation,
  uploadPropertyImages,
} from '@/services/property-service';
import type { PropertyFormValues } from '@/components/property-form';
import type { Property, PropertyMedia } from '@/types/property';

type CapturedRequest = {
  url?: string;
  method?: string;
  data?: unknown;
  headers?: Record<string, unknown>;
};

function installAdapter(
  respond: (req: CapturedRequest) => Partial<AxiosResponse>,
): { captured: CapturedRequest[] } {
  const captured: CapturedRequest[] = [];
  const adapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
    const req: CapturedRequest = {
      url: config.url,
      method: config.method,
      data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      headers: config.headers as Record<string, unknown>,
    };
    captured.push(req);
    const partial = respond(req);
    const response = {
      data: partial.data ?? {},
      status: partial.status ?? 200,
      statusText: partial.statusText ?? 'OK',
      headers: partial.headers ?? {},
      config,
    } as AxiosResponse;
    const validate = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
    if (validate(response.status)) {
      return response;
    }
    throw new Error(`Request failed with status code ${response.status}`);
  };
  apiClient.defaults.adapter = adapter;
  return { captured };
}

let savedAdapter: AxiosAdapter | undefined;

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
});

const baseValues: PropertyFormValues = {
  title: ' My Apt ',
  summary: ' Nice place ',
  description: ' Spacious ',
  propertyType: 'APARTMENT',
  city: ' Riyadh ',
  area: ' Olaya ',
  country: ' SA ',
  price: '1500',
  currency: ' SAR ',
  priceUnit: 'per_month',
  rooms: 2,
  bathrooms: 1,
  areaSqm: ' 70 ',
  amenities: ['wifi', 'parking'],
  whatsappNumber: ' 966500000000 ',
};

describe('toPropertyPayload', () => {
  it('trims whitespace from all string fields', () => {
    const payload = toPropertyPayload(baseValues);
    expect(payload.title).toBe('My Apt');
    expect(payload.city).toBe('Riyadh');
    expect(payload.summary).toBe('Nice place');
    expect(payload.whatsappNumber).toBe('966500000000');
  });

  it('omits optional string fields when empty after trim', () => {
    const values = {
      ...baseValues,
      summary: '  ',
      description: '  ',
      area: '  ',
      country: '  ',
      currency: '  ',
      areaSqm: '  ',
    };
    const payload = toPropertyPayload(values);
    expect(payload.summary).toBeUndefined();
    expect(payload.description).toBeUndefined();
    expect(payload.area).toBeUndefined();
    expect(payload.country).toBeUndefined();
    expect(payload.currency).toBeUndefined();
    expect(payload.areaSqm).toBeUndefined();
  });

  it('sets locale to ar when i18n language is Arabic', async () => {
    const i18n = await import('i18next');
    await i18n.default.changeLanguage('ar');
    const payload = toPropertyPayload(baseValues);
    expect(payload.locale).toBe('ar');
    await i18n.default.changeLanguage('en');
  });

  it('sets locale to en when i18n language is English', () => {
    const payload = toPropertyPayload(baseValues);
    expect(payload.locale).toBe('en');
  });

  it('includes amenities only when array is non-empty', () => {
    const withAmenities = toPropertyPayload(baseValues);
    expect(withAmenities.amenities).toEqual(['wifi', 'parking']);
    const without = toPropertyPayload({ ...baseValues, amenities: [] });
    expect(without.amenities).toBeUndefined();
  });

  it('preserves numeric fields as numbers', () => {
    const payload = toPropertyPayload(baseValues);
    expect(payload.rooms).toBe(2);
    expect(payload.bathrooms).toBe(1);
  });

  it('includes price and priceUnit unchanged', () => {
    const payload = toPropertyPayload(baseValues);
    expect(payload.price).toBe('1500');
    expect(payload.priceUnit).toBe('per_month');
  });
});

describe('createProperty', () => {
  it('POSTs to /properties with the shaped payload and returns the Property', async () => {
    const property: Property = {
      id: 'p1',
      title: 'My Apt',
      summary: 'Nice place',
      description: 'Spacious',
      propertyType: 'APARTMENT',
      city: 'Riyadh',
      area: 'Olaya',
      country: 'SA',
      price: 1500,
      currency: 'SAR',
      priceUnit: 'per_month',
      rooms: 2,
      bathrooms: 1,
      areaSqm: 70,
      amenities: ['wifi', 'parking'],
      coverImage: null,
      whatsappNumber: '966500000000',
      ownerId: 'owner-1',
      status: 'ACTIVE',
      averageRating: 0,
      reviewCount: 0,
      locale: 'en',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const { captured } = installAdapter(() => ({ status: 201, data: property }));
    const result = await createProperty(baseValues);
    expect(captured).toHaveLength(1);
    expect(captured[0].method?.toLowerCase()).toBe('post');
    expect(captured[0].url).toBe('/properties');
    expect(result).toEqual(property);
  });

  it('propagates 4xx errors', async () => {
    installAdapter(() => ({
      status: 400,
      data: { message: 'Validation failed' },
      statusText: 'Bad Request',
    }));
    await expect(createProperty(baseValues)).rejects.toThrow();
  });

  it('propagates 5xx errors', async () => {
    installAdapter(() => ({ status: 500, statusText: 'Internal Server Error' }));
    await expect(createProperty(baseValues)).rejects.toThrow();
  });
});

describe('updateProperty', () => {
  it('PUTs to /properties/:id with the shaped payload and returns the Property', async () => {
    const property: Property = {
      id: 'p1',
      title: 'My Apt',
      summary: 'Nice place',
      description: 'Spacious',
      propertyType: 'APARTMENT',
      city: 'Riyadh',
      area: 'Olaya',
      country: 'SA',
      price: 1500,
      currency: 'SAR',
      priceUnit: 'per_month',
      rooms: 2,
      bathrooms: 1,
      areaSqm: 70,
      amenities: ['wifi', 'parking'],
      coverImage: null,
      whatsappNumber: '966500000000',
      ownerId: 'owner-1',
      status: 'ACTIVE',
      averageRating: 0,
      reviewCount: 0,
      locale: 'en',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const { captured } = installAdapter(() => ({ data: property }));
    const result = await updateProperty('p1', baseValues);
    expect(captured[0].method?.toLowerCase()).toBe('put');
    expect(captured[0].url).toBe('/properties/p1');
    expect(result).toEqual(property);
  });
});

describe('uploadPropertyImages', () => {
  it('returns [] without HTTP call when files is empty', async () => {
    const result = await uploadPropertyImages('p1', []);
    expect(result).toEqual([]);
  });

  it('POSTs multipart/form-data for a single file', async () => {
    const file = new File(['content'], 'img.jpg', { type: 'image/jpeg' });
    const media: PropertyMedia = {
      id: 'm1',
      mediaType: 'IMAGE',
      url: 'https://example.com/img.jpg',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      altText: 'Photo',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      width: 800,
      height: 600,
      duration: null,
      sortOrder: 0,
    };
    const { captured } = installAdapter(() => ({ data: { media: [media] } }));
    const result = await uploadPropertyImages('p1', [file]);
    expect(captured[0].url).toBe('/properties/p1/media');
    expect(captured[0].method?.toLowerCase()).toBe('post');
    expect(captured[0].headers?.['Content-Type']).toContain('multipart/form-data');
    expect(result).toEqual([media]);
  });

  it('sends multiple files in the same request', async () => {
    const file1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const file2 = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
    const media: PropertyMedia[] = [
      {
        id: 'm1',
        mediaType: 'IMAGE',
        url: 'https://example.com/a.jpg',
        thumbnailUrl: 'https://example.com/a_thumb.jpg',
        altText: 'A',
        mimeType: 'image/jpeg',
        fileSize: 100,
        width: 100,
        height: 100,
        duration: null,
        sortOrder: 0,
      },
      {
        id: 'm2',
        mediaType: 'IMAGE',
        url: 'https://example.com/b.jpg',
        thumbnailUrl: 'https://example.com/b_thumb.jpg',
        altText: 'B',
        mimeType: 'image/jpeg',
        fileSize: 200,
        width: 200,
        height: 200,
        duration: null,
        sortOrder: 1,
      },
    ];
    const { captured } = installAdapter(() => ({ data: { media } }));
    const result = await uploadPropertyImages('p1', [file1, file2]);
    expect(captured).toHaveLength(1);
    expect(result).toHaveLength(2);
  });
});

describe('savePropertyTranslation', () => {
  it('PUTs to /properties/:id/translations/:locale with translation data', async () => {
    const { captured } = installAdapter(() => ({}));
    await savePropertyTranslation('p1', 'en', {
      title: 'Title',
      city: 'Riyadh',
      country: 'SA',
    });
    expect(captured[0].method?.toLowerCase()).toBe('put');
    expect(captured[0].url).toBe('/properties/p1/translations/en');
    expect(captured[0].data).toEqual({ title: 'Title', city: 'Riyadh', country: 'SA' });
  });
});
