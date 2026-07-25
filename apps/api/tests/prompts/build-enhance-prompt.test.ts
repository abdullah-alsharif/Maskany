import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildEnhancePrompt, resetRegistryForTest } from '../../src/services/ai-prompt-builder.js';
import type { EnhanceRequest } from '../../src/validators/ai-validators.js';

const sampleRequest: EnhanceRequest = {
  locale: 'en',
  fieldType: 'description',
  action: 'enhance',
  currentValue: 'Nice apartment in Dubai.',
  metadata: {
    propertyType: 'APARTMENT',
    rooms: 2,
    bathrooms: 1,
    city: 'Dubai',
    country: 'UAE',
    price: '500000',
    currency: 'AED',
    priceUnit: 'per_year',
    amenities: ['pool', 'gym'],
  },
};

beforeEach(() => {
  resetRegistryForTest();
});

afterEach(() => {
  resetRegistryForTest();
});

describe('buildEnhancePrompt via registry', () => {
  it('[T011] delegates to PromptTemplateRegistry.render() with correct kind and locale', () => {
    const result = buildEnhancePrompt(sampleRequest, 'en');
    expect(result.system).toBeTruthy();
    expect(typeof result.system).toBe('string');
    expect(result.system).toContain('real estate copywriting assistant');
  });

  it('[T011] renders a valid BuiltPrompt with system and user strings', () => {
    const result = buildEnhancePrompt(sampleRequest, 'en');
    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(result.system.length).toBeGreaterThan(0);
    expect(result.user.length).toBeGreaterThan(0);
  });

  it('[T011] includes metadata, field guideline, action instruction, and guard rules in the output', () => {
    const result = buildEnhancePrompt(sampleRequest, 'en');
    expect(result.user).toContain('PROPERTY METADATA');
    expect(result.user).toContain('Field:');
    expect(result.user).toContain('Action:');
    expect(result.user).toContain('RULES');
    expect(result.user).toContain('CONTENT TO PROCESS');
  });

  it('[T011] renders Arabic locale correctly', () => {
    const result = buildEnhancePrompt(sampleRequest, 'ar');
    expect(result.user).toContain('بيانات العقار');
    expect(result.user).toContain('الحقل:');
    expect(result.user).toContain('الإجراء:');
    expect(result.user).toContain('القواعد');
    expect(result.user).toContain('المحتوى المراد معالجته');
  });
});
