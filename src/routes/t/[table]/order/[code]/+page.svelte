<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, ChevronRight, Receipt } from '@lucide/svelte';
	import type { PageData } from './$types';
	import { connectLive } from '#lib/client/live';
	import { history } from '#lib/client/store.svelte';
	import { requestCall } from '#lib/client/api';
	import { formatMoney, formatNumber } from '#lib/format';
	import { STATUS_LABELS, type OrderStatus } from '#lib/shared/status';
	import type { OrderDetail } from '#lib/shared/types';

	let { data }: { data: PageData } = $props();

	let order = $state<OrderDetail | null>(null);
	let connected = $state(false);
	let notFound = $state(false);
	let callMessage = $state('');
	let payMsg = $state('');
	let stars = $state(0);
	let ratingSent = $state(false);
	let historyEntry = $state<{ token: string } | null>(null);

	const STEPS = ['دریافت شد', 'در حال آماده‌سازی', 'آماده است', 'تحویل شد'] as const;

	const stepIndex = $derived.by(() => {
		if (!order) return -1;
		switch (order.status) {
			case 'awaiting_approval':
			case 'received':
				return 0;
			case 'preparing':
				return 1;
			case 'ready':
				return 2;
			case 'served':
				return 3;
			default:
				return -1;
		}
	});

	const message = $derived.by(() => {
		const messages: Record<OrderStatus, string> = {
			awaiting_approval: 'سفارشت ثبت شد و منتظر تأیید کافه است.',
			received: 'سفارشت ثبت شد. به‌زودی شروع می‌کنیم.',
			preparing: 'در حال آماده‌سازی است.',
			ready: 'آماده است. از گارسون تحویل بگیرید.',
			served: 'تحویل داده شد. نوش جان!',
			cancelled: 'این سفارش لغو شد.'
		};
		return order ? messages[order.status] : '';
	});

	const unit = 'toman' as const;
	const progress = $derived(stepIndex < 0 ? 0 : ((stepIndex + 1) / STEPS.length) * 100);

	onMount(() => {
		const entry = history.find(data.code);
		if (!entry) {
			notFound = true;
			return;
		}
		historyEntry = entry;

		let stop: (() => void) | undefined;
		const streamUrl = `/api/orders/${data.code}/stream?token=${encodeURIComponent(entry.token)}`;

		stop = connectLive(streamUrl, {
			onOpen: () => (connected = true),
			onError: async () => {
				connected = false;
				// Distinguish a revoked or unknown order from a dropped connection.
				const res = await fetch(`/api/orders/${data.code}`, { headers: { 'x-order-token': entry.token } });
				if (res.status === 404 || res.status === 401) {
					notFound = true;
					stop?.();
				} else if (res.ok) {
					order = (await res.json()) as OrderDetail;
				}
			},
			events: {
				'order.snapshot': (d) => (order = d as OrderDetail),
				'order.update': (d) => (order = d as OrderDetail)
			}
		});

		return () => stop?.();
	});

	async function call(kind: 'waiter' | 'bill') {
		callMessage = await requestCall(data.tableNumber, kind);
	}

	async function payOnline() {
		if (!historyEntry) return;
		payMsg = 'در حال انتقال به درگاه…';
		try {
			const res = await fetch('/api/pay/checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ code: data.code, token: historyEntry.token })
			});
			const out = await res.json().catch(() => ({}));
			if (res.ok && out.redirectUrl) {
				window.location.href = out.redirectUrl as string;
			} else {
				payMsg = out.message ?? 'شروع پرداخت ممکن نشد.';
			}
		} catch {
			payMsg = 'اتصال برقرار نشد.';
		}
	}

	async function sendRating() {
		if (!historyEntry || stars < 1) return;
		try {
			const res = await fetch(`/api/orders/${data.code}/rate`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-order-token': historyEntry.token },
				body: JSON.stringify({ stars })
			});
			if (res.ok) ratingSent = true;
		} catch {
			/* silent: rating is best-effort */
		}
	}
</script>

<svelte:head>
	<title>پیگیری سفارش {data.code}</title>
</svelte:head>

