<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let cafe = $state(data.cafe);
	let menu = $state(data.menu);

	const money = (n: number) => n.toLocaleString('fa-IR');

	// ---------- settings form ----------
	let settingsMsg = $state('');
	let settingsBusy = $state(false);
	let merchantId = $state(data.zarinpalMerchantId ?? '');
	let soundStyle = $state<'chime' | 'bell' | 'ding'>(data.soundStyle ?? 'chime');
	let speakNewOrder = $state(data.speakNewOrder ?? false);

	async function saveSettings() {
		settingsBusy = true;
		settingsMsg = '';
		try {
			const res = await fetch('/api/admin/settings', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: cafe.name,
					tagline: cafe.tagline,
					taxPercent: cafe.taxPercent,
					servicePercent: cafe.servicePercent,
					orderingEnabled: cafe.orderingEnabled,
					requireApproval: cafe.requireApproval,
					theme: cafe.theme,
					primaryColor: cafe.primaryColor,
					currencyUnit: cafe.currencyUnit,
					menuLayout: cafe.menuLayout,
					cornerStyle: cafe.cornerStyle,
					welcomeMessage: cafe.welcomeMessage,
					faDigits: cafe.faDigits,
					secondLanguage: cafe.secondLanguage,
					workingHours: cafe.workingHours,
					enableOnlinePay: cafe.enableOnlinePay,
					enableInPersonPay: cafe.enableInPersonPay,
					enableTakeaway: cafe.enableTakeaway,						enableRatings: cafe.enableRatings,
						soundStyle,
						speakNewOrder,
						zarinpalMerchantId: merchantId.trim() || null
					})
			});
			const out = await res.json().catch(() => ({}));
			settingsMsg = res.ok ? 'تنظیمات ذخیره شد.' : out.message ?? 'ذخیره نشد.';
		} catch {
			settingsMsg = 'اتصال برقرار نشد.';
		} finally {
			settingsBusy = false;
		}
	}

	// ---------- item editor ----------
	type AdminItem = (typeof menu)[number]['items'][number];
	let editing: AdminItem | null = $state(null);
	let editorMsg = $state('');
	let busy = $state(false);

	function openNew(categoryId: number) {
		editing = {
			id: 0,
			categoryId,
			name: '',
			description: '',
			basePrice: 0,
			isAvailable: true,
			isNew: false,
			isBestseller: false,
			tags: [],
			allergens: [],
			groups: []
		};
		editorMsg = '';
	}

	function openEdit(item: AdminItem) {
		editing = JSON.parse(JSON.stringify(item));
		editorMsg = '';
	}

	function closeEditor() {
		editing = null;
	}

	async function refresh() {
		const [cafeRes, menuRes] = await Promise.all([fetch('/api/cafe-info'), fetch('/api/admin/menu')]);
		if (cafeRes.ok) cafe = await cafeRes.json();
		if (menuRes.ok) menu = await menuRes.json();
	}

	async function saveItem() {
		if (!editing) return;
		busy = true;
		editorMsg = '';
		try {
			const isNew = editing.id === 0;
			const res = await fetch(isNew ? '/api/admin/menu' : `/api/admin/items/${editing.id}`, {
				method: isNew ? 'POST' : 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(editing)
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok) {
				editorMsg = out.message ?? 'ذخیره نشد.';
				return;
			}
			closeEditor();
			await refresh();
		} catch {
			editorMsg = 'اتصال برقرار نشد.';
		} finally {
			busy = false;
		}
	}

	async function removeItem(item: AdminItem) {
		if (!confirm(`«${item.name}» حذف شود؟ سابقه سفارش‌های قبلی حفظ می‌شود.`)) return;
		busy = true;
		try {
			const res = await fetch(`/api/admin/items/${item.id}`, { method: 'DELETE' });
			if (!res.ok) {
				const out = await res.json().catch(() => ({}));
				editorMsg = out.message ?? 'حذف نشد.';
				return;
			}
			await refresh();
		} finally {
			busy = false;
		}
	}

	// ---------- category editor ----------
	let categoryMsg = $state('');

	async function addCategory() {
		const name = prompt('نام دسته‌ی جدید:');
		if (!name?.trim()) return;
		categoryMsg = '';
		try {
			const res = await fetch('/api/admin/menu', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: 'category', name: name.trim() })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok) categoryMsg = out.message ?? 'ساخته نشد.';
			else await refresh();
		} catch {
			categoryMsg = 'اتصال برقرار نشد.';
		}
	}

	async function toggleCategory(cat: (typeof menu)[number]) {
		categoryMsg = '';
		try {
			const res = await fetch(`/api/admin/categories/${cat.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name: cat.name, isActive: !cat.isActive })
			});
			if (!res.ok) {
				const out = await res.json().catch(() => ({}));
				categoryMsg = out.message ?? 'تغییر وضعیت نشد.';
				return;
			}
			await refresh();
		} catch {
			categoryMsg = 'اتصال برقرار نشد.';
		}
	}

	// ---------- helpers for editor groups ----------
	function addGroup() {
		if (!editing) return;
		editing.groups.push({ id: 0, name: 'گزینه‌ها', kind: 'single' as const, required: false, minSelect: 0, maxSelect: 10, options: [{ id: 0, name: '', priceDelta: 0, isAvailable: true }] });
	}

	async function importCsv(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		categoryMsg = 'در حال واردات…';
		try {
			const res = await fetch('/api/admin/import', {
				method: 'POST',
				headers: { 'content-type': 'text/csv' },
				body: await file.text()
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok) {
				categoryMsg = out.message ?? 'واردات انجام نشد.';
				return;
			}
			categoryMsg = `${out.createdItems} آیتم وارد شد.`;
			await refresh();
		} catch {
			categoryMsg = 'اتصال برقرار نشد.';
		} finally {
			input.value = '';
		}
	}

	function removeGroup(index: number) {
		editing?.groups.splice(index, 1);
	}

	function removeOption(gi: number, oi: number) {
		editing?.groups[gi]?.options.splice(oi, 1);
	}

	function addOption(gi: number) {
		editing?.groups[gi]?.options.push({ id: 0, name: '', priceDelta: 0, isAvailable: true });
	}
</script>

<main class="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-24 pt-4">
	<!-- settings -->
	<section class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
		<h2 class="text-sm font-bold">تنظیمات کافه</h2>
		<label class="flex flex-col gap-1">
			<span class="text-xs font-bold">نام کافه</span>
			<input class="rounded-xl border border-border bg-bg p-2 text-sm outline-none focus:border-primary" bind:value={cafe.name} maxlength="60" />
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-xs font-bold">شعار</span>
			<input class="rounded-xl border border-border bg-bg p-2 text-sm outline-none focus:border-primary" bind:value={cafe.tagline} maxlength="120" />
		</label>
		<div class="flex gap-3">
			<label class="flex flex-1 flex-col gap-1">
				<span class="text-xs font-bold">مالیات (٪)</span>
				<input type="number" min="0" max="50" class="rounded-xl border border-border bg-bg p-2 text-sm outline-none focus:border-primary" bind:value={cafe.taxPercent} />
			</label>
			<label class="flex flex-1 flex-col gap-1">
				<span class="text-xs font-bold">حق خدمات (٪)</span>
				<input type="number" min="0" max="50" class="rounded-xl border border-border bg-bg p-2 text-sm outline-none focus:border-primary" bind:value={cafe.servicePercent} />
			</label>
		</div>
		<label class="flex items-center justify-between rounded-xl border border-border p-2">
			<span class="text-xs font-bold">سفارش‌گیری فعال</span>
			<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={cafe.orderingEnabled} />
		</label>
		<label class="flex items-center justify-between rounded-xl border border-border p-2">
			<span class="text-xs font-bold">تأیید سفارش توسط کافه</span>
			<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={cafe.requireApproval} />
		</label>
		<div class="flex items-center justify-between">							<button type="button" class="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-50" onclick={saveSettings} disabled={settingsBusy}>
								ذخیره تنظیمات
							</button>
							<a href="/admin/reports" class="h-10 rounded-xl border border-border px-4 text-xs font-bold leading-10 hover:bg-surface-2">گزارش فروش</a>
							<a href="/admin/tables" class="h-10 rounded-xl border border-border px-4 text-xs font-bold leading-10 hover:bg-surface-2">میزها و QR</a>
							<a href="/admin/users" class="h-10 rounded-xl border border-border px-4 text-xs font-bold leading-10 hover:bg-surface-2">کاربران</a>
							<a href="/admin/license" class="h-10 rounded-xl border border-border px-4 text-xs font-bold leading-10 hover:bg-surface-2">لایسنس {data.license.mode === 'licensed' ? '✓' : ' '}</a>
			<span class="text-xs text-muted">{settingsMsg}</span>
		</div>
	</section>

	<!-- Appearance & sounds -->
	<section class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
		<h2 class="text-sm font-bold">ظاهر و پنل</h2>
		<label class="flex flex-col gap-1">
			<span class="text-xs font-bold">تم</span>
			<select class="rounded-xl border border-border bg-bg p-2 text-sm outline-none focus:border-primary" bind:value={cafe.theme}>
				{#each ['latte', 'espresso', 'matcha', 'rose', 'sahara', 'midnight', 'pistachio', 'cherry'] as t}
					<option value={t}>{t}</option>
				{/each}
			</select>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-xs font-bold">رنگ اصلی (برند)</span>
			<input type="color" class="h-10 w-20 rounded border border-border" bind:value={cafe.primaryColor} />
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-xs font-bold">پیام خوشامدگویی</span>
			<input class="rounded-xl border border-border bg-bg p-2 text-sm outline-none" bind:value={cafe.welcomeMessage} maxlength="200" />
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-xs font-bold">ساعت کاری</span>
			<input class="rounded-xl border border-border bg-bg p-2 text-sm outline-none" bind:value={cafe.workingHours} placeholder="۸ تا ۲۳" maxlength="200" />
		</label>
		<div class="flex flex-wrap gap-3">
			<label class="flex items-center gap-2 text-xs font-bold"><input type="radio" name="cur" checked={cafe.currencyUnit === 'toman'} onchange={() => (cafe.currencyUnit = 'toman')} /> ریال؟ نه، تومان</label>
			<label class="flex items-center gap-2 text-xs font-bold"><input type="radio" name="cur" checked={cafe.currencyUnit === 'rial'} onchange={() => (cafe.currencyUnit = 'rial')} /> ریال</label>
		</div>
		<label class="flex items-center justify-between rounded-xl border border-border p-2">
			<span class="text-xs font-bold">ارقام فارسی</span>
			<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={cafe.faDigits} />
		</label>
		<label class="flex items-center justify-between rounded-xl border border-border p-2">
			<span class="text-xs font-bold">پرداخت آنلاین (زرین‌پال)</span>
			<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={cafe.enableOnlinePay} />
		</label>
		{#if cafe.enableOnlinePay}
			<label class="flex flex-col gap-1">
				<span class="text-xs font-bold">مرچنت‌کد زرین‌پال</span>
				<input class="rounded-xl border border-border bg-bg p-2 text-xs font-mono outline-none" bind:value={merchantId} placeholder="32-64 hex" />
			</label>
		{/if}
		<label class="flex items-center justify-between rounded-xl border border-border p-2">
			<span class="text-xs font-bold">پرداخت حضوری</span>
			<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={cafe.enableInPersonPay} />
		</label>
		<label class="flex items-center justify-between rounded-xl border border-border p-2">
			<span class="text-xs font-bold">بیرون‌بر</span>
			<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={cafe.enableTakeaway} />
		</label>
		<label class="flex items-center justify-between rounded-xl border border-border p-2">
			<span class="text-xs font-bold">نظرسنجی ۵ستاره بعد از تحویل</span>
			<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={cafe.enableRatings} />
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-xs font-bold">صدای اعلان پنل</span>
			<select class="rounded-xl border border-border bg-bg p-2 text-sm outline-none" bind:value={soundStyle}>
				<option value="chime">کایم</option>
				<option value="bell">زنگ</option>
				<option value="ding">دینگ</option>
			</select>
		</label>
		<label class="flex items-center justify-between rounded-xl border border-border p-2">
			<span class="text-xs font-bold">گفتن «سفارش جدید» با صدا</span>
			<input type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]" bind:checked={speakNewOrder} />
		</label>
		<button type="button" class="h-10 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-50" onclick={saveSettings} disabled={settingsBusy}>ذخیره تنظیمات</button>
	</section>

	<!-- menu -->
	<section class="flex flex-col gap-4">
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-sm font-bold">منو ({menu.reduce((n, c) => n + c.items.length, 0)} آیتم)</h2>
			<div class="flex items-center gap-1.5">
				<label class="h-9 cursor-pointer rounded-xl border border-border px-3 text-xs font-bold leading-9 hover:bg-surface-2">
					واردات CSV
					<input type="file" accept=".csv,text/csv" class="hidden" onchange={importCsv} />
				</label>
				<button type="button" class="h-9 rounded-xl bg-primary px-3 text-xs font-bold text-on-primary" onclick={addCategory}>+ دسته‌ی جدید</button>
			</div>
		</div>
		{#if categoryMsg}<p class="rounded-xl bg-surface-2 px-3 py-2 text-xs text-danger">{categoryMsg}</p>{/if}

		{#each menu as cat (cat.id)}
			<div class="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-bold {cat.isActive ? '' : 'text-muted line-through'}">{cat.name}</h3>
					<div class="flex gap-2">
						<button type="button" class="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-surface-2" onclick={() => toggleCategory(cat)}>
							{cat.isActive ? 'غیرفعال' : 'فعال'}
						</button>
						<button type="button" class="rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-on-primary" onclick={() => openNew(cat.id)}>+ آیتم</button>
					</div>
				</div>

				{#if cat.items.length === 0}
					<p class="text-xs text-muted">آیتمی ندارد.</p>
				{/if}
				{#each cat.items as item (item.id)}
					<article class="flex items-center justify-between rounded-xl border border-border bg-bg p-2.5">
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-1.5">
								<span class="text-xs font-bold {item.isAvailable ? '' : 'text-muted line-through'}">{item.name}</span>
								{#if item.isNew}<span class="rounded-full bg-accent px-1.5 text-[10px]">جدید</span>{/if}
								{#if item.isBestseller}<span class="rounded-full bg-accent px-1.5 text-[10px]">پرفروش</span>{/if}
								<span class="text-[10px] text-muted">{item.groups.reduce((n, g) => n + g.options.length, 0)} گزینه</span>
							</div>
							<p class="text-xs tabular-nums">{money(item.basePrice)} تومان</p>
						</div>
						<div class="flex gap-1.5">
							<button type="button" class="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-surface-2" onclick={() => openEdit(item)}>ویرایش</button>
							<button type="button" class="rounded-lg border border-danger px-2 py-1 text-[11px] font-bold text-danger hover:bg-surface-2" onclick={() => removeItem(item)}>حذف</button>
						</div>
					</article>
				{/each}
			</div>
		{/each}
	</section>
</main>

{#if editing}
	<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40" role="presentation" onclick={(e) => e.target === e.currentTarget && closeEditor()}>
		<div class="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-bg p-4 pb-10">
			<h2 class="mb-3 text-sm font-bold">{editing.id === 0 ? 'آیتم جدید' : `ویرایش «${editing.name}»`}</h2>

			<div class="flex flex-col gap-3">
				<label class="flex flex-col gap-1">
					<span class="text-xs font-bold">نام</span>
					<input class="rounded-xl border border-border bg-surface p-2 text-sm outline-none focus:border-primary" bind:value={editing.name} maxlength="120" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs font-bold">توضیح</span>
					<textarea class="resize-none rounded-xl border border-border bg-surface p-2 text-sm outline-none focus:border-primary" bind:value={editing.description} rows="2" maxlength="400"></textarea>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-xs font-bold">قیمت پایه (تومان)</span>
					<input type="number" min="0" class="rounded-xl border border-border bg-surface p-2 text-sm tabular-nums outline-none focus:border-primary" bind:value={editing.basePrice} />
				</label>
				<div class="flex gap-3">
					<label class="flex items-center gap-2 text-xs font-bold"><input type="checkbox" class="h-4 w-4 accent-[var(--c-primary)]" bind:checked={editing.isAvailable} /> موجود</label>
					<label class="flex items-center gap-2 text-xs font-bold"><input type="checkbox" class="h-4 w-4 accent-[var(--c-primary)]" bind:checked={editing.isNew} /> جدید</label>
					<label class="flex items-center gap-2 text-xs font-bold"><input type="checkbox" class="h-4 w-4 accent-[var(--c-primary)]" bind:checked={editing.isBestseller} /> پرفروش</label>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each ['vegan', 'gluten_free', 'spicy'] as tag (tag)}
						{@const tagItem = tag as 'vegan' | 'gluten_free' | 'spicy'}
						<label class="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] font-bold">
							<input type="checkbox" class="h-3.5 w-3.5 accent-[var(--c-primary)]" checked={editing.tags.includes(tagItem)} onchange={(e) => { if (!editing) return; if (e.currentTarget.checked) editing.tags.push(tagItem); else editing.tags = editing.tags.filter((t) => t !== tagItem); }} />
							{tag === 'vegan' ? 'وگان' : tag === 'gluten_free' ? 'بدون گلوتن' : 'تند'}
						</label>
					{/each}
				</div>
				<label class="flex flex-col gap-1">
					<span class="text-xs font-bold">آلرژن‌ها (با کاما جدا کنید)</span>
					<input class="rounded-xl border border-border bg-surface p-2 text-xs outline-none focus:border-primary" value={editing.allergens.join('، ')} onchange={(e) => { if (!editing) return; editing.allergens = e.currentTarget.value.split(/[،,]/).map((s) => s.trim()).filter(Boolean); }} />
				</label>

				<div class="flex flex-col gap-2 border-t border-border pt-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold">گروه‌های گزینه ({editing.groups.length})</span>
						<button type="button" class="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-surface-2" onclick={addGroup}>+ گروه</button>
					</div>
					{#each editing.groups as group, gi (gi)}
						<div class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2">
							<div class="flex items-center gap-2">
								<input class="min-w-0 flex-1 rounded-lg border border-border bg-bg p-1.5 text-xs outline-none focus:border-primary" bind:value={group.name} placeholder="نام گروه" />
								<select class="rounded-lg border border-border bg-bg p-1.5 text-xs outline-none" bind:value={group.kind}>
									<option value="single">تک‌انتخابی</option>
									<option value="multi">چندانتخابی</option>
								</select>
								<label class="flex items-center gap-1 whitespace-nowrap text-[11px] font-bold"><input type="checkbox" class="h-3.5 w-3.5 accent-[var(--c-primary)]" bind:checked={group.required} /> الزامی</label>
								<button type="button" class="rounded-lg px-1.5 text-danger" aria-label="حذف گروه" onclick={() => removeGroup(gi)}>✕</button>
							</div>
							{#each group.options as option, oi (oi)}
								<div class="flex items-center gap-1.5">
									<input class="min-w-0 flex-1 rounded-lg border border-border bg-bg p-1.5 text-xs outline-none focus:border-primary" bind:value={option.name} placeholder="نام گزینه" />
									<input type="number" class="w-24 rounded-lg border border-border bg-bg p-1.5 text-xs tabular-nums outline-none focus:border-primary" bind:value={option.priceDelta} placeholder="±تومان" />
									<label class="flex items-center whitespace-nowrap text-[10px]"><input type="checkbox" class="h-3 w-3 accent-[var(--c-primary)]" bind:checked={option.isAvailable} /> موجود</label>
									<button type="button" class="rounded-lg px-1 text-danger" aria-label="حذف گزینه" onclick={() => removeOption(gi, oi)}>✕</button>
								</div>
							{/each}
							<button type="button" class="self-start rounded-lg border border-border px-2 py-0.5 text-[11px] font-bold hover:bg-surface-2" onclick={() => addOption(gi)}>+ گزینه</button>
						</div>
					{/each}
				</div>

				{#if editorMsg}<p class="rounded-xl bg-surface-2 px-3 py-2 text-xs text-danger">{editorMsg}</p>{/if}

				<div class="sticky bottom-0 flex gap-2 bg-bg pt-2">
					<button type="button" class="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-on-primary disabled:opacity-50" onclick={saveItem} disabled={busy}>ذخیره</button>
					<button type="button" class="h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-surface-2" onclick={closeEditor}>انصراف</button>
				</div>
			</div>
		</div>
	</div>
{/if}
