import { User } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  statusCode: number;
  message: string;
  data: {
    access_token: string;
    user: User;
  };
}
