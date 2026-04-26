import { Hono } from 'hono';
import type { Env } from '../index';

export const tenantsRoute = new Hono<Env>();
