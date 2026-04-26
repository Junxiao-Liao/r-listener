import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';

export const usersRoute = new Hono<Env>();
