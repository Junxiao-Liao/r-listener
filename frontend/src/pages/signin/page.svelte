<script lang="ts">
	import SigninForm from './components/SigninForm.svelte';
	import type { Infer, SuperValidated } from 'sveltekit-superforms';
	import type { FormMessage } from '$shared/forms/superforms';
	import type { signinSchema } from './signin.form';

	type Data = {
		form: SuperValidated<Infer<typeof signinSchema>, FormMessage>;
		justChanged: boolean;
	};

	let { data }: { data: Data } = $props();
</script>

<SigninForm data={data.form} justChanged={data.justChanged} />
