<script lang="ts">
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { Label } from '$shared/components/ui/label';
	import * as m from '$shared/paraglide/messages';
	import type { FormMessage } from '$shared/forms/superforms';
	import { superForm } from 'sveltekit-superforms';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import type { changePasswordSchema } from './change-password.form';
	import PasswordRulesHint from './components/PasswordRulesHint.svelte';

	type Data = {
		form: SuperValidated<Infer<typeof changePasswordSchema>, FormMessage>;
	};

	let { data }: { data: Data } = $props();

	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = superForm(data.form);

	function flashText(code: string | undefined): string | null {
		if (!code) return null;
		switch (code) {
			case 'invalid_credentials':
				return m.change_password_error_current();
			case 'weak_password':
				return m.change_password_error_weak();
			default:
				return m.change_password_error_current();
		}
	}

	const flashError = $derived($message?.type === 'error' ? flashText($message.code) : null);

	function fieldError(code: string | string[] | undefined): string | null {
		const c = Array.isArray(code) ? code[0] : code;
		if (!c) return null;
		if (c === 'weak_password') return m.change_password_error_weak();
		if (c === 'mismatch') return m.change_password_error_mismatch();
		return c;
	}
</script>

<section class="flex flex-col gap-6 py-6">
	<header class="flex items-center justify-between">
		<a href="/settings" class="text-sm text-muted-foreground">←</a>
		<h1 class="text-lg font-semibold">{m.change_password_title()}</h1>
		<span class="w-4"></span>
	</header>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<div class="grid gap-1.5">
			<Label for="currentPassword">{m.change_password_current()}</Label>
			<Input
				id="currentPassword"
				name="currentPassword"
				type="password"
				autocomplete="current-password"
				bind:value={$form.currentPassword}
			/>
			{#if $errors.currentPassword}
				<p class="text-xs text-destructive">{fieldError($errors.currentPassword)}</p>
			{/if}
		</div>

		<div class="grid gap-1.5">
			<Label for="newPassword">{m.change_password_new()}</Label>
			<Input
				id="newPassword"
				name="newPassword"
				type="password"
				autocomplete="new-password"
				bind:value={$form.newPassword}
			/>
			<PasswordRulesHint />
			{#if $errors.newPassword}
				<p class="text-xs text-destructive">{fieldError($errors.newPassword)}</p>
			{/if}
		</div>

		<div class="grid gap-1.5">
			<Label for="confirmPassword">{m.change_password_confirm()}</Label>
			<Input
				id="confirmPassword"
				name="confirmPassword"
				type="password"
				autocomplete="new-password"
				bind:value={$form.confirmPassword}
			/>
			{#if $errors.confirmPassword}
				<p class="text-xs text-destructive">{fieldError($errors.confirmPassword)}</p>
			{/if}
		</div>

		{#if flashError}
			<p class="text-sm text-destructive" role="alert">{flashError}</p>
		{/if}

		<Button type="submit" disabled={$submitting} class="w-full">
			{m.change_password_save()}
		</Button>
	</form>
</section>
