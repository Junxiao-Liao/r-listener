import { Hono } from 'hono';
import type { Env } from '../index';

export const adminRoute = new Hono<Env>();
