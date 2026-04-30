import { Hono } from 'hono';
import type { BackendEnv as Env } from '../app.type';
import type { Db } from '../db';
import { parseJsonBody, parseQuery } from '../http/validation';
import { requireAdmin, requireSession } from '../middleware/middleware.guard';
import type { Id } from '../shared/shared.type';
import {
	adminCreateMembershipSchema,
	adminCreateTenantSchema,
	adminCreateUserSchema,
	adminListQuerySchema,
	adminResetPasswordSchema,
	adminUpdateMembershipSchema,
	adminUpdateTenantSchema,
	adminUpdateUserSchema,
	adminUserListQuerySchema
} from './admin.dto';
import { createAdminServiceForDb, type AdminService } from './admin.service';

export type AdminRouteDeps = {
	createAdminService?: (db: Db) => AdminService;
};

export function createAdminRoute(deps: AdminRouteDeps = {}) {
	const route = new Hono<Env>();
	const serviceFactory = deps.createAdminService ?? createAdminServiceForDb;
	const guards = [requireSession(), requireAdmin()] as const;

	route.get('/admin/users', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		return c.json(await service.listUsers(parseQuery(c, adminUserListQuerySchema)));
	});

	route.post('/admin/users', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		const body = await parseJsonBody(c, adminCreateUserSchema);
		return c.json(
			await service.createUser({
				actor: c.var.session.user,
				body: {
					...body,
					initialMembership: body.initialMembership
						? {
								...body.initialMembership,
								tenantId: body.initialMembership.tenantId as Id<'tenant'>
							}
						: undefined
				}
			}),
			201
		);
	});

	route.get('/admin/users/:id', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		return c.json(await service.getUser(c.req.param('id') as Id<'user'>));
	});

	route.patch('/admin/users/:id', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		const body = await parseJsonBody(c, adminUpdateUserSchema);
		return c.json(
			await service.updateUser({
				actor: c.var.session.user,
				userId: c.req.param('id') as Id<'user'>,
				body
			})
		);
	});

	route.post('/admin/users/:id/reset-password', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		const body = await parseJsonBody(c, adminResetPasswordSchema);
		await service.resetPassword({
			actor: c.var.session.user,
			userId: c.req.param('id') as Id<'user'>,
			body
		});
		return c.body(null, 204);
	});

	route.delete('/admin/users/:id', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		await service.deleteUser({
			actor: c.var.session.user,
			userId: c.req.param('id') as Id<'user'>
		});
		return c.body(null, 204);
	});

	route.get('/admin/tenants', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		return c.json(await service.listTenants(parseQuery(c, adminListQuerySchema)));
	});

	route.post('/admin/tenants', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		const body = await parseJsonBody(c, adminCreateTenantSchema);
		return c.json(
			await service.createTenant({
				actor: c.var.session.user,
				body: { ...body, ownerUserId: body.ownerUserId as Id<'user'> }
			}),
			201
		);
	});

	route.get('/admin/tenants/:id', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		return c.json(await service.getTenant(c.req.param('id') as Id<'tenant'>));
	});

	route.patch('/admin/tenants/:id', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		const body = await parseJsonBody(c, adminUpdateTenantSchema);
		return c.json(
			await service.updateTenant({
				actor: c.var.session.user,
				tenantId: c.req.param('id') as Id<'tenant'>,
				body
			})
		);
	});

	route.delete('/admin/tenants/:id', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		await service.deleteTenant({
			actor: c.var.session.user,
			tenantId: c.req.param('id') as Id<'tenant'>
		});
		return c.body(null, 204);
	});

	route.get('/admin/tenants/:id/members', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		const query = parseQuery(c, adminListQuerySchema);
		return c.json(
			await service.listTenantMembers({
				tenantId: c.req.param('id') as Id<'tenant'>,
				limit: query.limit,
				cursor: query.cursor
			})
		);
	});

	route.post('/admin/tenants/:id/members', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		const body = await parseJsonBody(c, adminCreateMembershipSchema);
		return c.json(
			await service.createMembership({
				actor: c.var.session.user,
				tenantId: c.req.param('id') as Id<'tenant'>,
				body: { ...body, userId: body.userId as Id<'user'> }
			}),
			201
		);
	});

	route.patch('/admin/tenants/:id/members/:userId', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		const body = await parseJsonBody(c, adminUpdateMembershipSchema);
		return c.json(
			await service.updateMembership({
				actor: c.var.session.user,
				tenantId: c.req.param('id') as Id<'tenant'>,
				userId: c.req.param('userId') as Id<'user'>,
				body
			})
		);
	});

	route.delete('/admin/tenants/:id/members/:userId', ...guards, async (c) => {
		const service = serviceFactory(c.var.db);
		await service.deleteMembership({
			actor: c.var.session.user,
			tenantId: c.req.param('id') as Id<'tenant'>,
			userId: c.req.param('userId') as Id<'user'>
		});
		return c.body(null, 204);
	});

	return route;
}

export const adminRoute = createAdminRoute();
