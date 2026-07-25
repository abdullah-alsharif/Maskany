import { describe, expect, it, beforeEach } from 'vitest';
import { PromptTemplateRegistry } from '../../src/services/prompts/registry.js';
import type { PromptTemplate } from '../../src/services/prompts/types.js';

const sampleTemplate: PromptTemplate = {
  id: 'enhance-en-v1',
  kind: 'enhance',
  locale: 'en',
  version: 'v1',
  systemPrompt: 'You are a real estate copywriting assistant.',
  sections: [
    { id: 'metadata', weight: 10, required: true, localeContent: { en: 'Metadata block' } },
    {
      id: 'field-guidelines',
      weight: 8,
      required: false,
      localeContent: { en: 'Field guidelines' },
    },
  ],
  createdAt: '2026-07-25T00:00:00Z',
};

let registry: PromptTemplateRegistry;

beforeEach(() => {
  registry = new PromptTemplateRegistry({ localeFallback: false });
});

describe('PromptTemplateRegistry', () => {
  it('[T004] render() returns system and user prompt strings for a valid template', () => {
    registry.register(sampleTemplate);
    const result = registry.render('enhance', 'en', { locale: 'en' });
    expect(result.system).toBe('You are a real estate copywriting assistant.');
    expect(result.user).toBeTruthy();
  });

  it('[T004] render() includes all required sections in the output', () => {
    registry.register(sampleTemplate);
    const result = registry.render('enhance', 'en', { locale: 'en' });
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
  });

  it('[T004] render() supports explicit version lookup', () => {
    registry.register(sampleTemplate);
    const result = registry.render('enhance', 'en', { locale: 'en' }, { version: 'v1' });
    expect(result.templateVersion).toBe('v1');
  });

  it('[T004] render() throws for unknown template kind', () => {
    registry.register(sampleTemplate);
    expect(() => registry.render('unknown', 'en', { locale: 'en' })).toThrow();
  });

  it('[T004] getVersion() returns the correct template version', () => {
    registry.register(sampleTemplate);
    const tmpl = registry.getVersion('enhance', 'en', 'v1');
    expect(tmpl.version).toBe('v1');
  });

  it('[T004] getVersion() throws for unknown version', () => {
    registry.register(sampleTemplate);
    expect(() => registry.getVersion('enhance', 'en', 'v99')).toThrow();
  });

  it('[T004] listVersions() returns all registered versions', () => {
    registry.register(sampleTemplate);
    const versions = registry.listVersions();
    expect(versions).toContain('enhance-en-v1');
  });

  it('[T004] register() throws on duplicate template ID', () => {
    registry.register(sampleTemplate);
    expect(() => registry.register(sampleTemplate)).toThrow();
  });
});
