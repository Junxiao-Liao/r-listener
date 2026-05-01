import type { Db } from '../db';
import { checkApiRateLimit, checkAuthRateLimit } from './rate-limit.service';
import { validateSession } from './session.service';
import { resolveTenantAccess } from './tenant.service';
import type { MiddlewareService } from './middleware.type';

export function createMiddlewareService(db: Db, kv: KVNamespace): MiddlewareService {
	return {
		validateSession: (input) => validateSession(kv, db, input),
		resolveTenantAccess: (input) => resolveTenantAccess(db, kv, input),
		checkAuthRateLimit: (input) => checkAuthRateLimit(kv, input),
		checkApiRateLimit: (input) => checkApiRateLimit(kv, input)
	};
}
