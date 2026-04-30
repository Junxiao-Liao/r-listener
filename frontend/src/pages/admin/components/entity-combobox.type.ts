import type { Id, ListResponse } from '$shared/types/dto';

export type EntityComboboxId = Id<'tenant'> | Id<'user'>;

export type EntityComboboxOption<TId extends EntityComboboxId = EntityComboboxId> = {
	id: TId;
	label: string;
	detail: string;
};

export type EntityComboboxSearchParams = {
	q?: string;
	limit: number;
	cursor?: string | null;
};

export type EntityComboboxSearch<TId extends EntityComboboxId = EntityComboboxId> = (
	params: EntityComboboxSearchParams
) => Promise<ListResponse<EntityComboboxOption<TId>>>;

export type EntityComboboxState<TId extends EntityComboboxId = EntityComboboxId> = {
	items: EntityComboboxOption<TId>[];
	nextCursor: string | null;
};
