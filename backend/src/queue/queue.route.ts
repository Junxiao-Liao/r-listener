import { Hono } from 'hono';
import type { Env } from '../index';

export const queueRoute = new Hono<Env>();
