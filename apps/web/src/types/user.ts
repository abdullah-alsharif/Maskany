export type UserType = 'BROWSER' | 'OWNER';

export type User = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  userType: UserType;
  createdAt: string;
  /**
   * Optional: the auth API does not currently return `updatedAt` in the user
   * DTO. Consumers that have it (e.g. property owner DTOs) can still pass it.
   */
  updatedAt?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  user: User;
};
