import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb, type Db } from './db';

export type Env = {
	Bindings: {
		DB: D1Database;
		R2: R2Bucket;
		KV: KVNamespace;
		FRONTEND_ORIGIN: string;
		SESSION_SECRET: string;
	};
	Variables: {
		db: Db;
	};
};

const app = new Hono<Env>();

app.use('*', async (c, next) => {
	c.set('db', createDb(c.env.DB));
	await next();
});

app.use(
	'*',
	cors({
		origin: (_origin, c) => c.env.FRONTEND_ORIGIN,
		credentials: true
	})
);

app.get('/health', (c) => c.json({ ok: true }));

export default app;
