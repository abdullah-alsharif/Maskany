import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { LanguageSwitcher } from '../src/components/language-switcher';
import enTranslation from '../src/i18n/en.json';
import arTranslation from '../src/i18n/ar.json';

function renderSwitcher() {
  return render(
    <I18nextProvider i18n={i18n}>
      <LanguageSwitcher />
    </I18nextProvider>,
  );
}

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    document.documentElement.lang = 'en';
    document.documentElement.removeAttribute('dir');
  });

  it('renders a button', () => {
    renderSwitcher();
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('shows Arabic option when current language is English', () => {
    renderSwitcher();
    expect(screen.getByTestId('language-switcher')).toHaveTextContent('العربية');
  });

  it('shows English option when current language is Arabic', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    renderSwitcher();
    expect(screen.getByTestId('language-switcher')).toHaveTextContent('English');
  });

  it('toggles from English to Arabic on click', async () => {
    renderSwitcher();
    const button = screen.getByTestId('language-switcher');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(i18n.language).toBe('ar');
  });

  it('toggles from Arabic to English on click', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    renderSwitcher();
    const button = screen.getByTestId('language-switcher');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(i18n.language).toBe('en');
  });
});

describe('RTL direction', () => {
  it('sets dir=rtl on html element when Arabic is selected', async () => {
    const { DirectionSync } = await import('../src/app/providers');
    render(
      <I18nextProvider i18n={i18n}>
        <DirectionSync />
      </I18nextProvider>,
    );

    await act(async () => {
      await i18n.changeLanguage('ar');
    });

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('sets dir=ltr on html element when English is selected', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { DirectionSync } = await import('../src/app/providers');
    render(
      <I18nextProvider i18n={i18n}>
        <DirectionSync />
      </I18nextProvider>,
    );

    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('Translation key coverage', () => {
  function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k;
      return typeof v === 'object' && v !== null
        ? flatKeys(v as Record<string, unknown>, key)
        : [key];
    });
  }

  it('all English keys exist in Arabic locale', () => {
    const enKeys = flatKeys(enTranslation as unknown as Record<string, unknown>);
    const arKeys = new Set(flatKeys(arTranslation as unknown as Record<string, unknown>));
    const missing = enKeys.filter((k) => !arKeys.has(k));
    expect(missing, `Missing Arabic keys: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('all Arabic keys exist in English locale', () => {
    const arKeys = flatKeys(arTranslation as unknown as Record<string, unknown>);
    const enKeys = new Set(flatKeys(enTranslation as unknown as Record<string, unknown>));
    const missing = arKeys.filter((k) => !enKeys.has(k));
    expect(missing, `Missing English keys: ${missing.join(', ')}`).toHaveLength(0);
  });
});
