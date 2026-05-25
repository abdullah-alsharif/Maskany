/**
 * Auth API client helpers (T-026, PRD §2.1-§2.4).
 *
 * Thin typed wrappers over the shared `apiClient` for every `/auth/*`
 * endpoint exposed by `apps/api/src/routes/auth-routes.ts`. Keeping
 * these as plain functions (not a class) makes them trivial to import,
 * tree-shakeable, and easy to test with a swapped axios adapter.
 */
import { apiClient } from './api';
import type { AuthResponse, User, UserType } from '../types/user';

export interface RegisterRequest {
  fullName: string;
  phone: string;
  email?: string;
  userType: UserType;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

export interface LoginOtpResponse {
  message: string;
  type: 'sms' | 'email';
}

export interface RefreshResponse {
  accessToken: string;
}

export async function registerUser(body: RegisterRequest): Promise<RegisterResponse> {
  const res = await apiClient.post<RegisterResponse>('/auth/register', body);
  return res.data;
}

export async function requestLoginOtp(identifier: string): Promise<LoginOtpResponse> {
  const res = await apiClient.post<LoginOtpResponse>('/auth/login', { identifier });
  return res.data;
}

export async function verifyOtpCode(identifier: string, code: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/verify', { identifier, code });
  return res.data;
}

export async function refreshAccessToken(): Promise<RefreshResponse> {
  const res = await apiClient.post<RefreshResponse>('/auth/refresh');
  return res.data;
}

export async function logoutSession(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await apiClient.get<User>('/auth/me');
  return res.data;
}

export async function recoverWithBackupCode(
  identifier: string,
  code: string,
): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/recover', { identifier, code });
  return res.data;
}
