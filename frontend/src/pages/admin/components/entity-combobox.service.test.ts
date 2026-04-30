import { describe, expect, it } from 'vitest';
import { mergeEntityPage, optionById } from './entity-combobox.service';
import type { EntityComboboxOption } from './entity-combobox.type';
import type { Id } from '$shared/types/dto';

describe('entity combobox service', () => {
	it('replaces results for a new search and appends unique cursor results', () => {
		const first = mergeEntityPage(emptyState(), {
			items: [option('usr_a', 'Alice'), option('usr_b', 'Bob')],
			nextCursor: 'cursor-2'
		}, 'replace');
		const second = mergeEntityPage(first, {
			items: [option('usr_b', 'Bob'), option('usr_c', 'Cyd')],
			nextCursor: null
		}, 'append');

		expect(first.items.map((item) => item.id)).toEqual(['usr_a', 'usr_b']);
		expect(first.nextCursor).toBe('cursor-2');
		expect(second.items.map((item) => item.id)).toEqual(['usr_a', 'usr_b', 'usr_c']);
		expect(second.nextCursor).toBeNull();
	});

	it('finds selected options by id', () => {
		const items = [option('tnt_a', 'Tenant A'), option('tnt_b', 'Tenant B')];

		expect(optionById(items, 'tnt_b' as Id<'tenant'>)?.label).toBe('Tenant B');
		expect(optionById(items, '')).toBeNull();
	});
});

function emptyState() {
	return { items: [], nextCursor: null };
}

function option(id: string, label: string): EntityComboboxOption<any> {
	return { id, label, detail: id };
}
