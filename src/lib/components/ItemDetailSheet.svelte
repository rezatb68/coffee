<script lang="ts">
	import { Minus, Plus } from '@lucide/svelte';
	import Sheet from './Sheet.svelte';
	import { formatMoney } from '#lib/format';
	import type { MenuGroup, MenuItem } from '#lib/shared/types';
	import type { CartLine } from '#lib/client/store.svelte';

	let {
		item,
		unit,
		onClose,
		onAdd
	}: {
		item: MenuItem;
		unit: 'toman' | 'rial';
		onClose: () => void;
		onAdd: (line: Omit<CartLine, 'key'>) => void;
	} = $props();

	let selections = $state<Record<number, number[]>>({});
	let note = $state('');
	let qty = $state(1);

	function minFor(group: MenuGroup): number {
		return group.required ? Math.max(1, group.minSelect) : group.minSelect;
	}

	function toggle(group: MenuGroup, optionId: number, available: boolean) {
		if (!available) return;
		const current = selections[group.id] ?? [];
		if (group.kind === 'single') {
			if (current.includes(optionId)) {
				if (!group.required) selections[group.id] = [];
			} else {
				selections[group.id] = [optionId];
			}
			return;
		}
		if (current.includes(optionId)) {
			selections[group.id] = current.filter((id) => id !== optionId);
		} else if (current.length < group.maxSelect) {
			selections[group.id] = [...current, optionId];
		}
	}

	const missing = $derived(item.groups.find((g) => (selections[g.id] ?? []).length < minFor(g)));

	const chosen = $derived(
		item.groups.flatMap((g) =>
			g.options
				.filter((o) => (selections[g.id] ?? []).includes(o.id))
				.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta }))
		)
	);

	const unitPrice = $derived(item.basePrice + chosen.reduce((sum, o) => sum + o.priceDelta, 0));

	function submit() {
		if (missing || !item.isAvailable) return;
		onAdd({
			itemId: item.id,
			name: item.name,
			unitPrice,
			qty,
			optionIds: chosen.map((o) => o.id),
			options: chosen,
			note: note.trim() || null
		});
	}
</script>

<Sheet label={item.name} {onClose}>
	<div class="flex flex-col gap-5 pb-4">
		<header>
			<h2 class="text-xl font-bold">{item.name}</h2>
			{#if item.description}
				<p class="mt-1 text-sm leading-6 text-muted">{item.description}</p>
			{/if}
			{#if item.allergens.length > 0}
				<p class="mt-2 text-xs text-muted">آلرژن: {item.allergens.join('، ')}</p>
			{/if}
		</header>

		{#each item.groups as group (group.id)}
			<section class="flex flex-col gap-2" aria-labelledby="group-{group.id}">
				<h3 id="group-{group.id}" class="flex items-center gap-2 text-sm font-bold">
					{group.name}
					{#if minFor(group) > 0}
						<span class="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-normal text-muted">الزامی</span>
					{/if}
				</h3>
				<div class="grid gap-2" role={group.kind === 'single' ? 'radiogroup' : 'group'}>
					{#each group.options as option (option.id)}
						{@const selected = (selections[group.id] ?? []).includes(option.id)}
						<button
							type="button"
							role={group.kind === 'single' ? 'radio' : 'checkbox'}
							aria-checked={selected}
							disabled={!option.isAvailable}
							onclick={() => toggle(group, option.id, option.isAvailable)}
							class="flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors {selected
								? 'border-primary bg-surface-2 font-bold'
								: 'border-border'} disabled:opacity-40"
						>
							<span>{option.name}{option.isAvailable ? '' : ' (ناموجود)'}</span>
							<span class="text-xs text-muted">
								{option.priceDelta > 0 ? `+${formatMoney(option.priceDelta, unit)}` : option.priceDelta < 0 ? '' : ''}
							</span>
						</button>
					{/each}
				</div>
			</section>
		{/each}

		<label class="flex flex-col gap-2">
			<span class="text-sm font-bold">یادداشت</span>
			<textarea
				bind:value={note}
				maxlength="300"
				rows="2"
				placeholder="مثلاً کم‌آب یا بدون یخ"
				class="resize-none rounded-xl border border-border bg-bg p-3 text-sm outline-none focus:border-primary"
			></textarea>
		</label>

		<div class="sticky bottom-0 -mx-5 flex items-center gap-3 border-t border-border bg-surface px-5 pt-3">
			<div class="flex items-center overflow-hidden rounded-full border border-border">
				<button type="button" class="grid h-11 w-11 place-items-center" onclick={() => (qty = Math.max(1, qty - 1))} aria-label="کم کردن تعداد">
					<Minus size={18} />
				</button>
				<span class="min-w-6 text-center font-bold tabular-nums">{qty.toLocaleString('fa-IR')}</span>
				<button type="button" class="grid h-11 w-11 place-items-center" onclick={() => (qty = Math.min(20, qty + 1))} aria-label="افزایش تعداد">
					<Plus size={18} />
				</button>
			</div>
			<button
				type="button"
				onclick={submit}
				disabled={!!missing || !item.isAvailable}
				class="h-11 flex-1 rounded-full bg-primary px-4 text-sm font-bold text-on-primary transition-transform active:scale-[0.98] disabled:opacity-40"
			>
				{#if missing}
					گزینه‌ی «{missing.name}» را انتخاب کنید
				{:else}
					افزودن · {formatMoney(unitPrice * qty, unit)}
				{/if}
			</button>
		</div>
	</div>
</Sheet>
