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

describe('VerifyOtpPage — recovery codes flow (T-050)', () => {
  it('shows recovery codes when the API returns them after verification', async () => {
    const recoveryResponse = {
      ...defaultResponse,
      recoveryCodes: ['abc123def4', '5678abcd90'],
    };
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      captured.push(config);
      return {
        data: config.url === '/auth/verify' ? recoveryResponse : defaultResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }) as AxiosAdapter;

    renderPage({ identifier: '+966500000000', channel: 'sms' });

    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }

    await waitFor(() => {
      expect(screen.getByText(/save your backup codes/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/abc123def4/)).toBeInTheDocument();
    expect(screen.getByText(/5678abcd90/)).toBeInTheDocument();

    const savedBtn = screen.getByRole('button', { name: /i.ve saved/i });
    fireEvent.click(savedBtn);

    await waitFor(() => {
      expect(tokenStorage.getAccessToken()).toBe('access-xyz');
    });
    expect(getReplacedPaths()).toContain('/');
  });

  it('shows and submits the recovery code input form', async () => {
    const recoveryVerifyResponse = { ...defaultResponse };
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      captured.push(config);
      return {
        data: config.url === '/auth/recover' ? recoveryVerifyResponse : defaultResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }) as AxiosAdapter;

    renderPage({ identifier: '+966500000000', channel: 'sms' });

    const useRecoveryLink = screen.getByText(/use a recovery code/i);
    fireEvent.click(useRecoveryLink);

    await waitFor(() => {
      expect(screen.getByText(/enter one of your backup recovery codes/i)).toBeInTheDocument();
    });

    const recoveryInput = screen.getByPlaceholderText('xxxxxxxxxx');
    fireEvent.change(recoveryInput, { target: { value: 'abc123def4' } });

    const submitBtn = screen.getByRole('button', { name: /sign in with recovery code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const recoverCall = captured.find((c) => c.url === '/auth/recover');
      expect(recoverCall).toBeDefined();
    });

    const recoverCall = captured.find((c) => c.url === '/auth/recover')!;
    const body = JSON.parse(recoverCall.data as string) as { identifier: string; code: string };
    expect(body.identifier).toBe('+966500000000');
    expect(body.code).toBe('abc123def4');
    expect(tokenStorage.getAccessToken()).toBe('access-xyz');
    expect(getReplacedPaths()).toContain('/');
  });

  it('recovery input filters non-hex characters and limits to 10 chars', () => {
    renderPage({ identifier: '+966500000000', channel: 'sms' });

    fireEvent.click(screen.getByText(/use a recovery code/i));

    const recoveryInput = screen.getByPlaceholderText('xxxxxxxxxx') as HTMLInputElement;
    fireEvent.change(recoveryInput, { target: { value: 'ZZZ-1234-5678-90' } });

    expect(recoveryInput.value).toBe('1234567890');
  });

  it('back button from recovery input returns to OTP view', () => {
    renderPage({ identifier: '+966500000000', channel: 'sms' });
    fireEvent.click(screen.getByText(/use a recovery code/i));
    fireEvent.click(screen.getByText(/back to verification code/i));

    expect(screen.getByText(/enter the code/i)).toBeInTheDocument();
  });
});

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
    act(() => { vi.advanceTimersByTime(301_000); });
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
