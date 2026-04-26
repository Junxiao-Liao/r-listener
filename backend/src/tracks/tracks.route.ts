import { Hono } from 'hono';
import type { Env } from '../index';

export const tracksRoute = new Hono<Env>();
