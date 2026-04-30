import type {
	EntityComboboxOption,
	EntityComboboxState,
	EntityComboboxId
} from './entity-combobox.type';
import type { ListResponse } from '$shared/types/dto';

export function optionById<TId extends EntityComboboxId>(
	items: EntityComboboxOption<TId>[],
	id: TId | ''
): EntityComboboxOption<TId> | null {
	return items.find((item) => item.id === id) ?? null;
}

export function mergeEntityPage<TId extends EntityComboboxId>(
	state: EntityComboboxState<TId>,
	page: ListResponse<EntityComboboxOption<TId>>,
	mode: 'replace' | 'append'
): EntityComboboxState<TId> {
	const items = mode === 'append' ? appendUniqueById(state.items, page.items) : page.items;
	return { items, nextCursor: page.nextCursor };
}

function appendUniqueById<TId extends EntityComboboxId>(
	current: EntityComboboxOption<TId>[],
	incoming: EntityComboboxOption<TId>[]
): EntityComboboxOption<TId>[] {
	const seen = new Set(current.map((item) => item.id));
	return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}
