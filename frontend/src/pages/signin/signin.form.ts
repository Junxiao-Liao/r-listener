import { z } from 'zod';

export const signinSchema = z.object({
	username: z.string().trim().min(1, 'Username is required.'),
	password: z.string().min(1, 'Password is required.')
});

export type SigninForm = z.infer<typeof signinSchema>;

export const defaultSigninForm: SigninForm = { username: '', password: '' };
