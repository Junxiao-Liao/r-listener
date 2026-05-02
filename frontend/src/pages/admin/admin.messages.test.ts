import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import zh from '../../../messages/zh.json';

const adminMessageKeys = [
	'admin_eyebrow',
	'admin_settings_eyebrow',
	'admin_dashboard_title',
	'admin_home',
	'admin_users',
	'admin_tenants',
	'admin_tracks',
	'admin_back',
	'admin_create_user',
	'admin_username',
	'admin_temporary_password',
	'admin_platform_admin',
	'admin_initial_tenant_id',
	'admin_role_owner',
	'admin_role_member',
	'admin_role_viewer',
	'admin_create',
	'admin_filter_users',
	'admin_filter_tracks',
	'admin_filter_by_tenant',
	'admin_all_tenants',
	'admin_search',
	'admin_clear',
	'admin_select_page',
	'admin_clear_selection',
	'admin_tracks_selected',
	'admin_load_more',
	'admin_no_results',
	'admin_user_status_active',
	'admin_user_status_inactive',
	'admin_user_summary',
	'admin_user_detail',
	'admin_self_update_guard',
	'admin_memberships',
	'admin_reset_password',
	'admin_delete_user',
	'admin_delete_user_description',
	'admin_create_tenant',
	'admin_tenant_name',
	'admin_owner_user_id',
	'admin_filter_tenants',
	'admin_tenant_summary',
	'admin_tenant_detail',
	'admin_save',
	'admin_manage_members',
	'admin_delete_tenant',
	'admin_delete_tenant_hint',
	'admin_delete_tenant_description',
	'admin_members',
	'admin_add_member',
	'admin_user_id',
	'admin_add',
	'admin_last_owner_guard',
	'admin_update',
	'admin_remove_member',
	'admin_remove_member_description',
	'admin_track_soft_deleted',
	'admin_track_tenant_deleted',
	'admin_tracks_delete',
	'admin_tracks_delete_confirm_title',
	'admin_tracks_delete_confirm_description',
	'admin_tracks_delete_success'
] as const;

describe('admin messages', () => {
	it('defines admin labels in English and Chinese', () => {
		for (const key of adminMessageKeys) {
			expect(en[key]).toEqual(expect.any(String));
			expect(zh[key]).toEqual(expect.any(String));
			expect(en[key].length).toBeGreaterThan(0);
			expect(zh[key].length).toBeGreaterThan(0);
		}
	});
});
