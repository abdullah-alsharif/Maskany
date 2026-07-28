import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTranslationContent } from '../src/hooks/useTranslationContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));

describe('useTranslationContent', () => {
  it('returns needsTranslation=false when user locale matches item locale', () => {
    const item = { locale: 'en', title: 'Apt' };
    const result = renderHook(() => useTranslationContent(item));
    expect(result.result.current.needsTranslation).toBe(false);
  });

  it('returns needsTranslation=true when locale differs and translation exists', () => {
    const item = {
      locale: 'ar',
      translation: { title: 'شقة', description: 'وصف' },
    };
    const result = renderHook(() => useTranslationContent(item));
    expect(result.result.current.needsTranslation).toBe(true);
    expect(result.result.current.title).toBe('شقة');
  });

  it('returns needsTranslation=false when locale differs but no translation', () => {
    const item = { locale: 'ar' };
    const result = renderHook(() => useTranslationContent(item));
    expect(result.result.current.needsTranslation).toBe(false);
  });
});
