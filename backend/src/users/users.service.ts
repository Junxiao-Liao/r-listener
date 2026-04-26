import type { UsersRepository } from './users.repository';

export type UsersService = {
	readonly usersRepository: UsersRepository;
};

export function createUsersService(usersRepository: UsersRepository): UsersService {
	return { usersRepository };
}
