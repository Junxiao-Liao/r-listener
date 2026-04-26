import { Hono } from 'hono';
import type { Env } from '../index';

export const auditRoute = new Hono<Env>();
