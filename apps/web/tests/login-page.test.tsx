/**
 * T-026 — Login page unit tests.
 */
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

describe('LoginPage', () => {
  it('renders the login heading and phone input by default', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });

  it('renders a country code selector with at least SA, AE, EG, JO, US options', () => {
    renderPage();
    const select = screen.getByLabelText(/country code/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['+966', '+971', '+20', '+962', '+1']));
  });

  it('toggles to email mode and hides the phone input', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /use email/i }));
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
  });

  it('submits phone identifier in E.164 format and navigates to /verify-otp', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '500000000' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(getPushedPaths()).toContain('/verify-otp'));
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('/auth/login');
    const body = JSON.parse(captured[0].data as string) as { identifier: string };
    expect(body.identifier).toBe('+966500000000');
  });

  it('submits the email identifier when in email mode', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /use email/i }));
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'amal@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    await waitFor(() => expect(getPushedPaths()).toContain('/verify-otp'));
    const body = JSON.parse(captured[0].data as string) as { identifier: string };
    expect(body.identifier).toBe('amal@example.com');
  });

  it('shows an error and does not call the API when the phone number is empty', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/phone/i);
    expect(captured).toHaveLength(0);
  });

  it('links to the register page for users without an account', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /create account/i });
    expect(link.getAttribute('href')).toBe('/register');
  });
});
