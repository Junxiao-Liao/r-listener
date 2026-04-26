// Usage:
// # Generate seed SQL (save to file)
// NODE_PATH=backend/node_modules npx tsx scripts/db-init.ts > /tmp/seed.sql
// # Apply migrations first (if needed)
// cd backend && npx wrangler d1 migrations apply r-listener --local
// # Execute seed
// cd backend && npx wrangler d1 execute r-listener --local --file=/tmp/seed.sql

import { hashPassword } from '../backend/src/auth/password';
import { createId } from '../backend/src/shared/id';

async function main() {
	const now = Math.floor(Date.now() / 1000);

	const userId = createId('usr_');
	const tenantId = createId('tnt_');
	const membershipId = createId('mbr_');

	const passwordHash = await hashPassword('~Abc12345');

	const sql = [
		`-- r-listener: first admin user, tenant, and membership`,
		``,
		`DELETE FROM user_preferences WHERE user_id = (SELECT id FROM users WHERE username = 'admin');`,
		`DELETE FROM memberships WHERE user_id = (SELECT id FROM users WHERE username = 'admin');`,
		`DELETE FROM users WHERE username = 'admin';`,
		`DELETE FROM tenants WHERE name = 'Default';`,
		``,
		`INSERT INTO tenants (id, name, created_at, updated_at) VALUES ('${tenantId}', 'Default', ${now}, ${now});`,
		``,
		`INSERT INTO users (id, username, password_hash, is_admin, is_active, last_active_tenant_id, created_at, updated_at) VALUES ('${userId}', 'admin', '${passwordHash}', 1, 1, '${tenantId}', ${now}, ${now});`,
		``,
		`INSERT INTO memberships (id, user_id, tenant_id, role, created_at, updated_at) VALUES ('${membershipId}', '${userId}', '${tenantId}', 'owner', ${now}, ${now});`,
		``,
		`INSERT INTO user_preferences (user_id, updated_at) VALUES ('${userId}', ${now});`,
	].join('\n');

	console.log(sql);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
