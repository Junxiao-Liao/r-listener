import { v7 as uuidv7, validate as validateUuid, version as uuidVersion } from 'uuid';
import type { Id } from './shared.type';

export type IdPrefix<TEntity extends string> = `${string}_`;

export function createId<TEntity extends string>(
	prefix: IdPrefix<TEntity>,
	createUuid: () => string = uuidv7
): Id<TEntity> {
	return `${prefix}${createUuid()}` as Id<TEntity>;
}

export function isPrefixedUuidV7<TEntity extends string>(
	value: string,
	prefix: IdPrefix<TEntity>
): value is Id<TEntity> {
	if (!value.startsWith(prefix)) return false;
	const body = value.slice(prefix.length);
	return validateUuid(body) && uuidVersion(body) === 7;
}
