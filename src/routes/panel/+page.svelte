<script lang="ts">
	import { onMount } from 'svelte';
	import { ACTION_LABELS, ACTION_RULES, PAYMENT_LABELS, STATUS_LABELS, type OrderAction, type OrderStatus, type Role } from '#lib/shared/status';
	import type { OrderDetail, PanelCall } from '#lib/shared/types';
	import { connectLive } from '#lib/client/live';
	import { alertSound } from '#lib/client/sound.svelte';
	import { formatMoney, formatNumber, formatTime } from '#lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const role: Role = data.role;
	const byCreated = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;

	let orders = $state<OrderDetail[]>(data.snapshot.orders);
	let calls = $state<PanelCall[]>(data.snapshot.calls);
	let seen = $state<Set<string>>(new Set());
	let conn = $state<'connecting' | 'live' | 'reconnecting'>('connecting');
	let longDown = $state(false);
	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	// Plain (non-reactive) bookkeeping: ids already announced, and disconnect timing.
	const known = new Set<string>(orders.map((o) => o.id));
	let downSince: number | null = null;
	let wasDown = false;

	const isNewStatus = (s: OrderStatus) => s === 'awaiting_approval' || s === 'received';
	const unseenOrders = $derived(orders.filter((o) => isNewStatus(o.status) && !seen.has(o.id)));
	const unseen = $derived(unseenOrders.length);

	const columns = $derived({
		incoming: orders.filter((o) => isNewStatus(o.status)).sort(byCreated),
		cooking: orders.filter((o) => o.status === 'preparing').sort(byCreated),
		ready: orders.filter((o) => o.status === 'ready').sort(byCreated),
		served: orders.filter((o) => o.status === 'served').sort(byCreated).slice(-10).reverse(),
		cancelled: orders.filter((o) => o.status === 'cancelled').sort(byCreated).slice(-10).reverse()
	});

	function allowedActions(o: OrderDetail): OrderAction[] {
		return (Object.keys(ACTION_RULES) as OrderAction[]).filter((action) => {
			const rule = ACTION_RULES[action];
			if (!rule.roles.includes(role) || !rule.from.includes(o.status)) return false;
			if (action === 'paid') return o.paymentStatus === 'unpaid_in_person';
			return true;
		});
	}

	function markSeen(id: string) {
		if (seen.has(id)) return;
		seen = new Set([...seen, id]);
	}

	function flash(message: string) {
		notice = message;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 3000);
	}

	function upsert(order: OrderDetail) {
		const isNew = isNewStatus(order.status) && !known.has(order.id);
		known.add(order.id);
		orders = [...orders.filter((o) => o.id !== order.id), order];
		if (isNew) alertSound.alertCall();
	}

	async function resync() {
		try {
			const res = await fetch('/api/panel/orders');
			if (!res.ok) return;
			const snapshot = (await res.json()) as { orders: OrderDetail[]; calls: PanelCall[] };
			orders = snapshot.orders;
			calls = snapshot.calls;
			for (const o of snapshot.orders) known.add(o.id);
		} catch {
			// keep showing the last known state; the stream will retry
		}
	}

	async function act(o: OrderDetail, action: OrderAction) {
		if (action === 'cancel' && !confirm('این سفارش لغو شود؟')) return;
		const previous = orders;
		markSeen(o.id);
		const rule = ACTION_RULES[action];
		orders = orders.map((x) =>
			x.id === o.id
				? {
						...x,
						status: rule.to ?? x.status,
						paymentStatus: action === 'paid' ? 'paid' : x.paymentStatus
					}
				: x
		);
		try {
			const res = await fetch(`/api/panel/orders/${o.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action })
			});
			const body = (await res.json()) as OrderDetail & { message?: string };
			if (!res.ok) {
				orders = previous;
				flash(body.message ?? 'این کار انجام نشد.');
				return;
			}
			upsert(body);
		} catch {
			orders = previous;
			flash('اتصال برقرار نشد. دوباره تلاش کنید.');
		}
	}

	async function resolveCall(call: PanelCall) {
		const previous = calls;
		calls = calls.filter((c) => c.id !== call.id);
		try {
			const res = await fetch(`/api/panel/calls/${call.id}/resolve`, { method: 'POST' });
			if (!res.ok) {
				calls = previous;
				flash('این درخواست انجام نشد.');
			}
		} catch {
			calls = previous;
			flash('اتصال برقرار نشد.');
		}
	}

	function tableLabel(o: OrderDetail): string {
		return o.tableNumber ? `میز ${formatNumber(o.tableNumber)}` : 'بیرون‌بر';
	}

	function scrollToFirstUnseen() {
		const first = unseenOrders[0];
		if (!first) return;
		markSeen(first.id);
		document.getElementById(`order-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	$effect(() => {
		document.title = unseen > 0 ? `(${formatNumber(unseen)}) سفارش جدید · پنل سفارش‌ها` : 'پنل سفارش‌ها';
	});

	$effect(() => {
		alertSound.syncRepeat(unseen > 0);
	});

	onMount(() => {
		const stop = connectLive('/api/panel/stream', {
			onOpen: () => {
				conn = 'live';
				longDown = false;
				downSince = null;
				if (wasDown) void resync();
				wasDown = false;
			},
			onError: () => {
				conn = 'reconnecting';
				wasDown = true;
				downSince ??= Date.now();
			},
			events: {
				'order.upsert': (d) => upsert(d as OrderDetail),
				'call.created': (d) => {
					const call = d as PanelCall;
					calls = [...calls.filter((c) => c.id !== call.id), call];
					alertSound.alertCall();
				},
				'call.resolved': (d) => {
					const { id } = d as { id: number };
					calls = calls.filter((c) => c.id !== id);
				}
			}
		});

		const watchdog = setInterval(() => {
			if (downSince && Date.now() - downSince > 30_000) longDown = true;
		}, 5_000);

		const onVisible = () => alertSound.reacquireWakeLock();
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			stop();
			clearInterval(watchdog);
			document.removeEventListener('visibilitychange', onVisible);
			alertSound.syncRepeat(false);
		};
	});
</script>

<svelte:head>
	<title>پنل سفارش‌ها</title>
</svelte:head>

<div class="flex flex-col gap-4 pb-10">
	<section class="flex flex-wrap items-center gap-3 px-4 pt-4 text-sm">
		<span class="rounded-full px-2.5 py-1 text-xs {conn === 'live' ? 'bg-surface-2 text-success' : 'bg-surface-2 text-muted'}" aria-live="polite">
			{conn === 'live' ? 'زنده' : conn === 'reconnecting' ? 'در حال اتصال مجدد…' : 'در حال اتصال…'}
		</span>

		{#if !alertSound.unlocked}
			<button type="button" onclick={() => alertSound.unlock()} class="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary">
				فعال‌سازی صدای سفارش
			</button>
		{:else}
			<div class="flex flex-wrap items-center gap-3 text-xs text-muted">
				<label class="flex items-center gap-2">
					<input type="checkbox" checked={alertSound.settings.enabled} onchange={(e) => alertSound.update({ enabled: (e.currentTarget as HTMLInputElement).checked })} />
					صدا
				</label>
				<label class="flex items-center gap-2">
					حجم
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={alertSound.settings.volume}
						oninput={(e) => alertSound.update({ volume: Number((e.currentTarget as HTMLInputElement).value) })}
						class="w-24 accent-[var(--c-primary)]"
					/>
				</label>
				<label class="flex items-center gap-2">
					<input type="checkbox" checked={alertSound.settings.repeat} onchange={(e) => alertSound.update({ repeat: (e.currentTarget as HTMLInputElement).checked })} />
					یادآوری هر ۳۰ ثانیه
				</label>
				<label class="flex items-center gap-2">
					<input type="checkbox" checked={alertSound.settings.synthVoice} onchange={(e) => alertSound.update({ synthVoice: (e.currentTarget as HTMLInputElement).checked })} />
					گفتن «سفارش جدید» با صدا
				</label>
				<label class="flex items-center gap-2">
					<input type="checkbox" checked={alertSound.settings.callSound} onchange={(e) => alertSound.update({ callSound: (e.currentTarget as HTMLInputElement).checked })} />
					صدای جدا برای درخواست گارسون
				</label>
				<button type="button" onclick={() => alertSound.play()} class="rounded-lg border border-border px-2 py-1">آزمایش صدا</button>
				<span>{alertSound.wakeLockActive ? 'صفحه روشن می‌ماند' : ''}</span>
			</div>
		{/if}
	</section>

	{#if longDown}
		<div role="alert" class="mx-4 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
			<span>اتصال بیش از ۳۰ ثانیه قطع بوده. ممکن است سفارشی جا مانده باشد.</span>
			<button type="button" onclick={resync} class="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary">تازه‌سازی</button>
		</div>
	{/if}

	{#if unseen > 0}
		<button type="button" onclick={scrollToFirstUnseen} class="mx-4 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary">
			{formatNumber(unseen)} سفارش جدید دیده‌نشده
		</button>
	{/if}

	{#if notice}
		<p role="status" class="mx-4 rounded-xl bg-surface-2 px-3 py-2 text-sm text-danger">{notice}</p>
	{/if}

	{#if calls.length > 0}
		<section class="flex gap-2 overflow-x-auto px-4" aria-label="درخواست‌های مشتری">
			{#each calls as call (call.id)}
				<div class="flex shrink-0 items-center gap-3 rounded-2xl bg-surface p-3 text-sm">
					<span class="font-bold">میز {formatNumber(call.tableNumber)}</span>
					<span class="text-muted">{call.kind === 'waiter' ? 'گارسون' : 'صورتحساب'}</span>
					<button type="button" onclick={() => resolveCall(call)} class="rounded-lg border border-border px-2.5 py-1.5 text-xs">انجام شد</button>
				</div>
			{/each}
		</section>
	{/if}

	<main class="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-6 md:grid md:grid-cols-5 md:overflow-visible">
		{#each [
			{ key: 'incoming', title: 'جدید', list: columns.incoming },
			{ key: 'cooking', title: 'در حال آماده‌سازی', list: columns.cooking },
			{ key: 'ready', title: 'آماده', list: columns.ready },
			{ key: 'served', title: 'تحویل‌شده', list: columns.served },
			{ key: 'cancelled', title: 'لغوشده', list: columns.cancelled }
		] as col (col.key)}
			<section class="flex w-[82vw] shrink-0 snap-start flex-col gap-2 md:w-auto" aria-label={col.title}>
				<h2 class="flex items-center justify-between px-1 text-sm font-bold">
					{col.title}
					<span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">{formatNumber(col.list.length)}</span>
				</h2>

				{#each col.list as o (o.id)}
					<article
						id="order-{o.id}"
						class="flex flex-col gap-2 rounded-2xl border bg-surface p-3 {isNewStatus(o.status) && !seen.has(o.id) ? 'border-primary' : 'border-border'}"
						onpointerdown={() => markSeen(o.id)}
					>
						<div class="flex items-center justify-between gap-2">
							<span class="font-bold">{tableLabel(o)}</span>
							<span class="text-xs tabular-nums text-muted">#{formatNumber(Number(o.publicCode))} · {formatTime(o.createdAt)}</span>
						</div>

						<ul class="flex flex-col gap-1 text-sm">
							{#each o.items as item (item.id)}
								<li>
									{formatNumber(item.qty)} × {item.name}
									{#if item.options.length > 0}
										<span class="text-xs text-muted">({item.options.map((x) => x.name).join('، ')})</span>
									{/if}
									{#if item.note}
										<span class="block text-xs font-bold">یادداشت: {item.note}</span>
									{/if}
								</li>
							{/each}
						</ul>

						{#if o.note}
							<p class="rounded-lg bg-surface-2 px-2 py-1 text-xs">یادداشت سفارش: {o.note}</p>
						{/if}

						<div class="flex items-center justify-between text-xs text-muted">
							<span>{PAYMENT_LABELS[o.paymentStatus]} · {STATUS_LABELS[o.status]}</span>
							<span class="font-bold tabular-nums text-text">{formatMoney(o.total)}</span>
						</div>

						{#if allowedActions(o).length > 0}
							<div class="flex flex-wrap gap-2 pt-1">
								{#each allowedActions(o) as action (action)}
									<button
										type="button"
										onclick={() => act(o, action)}
										class="min-h-11 flex-1 rounded-xl px-3 text-sm font-bold {action === 'cancel'
											? 'border border-border text-muted'
											: 'bg-primary text-on-primary'}"
									>
										{ACTION_LABELS[action]}
									</button>
								{/each}
							</div>
						{/if}
					</article>
				{:else}
					<p class="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted">سفارشی نیست.</p>
				{/each}
			</section>
		{/each}
	</main>
</div>
