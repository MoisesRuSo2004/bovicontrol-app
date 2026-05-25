export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'VETERINARIAN' | 'OPERATOR';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  photoUrl?: string;
  role: UserRole;
  farmId: string;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  login: string;   // username o email
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
