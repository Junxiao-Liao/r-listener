export type AdminListFilterState = {
	draft: string;
	applied: string;
};

export function applyAdminListFilter(state: AdminListFilterState): AdminListFilterState {
	return { draft: state.draft, applied: state.draft.trim() };
}

export function clearAdminListFilter(): AdminListFilterState {
	return { draft: '', applied: '' };
}
