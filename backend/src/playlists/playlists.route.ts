import { Hono } from 'hono';
import type { Env } from '../index';

export const playlistsRoute = new Hono<Env>();
