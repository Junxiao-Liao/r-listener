import { describe, expect, it } from 'vitest';
import { applyAdminListFilter, clearAdminListFilter } from './admin-list-filter.service';

describe('admin list filter service', () => {
	it('keeps draft text separate until submit applies the trimmed value', () => {
		const editing = { draft: '  alice  ', applied: '' };

		expect(editing.applied).toBe('');
		expect(applyAdminListFilter(editing)).toEqual({ draft: '  alice  ', applied: 'alice' });
	});

	it('clears draft and applied filters together', () => {
		expect(clearAdminListFilter()).toEqual({ draft: '', applied: '' });
	});
});
