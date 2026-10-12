<script lang="ts">
	import { animate } from 'motion';
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { Bell, ClipboardList, Receipt, Search, ShoppingBag } from '@lucide/svelte';
	import type { PageData } from './$types';
	import MenuItemCard from '#lib/components/MenuItemCard.svelte';
	import ItemDetailSheet from '#lib/components/ItemDetailSheet.svelte';
	import { cart, type CartLine } from '#lib/client/store.svelte';
	import { formatMoney, formatNumber, normalizeFa } from '#lib/format';
	import type { MenuItem } from '#lib/shared/types';

	let { data }: { data: PageData } = $props();
	const unit = $derived(data.cafe.currencyUnit);

	let query = $state('');
	let activeCat = $state<number | null>(null);
	let openItem = $state<MenuItem | null>(null);
	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	let callBusy = $state(false);
	let countEl = $state<HTMLElement>();
	let lastCount = 0;

	const categories = $derived(data.categories.filter((c) => c.items.length > 0));
	const allItems = $derived(categories.flatMap((c) => c.items));
	const q = $derived(normalizeFa(query));
	const results = $derived(
		q
			? allItems.filter((i) => normalizeFa(i.name).includes(q) || normalizeFa(i.description ?? '').includes(q))
			: []
	);

	function prefersReducedMotion(): boolean {
		return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function vibrate() {
		if (typeof navigator !== 'undefined') navigator.vibrate?.(10);
	}

	function showToast(message: string) {
		toast = message;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 2500);
	}

	// Category nav: first category is active by default, then the scroll position decides.
	$effect(() => {
		if (activeCat === null && categories.length > 0) activeCat = categories[0].id;
	});

	// Scroll-spy: observes category sections while the list is shown (not during search).
	$effect(() => {
		if (q) return;
		const sections = document.querySelectorAll<HTMLElement>('[data-cat]');
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) activeCat = Number((entry.target as HTMLElement).dataset.cat);
				}
			},
			{ rootMargin: '-72px 0px -60% 0px' }
		);
		sections.forEach((s) => observer.observe(s));
		return () => observer.disconnect();
	});

	// Keep the active chip visible inside the horizontal nav.
	$effect(() => {
		if (activeCat === null) return;
		document.getElementById(`chip-${activeCat}`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
	});

	function goToCategory(id: number) {
		activeCat = id;
		document.getElementById(`cat-${id}`)?.scrollIntoView({
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			block: 'start'
		});
	}

	function flyToCart(from: HTMLElement) {
		if (prefersReducedMotion()) return;
		const target = document.getElementById('cart-bar-icon');
		if (!target) return;
		const a = from.getBoundingClientRect();
		const b = target.getBoundingClientRect();
		const dot = document.createElement('div');
		dot.className = 'pointer-events-none fixed z-[60] h-3 w-3 rounded-full bg-primary';
		dot.style.left = `${a.left + a.width / 2 - 6}px`;
		dot.style.top = `${a.top + a.height / 2 - 6}px`;
		document.body.appendChild(dot);
		animate(
			dot,
			{
				transform: ['translate(0px, 0px)', `translate(${b.left - a.left}px, ${b.top - a.top}px)`],
				opacity: [1, 0.3]
			},
			{ duration: 0.55, ease: [0.5, 0, 0.2, 1] }
		).finished.then(() => dot.remove());
	}

	function quickAdd(item: MenuItem, from: HTMLElement) {
		cart.add({ itemId: item.id, name: item.name, unitPrice: item.basePrice, qty: 1, optionIds: [], options: [], note: null });
		vibrate();
		tick().then(() => flyToCart(from));
	}

	function addFromSheet(line: Omit<CartLine, 'key'>) {
		cart.add(line);
		openItem = null;
		vibrate();
		showToast(`${line.name} به سبد اضافه شد.`);
	}

	// Bump the cart counter whenever the count changes.
	$effect(() => {
		const n = cart.count;
		if (countEl && n !== lastCount && n > 0 && !prefersReducedMotion()) {
			animate(countEl, { transform: ['scale(1.3)', 'scale(1)'] }, { duration: 0.22 });
		}
		lastCount = n;
	});

	async function callStaff(kind: 'waiter' | 'bill') {
		if (callBusy) return;
		callBusy = true;
		try {
			const res = await fetch('/api/calls', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ tableNumber: data.tableNumber, kind })
			});
			const body = (await res.json().catch(() => ({}))) as { message?: string };
			showToast(
				res.ok
					? kind === 'waiter'
						? 'گارسون در راه است.'
						: 'درخواست صورتحساب ثبت شد.'
					: (body.message ?? 'ثبت نشد. دوباره تلاش کنید.')
			);
		} catch {
			showToast('اتصال برقرار نشد. دوباره تلاش کنید.');
		} finally {
			callBusy = false;
		}
	}
</script>

<svelte:head>
	<title>{data.cafe.name} · میز {data.tableNumber}</title>
</svelte:head>

