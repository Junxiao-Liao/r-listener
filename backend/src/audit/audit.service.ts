import type { AuditRepository } from './audit.repository';

export type AuditService = {
	readonly auditRepository: AuditRepository;
};

export function createAuditService(auditRepository: AuditRepository): AuditService {
	return { auditRepository };
}