<div class="flex min-h-dvh flex-col gap-6 px-4 pb-10 pt-[max(env(safe-area-inset-top),16px)]">
	<header class="flex items-center gap-3">
		<a href="/t/{data.tableNumber}" class="grid h-11 w-11 place-items-center rounded-2xl bg-surface-2" aria-label="بازگشت به منو">
			<ChevronRight size={20} />
		</a>
		<h1 class="text-base font-bold">پیگیری سفارش</h1>
		<span class="ms-auto text-xs text-muted" aria-live="polite">{connected ? 'زنده' : 'در حال اتصال…'}</span>
	</header>

	{#if notFound}
		<section class="rounded-2xl bg-surface p-6 text-center">
			<p class="font-bold">این سفارش روی این دستگاه پیدا نشد.</p>
			<p class="mt-2 text-sm text-muted">اگر سفارش را با دستگاه دیگری ثبت کرده‌اید، از همان دستگاه پیگیری کنید.</p>
			<a href="/t/{data.tableNumber}" class="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary">رفتن به منو</a>
		</section>
	{:else if !order}
		<div class="flex flex-col gap-4" aria-busy="true" aria-label="در حال بارگذاری">
			<div class="h-20 animate-pulse rounded-2xl bg-surface-2"></div>
			<div class="h-40 animate-pulse rounded-2xl bg-surface-2"></div>
		</div>
	{:else}
		<section class="flex flex-col items-center gap-2 text-center">
			<p class="text-xs text-muted">کد سفارش</p>
			<p class="text-4xl font-bold tabular-nums tracking-widest">{formatNumber(Number(order.publicCode))}</p>
			<p class="mt-2 text-lg font-bold">{STATUS_LABELS[order.status]}</p>
			<p class="text-sm text-muted">{message}</p>
		</section>

		{#if order.status !== 'cancelled'}
			<section aria-label="مراحل سفارش">
				<div class="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
					<div class="absolute inset-y-0 start-0 rounded-full bg-primary transition-[width] duration-500 ease-out" style="width: {progress}%"></div>
				</div>
				<ol class="mt-4 grid grid-cols-4 gap-1 text-center text-[11px]">
					{#each STEPS as step, i (step)}
						<li class="flex flex-col items-center gap-2 {i <= stepIndex ? 'font-bold text-primary' : 'text-muted'}">
							<span
								class="grid h-7 w-7 place-items-center rounded-full border-2 transition-colors duration-300 {i <= stepIndex
									? 'border-primary bg-primary text-on-primary'
									: 'border-border'}"
								aria-hidden="true"
							>
								{i + 1}
							</span>
							<span class="leading-4">{step}</span>
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<section class="rounded-2xl border border-border bg-surface p-4">
			<h2 class="mb-3 text-sm font-bold">اقلام سفارش</h2>
			<ul class="flex flex-col gap-3">
				{#each order.items as item (item.id)}
					<li class="flex justify-between gap-3 text-sm">
						<div class="min-w-0">
							<p>{formatNumber(item.qty)} × {item.name}</p>
							{#if item.options.length > 0}
								<p class="text-xs text-muted">{item.options.map((o) => o.name).join('، ')}</p>
							{/if}
						</div>
						<span class="shrink-0 tabular-nums">{formatMoney(item.lineTotal, unit)}</span>
					</li>
				{/each}
			</ul>
			<div class="mt-4 flex justify-between border-t border-border pt-3 font-bold">
				<span>جمع کل</span>
				<span class="tabular-nums">{formatMoney(order.total, unit)}</span>
			</div>
			<p class="mt-2 text-xs text-muted">
				{order.paymentStatus === 'unpaid_in_person' ? 'پرداخت در صندوق انجام می‌شود.' : order.paymentStatus === 'unpaid' ? 'پرداخت آنلاین انجام نشده است.' : 'پرداخت ثبت شد.'}
			</p>
			{#if order.paymentMethod === 'online' && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'unpaid_in_person')}
				<button type="button" onclick={payOnline} class="mt-3 h-12 w-full rounded-xl bg-primary text-sm font-bold text-on-primary">پرداخت آنلاین</button>
				{#if payMsg}<p class="mt-1 text-xs text-muted">{payMsg}</p>{/if}
			{/if}
		</section>

		{#if data.cafe.enableRatings && order.status === 'served'}
			<section class="rounded-2xl border border-border bg-surface p-4 text-center">
				{#if ratingSent}
					<p class="text-sm text-success">نظر شما ثبت شد. سپاسگزاریم!</p>
				{:else}
					<p class="text-sm font-bold">کیفیتی که دریافت کردید؟</p>
					<div class="mt-2 flex justify-center gap-2">
						{#each [1, 2, 3, 4, 5] as s (s)}
							<button type="button" aria-label={"امتیاز " + s} onclick={() => (stars = s)} class="text-2xl {s <= stars ? 'grayscale-0' : 'grayscale opacity-40'}" style="filter:none">⭐</button>
						{/each}
					</div>
					<button type="button" onclick={sendRating} disabled={stars < 1} class="mt-3 h-10 rounded-xl bg-primary px-6 text-sm font-bold text-on-primary disabled:opacity-40">ثبت نظر</button>
				{/if}
			</section>
		{/if}

		<section class="grid grid-cols-2 gap-3">
			<button
				type="button"
				onclick={() => call('waiter')}
				class="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-sm font-bold"
			>
				<Bell size={18} /> صدا زدن گارسون
			</button>
			<button
				type="button"
				onclick={() => call('bill')}
				class="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-sm font-bold"
			>
				<Receipt size={18} /> درخواست صورتحساب
			</button>
		</section>
		{#if callMessage}<p class="text-center text-sm text-muted" role="status">{callMessage}</p>{/if}

		<a href="/t/{data.tableNumber}" class="rounded-2xl bg-primary py-3.5 text-center text-sm font-bold text-on-primary">ثبت سفارش جدید</a>
	{/if}
</div>
