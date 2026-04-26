import { Hono } from 'hono';
import type { BackendEnv } from '../app.type';

export const healthRoute = new Hono<BackendEnv>().get('/health', (c) => c.json({ ok: true }));
