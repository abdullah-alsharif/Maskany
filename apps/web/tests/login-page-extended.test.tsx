import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { LoginPage } from '../src/views/login-page';
import { AuthProvider } from '../src/context/auth-context';
import { apiClient } from '../src/services/api';
import { getPushedPaths, resetRouter } from './mocks/next-navigation';

let savedAdapter: AxiosAdapter | undefined;
let captured: AxiosRequestConfig[] = [];

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  captured = [];
  apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
    captured.push(config);
    return {
      data: { message: 'OTP sent.', type: 'sms' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  }) as AxiosAdapter;
  localStorage.clear();
  resetRouter();
  sessionStorage.clear();
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
  localStorage.clear();
  resetRouter();
  sessionStorage.clear();
});

function renderPage() {
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
}

describe('LoginPage — edge cases (T-052)', () => {
  it('handles phone number that already starts with +', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+966500000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    const body = JSON.parse(captured[0].data as string) as { identifier: string };
    expect(body.identifier).toBe('+966500000000');
  });

  it('shows error when email is empty in email mode', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /use email/i }));
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/email/i);
    expect(captured).toHaveLength(0);
  });

  it('shows error when email lacks @ symbol', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /use email/i }));
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'notanemail' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/email/i);
    expect(captured).toHaveLength(0);
  });

  it('shows API error message when the request fails', async () => {
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      captured.push(config);
      return Promise.reject(new Error('API error'));
    }) as AxiosAdapter;

    renderPage();
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '500000000' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error when phone number contains only non-digit characters', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/phone/i);
    expect(captured).toHaveLength(0);
  });

  it('toggles mode buttons with correct aria-pressed state', () => {
    renderPage();
    const phoneBtn = screen.getByRole('button', { name: /use phone/i });
    const emailBtn = screen.getByRole('button', { name: /use email/i });

    expect(phoneBtn.getAttribute('aria-pressed')).toBe('true');
    expect(emailBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(emailBtn);
    expect(phoneBtn.getAttribute('aria-pressed')).toBe('false');
    expect(emailBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('strips country code digits when phone starts with them', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '966500000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    const body = JSON.parse(captured[0].data as string) as { identifier: string };
    expect(body.identifier).toBe('+966500000000');
  });

  it('disables the submit button while submitting', async () => {
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      captured.push(config);
      await new Promise((r) => setTimeout(r, 500));
      return {
        data: { message: 'OTP sent.', type: 'sms' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }) as AxiosAdapter;

    renderPage();
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '500000000' } });
    const submitBtn = screen.getByRole('button', { name: /send code/i });
    fireEvent.click(submitBtn);

    expect(submitBtn).toBeDisabled();
  });
});
