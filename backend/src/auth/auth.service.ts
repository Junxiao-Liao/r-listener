import type { AuthRepository } from './auth.repository';

export type AuthService = {
	readonly authRepository: AuthRepository;
};

export function createAuthService(authRepository: AuthRepository): AuthService {
	return { authRepository };
}
