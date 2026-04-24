import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Env = {
	Bindings: {
		DB: D1Database;
		R2: R2Bucket;
		KV: KVNamespace;
		FRONTEND_ORIGIN: string;
		SESSION_SECRET: string;
	};
};

const app = new Hono<Env>();

app.use(
	'*',
	cors({
		origin: (_origin, c) => c.env.FRONTEND_ORIGIN,
		credentials: true
	})
);

app.get('/health', (c) => c.json({ ok: true }));

export default app;
