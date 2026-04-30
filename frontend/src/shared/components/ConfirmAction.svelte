<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import * as m from '$shared/paraglide/messages';
	import { buttonVariants } from '$shared/components/ui/button';
	import { cn } from '$shared/utils';

	type Props = {
		title: string;
		description: string;
		trigger: string;
		confirm: string;
		disabled?: boolean;
		onconfirm: () => void | Promise<void>;
	};

	let { title, description, trigger, confirm, disabled = false, onconfirm }: Props = $props();
</script>

<AlertDialog.Root>
	<AlertDialog.Trigger
		disabled={disabled}
		class={cn(buttonVariants({ variant: 'destructive' }), 'w-full')}
	>
		{trigger}
	</AlertDialog.Trigger>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-40 bg-black/40" />
		<AlertDialog.Content
			class="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 gap-4 rounded-md border border-border bg-background p-4 shadow-xl"
		>
			<AlertDialog.Title class="text-base font-semibold">{title}</AlertDialog.Title>
			<AlertDialog.Description class="text-sm text-muted-foreground">
				{description}
			</AlertDialog.Description>
			<div class="flex justify-end gap-2">
				<AlertDialog.Cancel class={buttonVariants({ variant: 'outline' })}>
					{m.action_cancel()}
				</AlertDialog.Cancel>
				<AlertDialog.Action
					class={buttonVariants({ variant: 'destructive' })}
					onclick={() => void onconfirm()}
				>
					{confirm}
				</AlertDialog.Action>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
