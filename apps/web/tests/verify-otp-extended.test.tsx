import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { VerifyOtpPage } from '../src/views/verify-otp-page';
import { AuthProvider } from '../src/context/auth-context';
import { apiClient } from '../src/services/api';
import { tokenStorage } from '../src/services/token-storage';
import { getReplacedPaths, resetRouter } from './mocks/next-navigation';

let savedAdapter: AxiosAdapter | undefined;
let captured: AxiosRequestConfig[] = [];
const defaultResponse = {
  accessToken: 'access-xyz',
  user: {
    id: 'user-1',
    fullName: 'Amal Example',
    phone: '+966500000000',
    email: null,
    userType: 'BROWSER',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
};

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  captured = [];
  apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
    captured.push(config);
    return {
      data: defaultResponse,
      status: 200,
      statusText: 'OK',
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

function renderPage(state?: { identifier?: string; channel?: 'sms' | 'email' } | null) {
  if (state) {
    sessionStorage.setItem('otp_state', JSON.stringify(state));
  }
  return render(
    <AuthProvider>
      <VerifyOtpPage />
    </AuthProvider>,
  );
}

describe('VerifyOtpPage — edge cases (T-051)', () => {
  it('shows email-sent message when channel is email', () => {
    renderPage({ identifier: 'amal@example.com', channel: 'email' });
    expect(screen.getByText(/by email/i)).toBeInTheDocument();
  });

  it('shows sms-sent message when channel is sms', () => {
    renderPage({ identifier: '+966500000000', channel: 'sms' });
    expect(screen.getByText(/by SMS/i)).toBeInTheDocument();
  });

  it('shows expired message and disables OTP inputs after countdown expires', () => {
    vi.useFakeTimers();
    renderPage({ identifier: '+966500000000', channel: 'sms' });
    act(() => {
      vi.advanceTimersByTime(301_000);
    });
    expect(screen.getByText(/code has expired/i)).toBeInTheDocument();
    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];
    inputs.forEach((input) => expect(input.disabled).toBe(true));
    vi.useRealTimers();
  });

  it('returns null when otpState has no identifier', () => {
    sessionStorage.setItem('otp_state', JSON.stringify({}));
    const { container } = render(
      <AuthProvider>
        <VerifyOtpPage />
      </AuthProvider>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows API error message on failed verification', async () => {
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      captured.push(config);
      return Promise.reject(new Error('Invalid code'));
    }) as AxiosAdapter;

    renderPage({ identifier: '+966500000000', channel: 'sms' });

    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
