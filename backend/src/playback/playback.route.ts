import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';

export const playbackRoute = new Hono<Env>();