<div class="min-h-dvh" style="--c-primary: {data.cafe.primaryColor};">
	<header class="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-3">
		<div class="flex items-center gap-3">
			<div class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-base font-bold text-on-primary" aria-hidden="true">
				{data.cafe.name.charAt(0)}
			</div>
			<div class="min-w-0 flex-1">
				<h1 class="truncate text-base font-bold">{data.cafe.name}</h1>
				<p class="truncate text-xs text-muted">
					میز {formatNumber(data.tableNumber)}{data.cafe.tagline ? ` · ${data.cafe.tagline}` : ''}
				</p>
			</div>
			<a href="/t/{data.tableNumber}/orders" class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2" aria-label="سفارش‌های من">
				<ClipboardList size={20} />
			</a>
		</div>

		{#if !data.cafe.orderingEnabled}
			<p class="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
				سفارش‌گیری الان غیرفعال است. برای سفارش به گارسون اطلاع دهید.
			</p>
		{/if}

		<label class="mt-3 flex h-11 items-center gap-2 rounded-2xl bg-surface-2 px-3">
			<Search size={18} class="shrink-0 text-muted" />
			<input
				type="search"
				bind:value={query}
				placeholder="جست‌وجو در منو"
				class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
			/>
		</label>
	</header>

	{#if !q && categories.length > 0}
		<nav class="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur" aria-label="دسته‌بندی‌ها">
			<div class="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
				{#each categories as cat (cat.id)}
					<button
						id="chip-{cat.id}"
						type="button"
						onclick={() => goToCategory(cat.id)}
						aria-current={activeCat === cat.id ? 'true' : undefined}
						class="shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors {activeCat === cat.id
							? 'bg-primary font-bold text-on-primary'
							: 'bg-surface-2 text-muted'}"
					>
						{cat.name}
					</button>
				{/each}
			</div>
		</nav>
	{/if}

	<main class="px-4 pb-36">
		{#if q}
			{#if results.length === 0}
				<p class="py-16 text-center text-sm text-muted">موردی با «{query.trim()}» پیدا نشد.</p>
			{:else}
				<div class="flex flex-col gap-3 pt-4">
					{#each results as item, i (item.id)}
						<MenuItemCard
							{item}
							{unit}
							index={i}
							count={cart.countFor(item.id)}
							onOpen={() => (openItem = item)}
							onAdd={(el) => quickAdd(item, el)}
							onRemove={() => cart.decrementLast(item.id)}
						/>
					{/each}
				</div>
			{/if}
		{:else}
			{#each categories as cat (cat.id)}
				<section id="cat-{cat.id}" data-cat={cat.id} class="scroll-mt-16 pt-6">
					<h2 class="mb-3 text-lg font-bold">{cat.name}</h2>
					<div class="flex flex-col gap-3">
						{#each cat.items as item, i (item.id)}
							<MenuItemCard
								{item}
								{unit}
								index={i}
								count={cart.countFor(item.id)}
								onOpen={() => (openItem = item)}
								onAdd={(el) => quickAdd(item, el)}
								onRemove={() => cart.decrementLast(item.id)}
							/>
						{/each}
					</div>
				</section>
			{/each}
		{/if}

		<div class="mt-10 grid grid-cols-2 gap-3">
			<button
				type="button"
				onclick={() => callStaff('waiter')}
				disabled={callBusy}
				class="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-sm font-bold disabled:opacity-50"
			>
				<Bell size={18} /> صدا زدن گارسون
			</button>
			<button
				type="button"
				onclick={() => callStaff('bill')}
				disabled={callBusy}
				class="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-sm font-bold disabled:opacity-50"
			>
				<Receipt size={18} /> درخواست صورتحساب
			</button>
		</div>
	</main>

	{#if cart.count > 0}
		<div
			class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]"
			transition:fly={{ y: 80, duration: 240 }}
		>
			<a
				href="/t/{data.tableNumber}/cart"
				class="pointer-events-auto flex h-14 w-full max-w-lg items-center justify-between rounded-2xl bg-primary px-4 text-on-primary shadow-lg"
			>
				<span class="flex items-center gap-2 text-sm">
					<span id="cart-bar-icon" class="grid h-8 w-8 place-items-center rounded-full bg-on-primary/15">
						<ShoppingBag size={18} />
					</span>
					<span bind:this={countEl} class="inline-block font-bold tabular-nums">{formatNumber(cart.count)} آیتم</span>
				</span>
				<span class="flex items-center gap-3 text-sm">
					<span class="font-bold tabular-nums">{formatMoney(cart.total, unit)}</span>
					<span>مشاهده سبد</span>
				</span>
			</a>
		</div>
	{/if}

	{#if toast}
		<div
			role="status"
			aria-live="polite"
			class="fixed inset-x-4 top-4 z-[70] mx-auto max-w-sm rounded-2xl bg-text px-4 py-3 text-center text-sm text-bg shadow-lg"
			transition:fly={{ y: -20, duration: 200 }}
		>
			{toast}
		</div>
	{/if}

	{#if openItem}
		<ItemDetailSheet item={openItem} {unit} onClose={() => (openItem = null)} onAdd={addFromSheet} />
	{/if}
</div>
