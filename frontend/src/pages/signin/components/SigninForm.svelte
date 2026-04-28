<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$shared/components/ui/button';
	import { Input } from '$shared/components/ui/input';
	import { Label } from '$shared/components/ui/label';
	import * as m from '$shared/paraglide/messages';
	import { useSigninMutation } from '$shared/query/session.query';
	import { ApiError } from '$shared/api/client';
	import { signinSchema, postSigninRedirect, type SigninForm } from '../signin.form';

	const signin = useSigninMutation();

	function readJustChanged(): boolean {
		if (typeof window === 'undefined') return false;
		const flag = sessionStorage.getItem('signin_flash') === 'changed';
		if (flag) sessionStorage.removeItem('signin_flash');
		return flag;
	}

	let username = $state('');
	let password = $state('');
	let submitted = $state(false);
	const justChanged = readJustChanged();

	let fieldErrors = $derived.by((): Partial<Record<keyof SigninForm, string>> => {
		if (!submitted) return {};
		const parsed = signinSchema.safeParse({ username, password });
		if (parsed.success) return {};
		const issues: Partial<Record<keyof SigninForm, string>> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path[0] as keyof SigninForm | undefined;
			if (key && !issues[key]) issues[key] = issue.message;
		}
		return issues;
	});

	const flashError = $derived(errorText($signin.error));
	const submitting = $derived($signin.isPending);

	function errorText(error: unknown): string | null {
		if (!(error instanceof ApiError)) return null;
		switch (error.code) {
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

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		const parsed = signinSchema.safeParse({ username, password });
		if (!parsed.success) return;
		submitted = false;
		try {
			const session = await $signin.mutateAsync(parsed.data);
			void goto(postSigninRedirect(session), { replaceState: true });
		} catch {
			// Error surfaced via $signin.error / flashError.
		}
	}
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

	<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
		<div class="grid gap-1.5">
			<Label for="username">{m.auth_username()}</Label>
			<Input id="username" name="username" autocomplete="username" bind:value={username} />
			{#if fieldErrors.username}
				<p class="text-xs text-destructive">{fieldErrors.username}</p>
			{/if}
		</div>

		<div class="grid gap-1.5">
			<Label for="password">{m.auth_password()}</Label>
			<Input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				bind:value={password}
			/>
			{#if fieldErrors.password}
				<p class="text-xs text-destructive">{fieldErrors.password}</p>
			{/if}
		</div>

		{#if flashError}
			<p class="text-sm text-destructive" role="alert">{flashError}</p>
		{/if}

		<Button type="submit" disabled={submitting} class="w-full">
			{m.signin_submit()}
		</Button>
	</form>
</div>
