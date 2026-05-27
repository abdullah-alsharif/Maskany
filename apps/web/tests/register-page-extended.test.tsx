import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { RegisterPage } from '../src/views/register-page';
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
      data: { message: 'Registration started.', userId: 'user-1' },
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    } as AxiosResponse;
  }) as AxiosAdapter;
  localStorage.clear();
  sessionStorage.clear();
  resetRouter();
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
  localStorage.clear();
  sessionStorage.clear();
  resetRouter();
});

function renderPage() {
  return render(
    <AuthProvider>
      <RegisterPage />
    </AuthProvider>,
  );
}

describe('RegisterPage — edge cases (T-053)', () => {
  it('shows error when phone is empty', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Amal' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/phone/i);
    expect(captured).toHaveLength(0);
  });

  it('shows error when phone contains only non-digit characters', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Amal' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/phone/i);
    expect(captured).toHaveLength(0);
  });

  it('handles phone starting with + prefix', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Amal' } });
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '+966500000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    const body = JSON.parse(captured[0].data as string) as { phone: string };
    expect(body.phone).toBe('+966500000000');
  });

  it('strips country code digits when phone starts with them', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Amal' } });
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '966500000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    const body = JSON.parse(captured[0].data as string) as { phone: string };
    expect(body.phone).toBe('+966500000000');
  });

  it('shows API error message when the request fails', async () => {
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      captured.push(config);
      return Promise.reject(new Error('API error'));
    }) as AxiosAdapter;

    renderPage();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Amal' } });
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '500000000' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('disables submit button while submitting', async () => {
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      captured.push(config);
      await new Promise((r) => setTimeout(r, 500));
      return {
        data: { message: 'Registration started.', userId: 'user-1' },
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      } as AxiosResponse;
    }) as AxiosAdapter;

    renderPage();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Amal' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '500000000' } });
    const submitBtn = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitBtn);

    expect(submitBtn).toBeDisabled();
  });

  it('renders account type options with default Browser selected', () => {
    renderPage();
    const browserRadio = screen.getByRole('radio', { name: /browser/i }) as HTMLInputElement;
    expect(browserRadio.checked).toBe(true);
  });

  it('links to the login page for existing users', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link.getAttribute('href')).toBe('/login');
  });
});
