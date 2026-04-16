/**
 * T-026 — Register page unit tests.
 */
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

describe('RegisterPage', () => {
  it('renders the registration form with name, phone, email, and user type inputs', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /browser/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /owner/i })).toBeInTheDocument();
  });

  it('submits the registration payload and navigates to /verify-otp', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Amal Example' } });
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '500000000' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'amal@example.com' } });
    fireEvent.click(screen.getByRole('radio', { name: /owner/i }));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(getPushedPaths()).toContain('/verify-otp'));
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('/auth/register');
    const body = JSON.parse(captured[0].data as string) as {
      fullName: string;
      phone: string;
      email?: string;
      userType: string;
    };
    expect(body).toEqual({
      fullName: 'Amal Example',
      phone: '+966500000000',
      email: 'amal@example.com',
      userType: 'OWNER',
    });
  });

  it('omits the email field from the payload when left blank', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Amal Example' } });
    fireEvent.change(screen.getByLabelText(/country code/i), { target: { value: '+966' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '500000000' } });
    fireEvent.click(screen.getByRole('radio', { name: /browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    const body = JSON.parse(captured[0].data as string) as Record<string, unknown>;
    expect(body.email).toBeUndefined();
    expect(body.userType).toBe('BROWSER');
  });

  it('defaults the user type to Browser', () => {
    renderPage();
    const browser = screen.getByRole('radio', { name: /browser/i }) as HTMLInputElement;
    expect(browser.checked).toBe(true);
  });

  it('shows a validation error and does not submit when the full name is empty', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '500000000' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/name/i);
    expect(captured).toHaveLength(0);
  });
});
