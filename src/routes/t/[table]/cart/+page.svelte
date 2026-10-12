<script lang="ts">
	import { goto } from '$app/navigation';
	import { ChevronRight, Minus, Plus, Trash2 } from '@lucide/svelte';
	import type { PageData } from './$types';
	import { cart, getClientId, history } from '#lib/client/store.svelte';
	import { formatMoney } from '#lib/format';
	import { requestCall } from '#lib/client/api';

	let { data }: { data: PageData } = $props();
	const unit = $derived(data.cafe.currencyUnit);

	let note = $state('');
	let submitting = $state(false);
	let error = $state('');
	let paymentMethod = $state<'in_person' | 'online'>('in_person');
	let callMessage = $state('');

	const taxAmount = $derived(Math.round((cart.total * data.cafe.taxPercent) / 100));
	const serviceAmount = $derived(Math.round((cart.total * data.cafe.servicePercent) / 100));
	const payable = $derived(cart.total + taxAmount + serviceAmount);
	const canSubmit = $derived(cart.count > 0 && !submitting && data.cafe.orderingEnabled);

	async function submit() {
		if (!canSubmit) return;
		submitting = true;
		error = '';
		try {
			const res = await fetch('/api/orders', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					tableNumber: data.tableNumber,
					channel: 'dine_in',
					paymentMethod,
					note: note.trim() || null,
					clientId: getClientId(),
					lines: cart.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, optionIds: l.optionIds, note: l.note }))
				})
			});
			const body = (await res.json().catch(() => ({}))) as {
				message?: string;
				code?: string;
				token?: string;
				total?: number;
			};
			if (!res.ok || !body.code || !body.token) {
				error = body.message ?? 'ثبت سفارش انجام نشد. دوباره تلاش کنید.';
				return;
			}
			history.add({
				code: body.code,
				token: body.token,
				tableNumber: data.tableNumber,
				total: body.total ?? payable,
				createdAt: Date.now()
			});
			cart.clear();
			await goto(`/t/${data.tableNumber}/order/${body.code}`);
		} catch {
			error = 'اتصال برقرار نشد. دوباره تلاش کنید.';
		} finally {
			submitting = false;
		}
	}

	async function call(kind: 'waiter' | 'bill') {
		callMessage = await requestCall(data.tableNumber, kind);
	}
</script>

<svelte:head>
	<title>سبد خرید · میز {data.tableNumber}</title>
</svelte:head>

<div class="flex min-h-dvh flex-col pb-[calc(env(safe-area-inset-bottom)+104px)]">
	<header class="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3">
		<a href="/t/{data.tableNumber}" class="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2" aria-label="بازگشت به منو">
			<ChevronRight size={20} />
		</a>
		<h1 class="text-base font-bold">سبد خرید</h1>
	</header>

	{#if cart.lines.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
			<p class="text-sm text-muted">سبدتان خالی است.</p>
			<a href="/t/{data.tableNumber}" class="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary">رفتن به منو</a>
		</div>
	{:else}
		<main class="flex flex-col gap-5 px-4">
			<ul class="flex flex-col gap-2">
				{#each cart.lines as line (line.key)}
					<li class="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3">
						<div class="min-w-0 flex-1">
							<p class="font-bold">{line.name}</p>
							{#if line.options.length > 0}
								<p class="mt-0.5 text-xs text-muted">{line.options.map((o) => o.name).join('، ')}</p>
							{/if}
							{#if line.note}
								<p class="mt-0.5 text-xs text-muted">یادداشت: {line.note}</p>
							{/if}
							<p class="mt-1 text-sm tabular-nums">{formatMoney(line.unitPrice * line.qty, unit)}</p>
						</div>
						<div class="flex items-center overflow-hidden rounded-full border border-border">
							<button
								type="button"
								class="grid h-11 w-11 place-items-center"
								onclick={() => cart.setQty(line.key, line.qty - 1)}
								aria-label={line.qty === 1 ? 'حذف' : 'کم کردن'}
							>
								{#if line.qty === 1}<Trash2 size={16} />{:else}<Minus size={16} />{/if}
							</button>
							<span class="min-w-6 text-center text-sm font-bold tabular-nums">{line.qty.toLocaleString('fa-IR')}</span>
							<button
								type="button"
								class="grid h-11 w-11 place-items-center disabled:opacity-40"
								onclick={() => cart.setQty(line.key, line.qty + 1)}
								disabled={line.qty >= 20}
								aria-label="افزایش تعداد"
							>
								<Plus size={16} />
							</button>
						</div>
					</li>
				{/each}
			</ul>

			<label class="flex flex-col gap-2">
				<span class="text-sm font-bold">یادداشت برای کل سفارش</span>
				<textarea
					bind:value={note}
					maxlength="300"
					rows="2"
					placeholder="مثلاً لطفاً زودتر بیاورید"
					class="resize-none rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
				></textarea>
			</label>

			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 text-sm font-bold">روش پرداخت</legend>
				<label class="flex cursor-pointer items-center justify-between rounded-2xl border p-3 {paymentMethod === 'in_person' ? 'border-primary bg-surface-2' : 'border-border'}">
					<span>
						<span class="block text-sm font-bold">پرداخت حضوری</span>
						<span class="text-xs text-muted">پرداخت در صندوق، بعد از دریافت سفارش</span>
					</span>
					<input type="radio" name="payment" value="in_person" bind:group={paymentMethod} class="h-5 w-5 accent-[var(--c-primary)]" />
				</label>
				<label class="flex items-center justify-between rounded-2xl border border-border p-3 opacity-50">
					<span>
						<span class="block text-sm font-bold">پرداخت آنلاین</span>
						<span class="text-xs text-muted">به‌زودی</span>
					</span>
					<input type="radio" name="payment" value="online" disabled class="h-5 w-5" />
				</label>
			</fieldset>

			<section class="flex flex-col gap-2 rounded-2xl bg-surface p-4 text-sm">
				<div class="flex justify-between text-muted"><span>جمع اقلام</span><span class="tabular-nums">{formatMoney(cart.total, unit)}</span></div>
				{#if taxAmount > 0}
					<div class="flex justify-between text-muted"><span>مالیات</span><span class="tabular-nums">{formatMoney(taxAmount, unit)}</span></div>
				{/if}
				{#if serviceAmount > 0}
					<div class="flex justify-between text-muted"><span>خدمات</span><span class="tabular-nums">{formatMoney(serviceAmount, unit)}</span></div>
				{/if}
				<div class="mt-1 flex justify-between border-t border-border pt-2 font-bold">
					<span>قابل پرداخت</span><span class="tabular-nums">{formatMoney(payable, unit)}</span>
				</div>
			</section>

			{#if error}
				<p role="alert" class="rounded-xl bg-surface-2 px-3 py-2 text-sm text-danger">{error}</p>
			{/if}

			<div class="flex flex-col items-center gap-2">
				<button type="button" class="text-xs text-muted underline underline-offset-4" onclick={() => call('bill')}>درخواست صورتحساب</button>
				{#if callMessage}<p class="text-xs text-muted">{callMessage}</p>{/if}
			</div>
		</main>

		<div class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
			<div class="mx-auto max-w-lg">
				<button
					type="button"
					onclick={submit}
					disabled={!canSubmit}
					class="h-14 w-full rounded-2xl bg-primary text-base font-bold text-on-primary transition-transform active:scale-[0.99] disabled:opacity-40"
				>
					{#if submitting}
						در حال ثبت…
					{:else if !data.cafe.orderingEnabled}
						سفارش‌گیری غیرفعال است
					{:else}
						ثبت سفارش · {formatMoney(payable, unit)}
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>
