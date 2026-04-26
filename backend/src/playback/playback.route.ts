import { Hono } from 'hono';
import type { Env } from '../index';

export const playbackRoute = new Hono<Env>();
