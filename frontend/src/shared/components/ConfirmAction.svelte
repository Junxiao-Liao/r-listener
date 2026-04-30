<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import * as m from '$shared/paraglide/messages';
	import { buttonVariants } from '$shared/components/ui/button';
	import { formatGlobalApiError, reportGlobalApiError } from '$shared/feedback/error-toast.service';
	import { cn } from '$shared/utils';

	type Props = {
		title: string;
		description: string;
		trigger: string;
		confirm: string;
		disabled?: boolean;
		class?: string;
		onbeforeopen?: () => boolean;
		onconfirm: () => void | Promise<void>;
	};

	let {
		title,
		description,
		trigger,
		confirm,
		disabled = false,
		class: className,
		onbeforeopen,
		onconfirm
	}: Props = $props();

	let open = $state(false);
	let confirming = $state(false);

	function handleTriggerClick(event: MouseEvent) {
		if (!onbeforeopen) return;
		if (onbeforeopen()) return;
		event.preventDefault();
		open = false;
	}

	async function handleConfirm() {
		confirming = true;
		try {
			await onconfirm();
			open = false;
		} catch (error) {
			open = false;
			if (formatGlobalApiError(error)) {
				reportGlobalApiError(error);
				return;
			}
			throw error;
		} finally {
			confirming = false;
		}
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger
		disabled={disabled}
		class={cn(buttonVariants({ variant: 'destructive' }), 'w-full', className)}
		onclick={handleTriggerClick}
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
					disabled={confirming}
					onclick={() => void handleConfirm()}
				>
					{confirm}
				</AlertDialog.Action>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
