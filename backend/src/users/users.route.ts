import { Hono } from 'hono';
import type { Env } from '../index';

export const usersRoute = new Hono<Env>();
