import { Hono } from 'hono';
import type { Env } from '../index';

export const authRoute = new Hono<Env>();
