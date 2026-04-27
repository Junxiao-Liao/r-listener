<script lang="ts">
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { Label } from '$shared/components/ui/label';
	import { superForm } from 'sveltekit-superforms';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import * as m from '$shared/paraglide/messages';
	import type { FormMessage } from '$shared/forms/superforms';
	import { signinSchema } from '../signin.form';

	type Props = {
		data: SuperValidated<Infer<typeof signinSchema>, FormMessage>;
		justChanged: boolean;
	};
	let { data, justChanged }: Props = $props();

	// superForm reads the initial validated form once and returns its own reactive stores.
	// svelte-ignore state_referenced_locally
	const { form, errors, message, enhance, submitting } = superForm(data, {
		validators: zod4Client(signinSchema)
	});

	function errorText(code: string | undefined): string | null {
		if (!code) return null;
		switch (code) {
			case 'invalid_credentials':
				return m.signin_error_invalid();
			case 'account_disabled':
				return m.signin_error_disabled();
			case 'rate_limited':
				return m.signin_error_rate_limited();
			default:
				return m.signin_error_invalid();
		}
	}

	const flashError = $derived($message?.type === 'error' ? errorText($message.code) : null);
</script>

<div class="flex flex-col gap-6">
	<div class="text-center">
		<h1 class="text-3xl font-semibold tracking-tight">{m.signin_title()}</h1>
		<p class="mt-2 text-sm text-muted-foreground">{m.signin_tagline()}</p>
	</div>

	{#if justChanged}
		<p class="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
			{m.change_password_success()}
		</p>
	{/if}

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<div class="grid gap-1.5">
			<Label for="username">{m.auth_username()}</Label>
			<Input id="username" name="username" autocomplete="username" bind:value={$form.username} />
			{#if $errors.username}
				<p class="text-xs text-destructive">{$errors.username}</p>
			{/if}
		</div>

		<div class="grid gap-1.5">
			<Label for="password">{m.auth_password()}</Label>
			<Input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				bind:value={$form.password}
			/>
			{#if $errors.password}
				<p class="text-xs text-destructive">{$errors.password}</p>
			{/if}
		</div>

		{#if flashError}
			<p class="text-sm text-destructive" role="alert">{flashError}</p>
		{/if}

		<Button type="submit" disabled={$submitting} class="w-full">
			{m.signin_submit()}
		</Button>
	</form>
</div>
