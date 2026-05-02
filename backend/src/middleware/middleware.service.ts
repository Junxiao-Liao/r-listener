import type { Db } from '../db';
import { checkApiRateLimit, checkAuthRateLimit } from './rate-limit.service';
import { validateSession } from './session.service';
import { resolveTenantAccess } from './tenant.service';
import type { MiddlewareService } from './middleware.type';

export function createMiddlewareService(db: Db): MiddlewareService {
	return {
		validateSession: (input) => validateSession(db, input),
		resolveTenantAccess: (input) => resolveTenantAccess(db, input),
		checkAuthRateLimit: (input) => checkAuthRateLimit(db, input),
		checkApiRateLimit: (input) => checkApiRateLimit(db, input)
	};
}
