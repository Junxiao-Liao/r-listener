import type { Db } from './db';
import type { MiddlewareService, SessionContext } from './middleware/middleware.type';

export type BackendBindings = {
	DB: D1Database;
	R2: R2Bucket;
	KV: KVNamespace;
	ASSETS: Fetcher;
	SESSION_SECRET: string;
	ENVIRONMENT?: string;
};

export type BackendVariables = {
	db: Db;
	middlewareService: MiddlewareService;
	session: SessionContext;
};

export type BackendEnv = {
	Bindings: BackendBindings;
	Variables: BackendVariables;
};
