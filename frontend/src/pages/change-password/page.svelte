<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { Label } from '$shared/components/ui/label';
	import * as m from '$shared/paraglide/messages';
	import { ApiError } from '$shared/api/client';
	import { useChangePasswordMutation } from '$shared/query/session.query';
	import { changePasswordSchema, type ChangePasswordForm } from './change-password.form';
	import PasswordRulesHint from './components/PasswordRulesHint.svelte';

	const changePassword = useChangePasswordMutation();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let fieldErrors = $state<Partial<Record<keyof ChangePasswordForm, string>>>({});

	const flashError = $derived(flashText($changePassword.error));
	const submitting = $derived($changePassword.isPending);

	function flashText(error: unknown): string | null {
		if (!(error instanceof ApiError)) return null;
		switch (error.code) {
			case 'invalid_credentials':
				return m.change_password_error_current();
			case 'weak_password':
				return m.change_password_error_weak();
			default:
				return m.change_password_error_current();
		}
	}

	function fieldErrorLabel(code: string | undefined): string | null {
		if (!code) return null;
		if (code === 'weak_password') return m.change_password_error_weak();
		if (code === 'mismatch') return m.change_password_error_mismatch();
		return code;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
		if (!parsed.success) {
			const issues: Partial<Record<keyof ChangePasswordForm, string>> = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path[0] as keyof ChangePasswordForm | undefined;
				if (key && !issues[key]) issues[key] = issue.message;
			}
			fieldErrors = issues;
			return;
		}
		fieldErrors = {};
		try {
			await $changePassword.mutateAsync({
				currentPassword: parsed.data.currentPassword,
				newPassword: parsed.data.newPassword
			});
			sessionStorage.setItem('signin_flash', 'changed');
			void goto('/signin', { replaceState: true });
		} catch {
			// Error surfaced via $changePassword.error.
		}
	}
</script>

<section class="flex flex-col gap-6 py-6">
	<header class="flex items-center justify-between">
		<a href="/settings" class="text-sm text-muted-foreground">←</a>
		<h1 class="text-lg font-semibold">{m.change_password_title()}</h1>
		<span class="w-4"></span>
	</header>

	<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
		<div class="grid gap-1.5">
			<Label for="currentPassword">{m.change_password_current()}</Label>
			<Input
				id="currentPassword"
				name="currentPassword"
				type="password"
				autocomplete="current-password"
				bind:value={currentPassword}
			/>
			{#if fieldErrors.currentPassword}
				<p class="text-xs text-destructive">{fieldErrorLabel(fieldErrors.currentPassword)}</p>
			{/if}
		</div>

		<div class="grid gap-1.5">
			<Label for="newPassword">{m.change_password_new()}</Label>
			<Input
				id="newPassword"
				name="newPassword"
				type="password"
				autocomplete="new-password"
				bind:value={newPassword}
			/>
			<PasswordRulesHint />
			{#if fieldErrors.newPassword}
				<p class="text-xs text-destructive">{fieldErrorLabel(fieldErrors.newPassword)}</p>
			{/if}
		</div>

		<div class="grid gap-1.5">
			<Label for="confirmPassword">{m.change_password_confirm()}</Label>
			<Input
				id="confirmPassword"
				name="confirmPassword"
				type="password"
				autocomplete="new-password"
				bind:value={confirmPassword}
			/>
			{#if fieldErrors.confirmPassword}
				<p class="text-xs text-destructive">{fieldErrorLabel(fieldErrors.confirmPassword)}</p>
			{/if}
		</div>

		{#if flashError}
			<p class="text-sm text-destructive" role="alert">{flashError}</p>
		{/if}

		<Button type="submit" disabled={submitting} class="w-full">
			{m.change_password_save()}
		</Button>
	</form>
</section>
