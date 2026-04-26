import { Hono } from 'hono';
import type { Env } from '../index';

export const prefsRoute = new Hono<Env>();
