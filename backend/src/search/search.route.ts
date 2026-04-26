import { Hono } from 'hono';
import type { Env } from '../index';

export const searchRoute = new Hono<Env>();
