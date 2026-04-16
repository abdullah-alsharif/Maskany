/**
 * T-026 — Verify OTP page unit tests.
 */
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

describe('VerifyOtpPage', () => {
  it('renders 6 OTP input boxes and a countdown', () => {
    renderPage({ identifier: '+966500000000', channel: 'sms' });
    const inputs = screen.getAllByRole('textbox');
    // Radix OtpInput uses textbox-like inputs; some browsers report spinbutton — fall back to aria-label.
    const otpInputs = screen.getAllByLabelText(/digit \d/i);
    expect(otpInputs).toHaveLength(6);
    expect(inputs.length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText(/code expires in/i)).toBeInTheDocument();
  });

  it('redirects to /login if no identifier is in navigation state', async () => {
    renderPage(null);
    await waitFor(() => expect(getReplacedPaths()).toContain('/login'));
  });

  it('submits the code when all 6 digits are entered and stores the session', async () => {
    renderPage({ identifier: '+966500000000', channel: 'sms' });

    const inputs = screen.getAllByLabelText(/digit \d/i) as HTMLInputElement[];
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }

    await waitFor(() => expect(getReplacedPaths()).toContain('/'));

    const verifyCall = captured.find((c) => c.url === '/auth/verify');
    expect(verifyCall).toBeDefined();
    const body = JSON.parse(verifyCall!.data as string) as { identifier: string; code: string };
    expect(body.identifier).toBe('+966500000000');
    expect(body.code).toBe('123456');

    // Tokens persisted to localStorage via auth context.
    expect(tokenStorage.getAccessToken()).toBe('access-xyz');
    expect(tokenStorage.getRefreshToken()).toBe('refresh-xyz');
    expect(tokenStorage.getUser()?.id).toBe('user-1');
  });

  it('displays the identifier the code was sent to', () => {
    renderPage({ identifier: '+966500000000', channel: 'sms' });
    expect(screen.getByText(/\+966500000000/)).toBeInTheDocument();
  });

  it('enables the resend button after 30 seconds and reissues the OTP request', async () => {
    vi.useFakeTimers();
    try {
      renderPage({ identifier: '+966500000000', channel: 'sms' });

      // Countdown is idle; resend button not present initially.
      expect(screen.queryByRole('button', { name: /resend code/i })).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(30_100);
      });

      const resendBtn = await screen.findByRole('button', { name: /resend code/i });
      fireEvent.click(resendBtn);

      await waitFor(() => {
        const loginCall = captured.find((c) => c.url === '/auth/login');
        expect(loginCall).toBeDefined();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
