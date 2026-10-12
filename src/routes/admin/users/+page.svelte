<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let username = $state('');
	let role = $state<'cashier' | 'kitchen'>('cashier');
	let password = $state('');
	let msg = $state('');

	const ROLE_LABELS = { owner: 'مدیر', cashier: 'صندوق', kitchen: 'آشپزخانه' } as const;

	async function create() {
		msg = '';
		const res = await fetch('/api/admin/users', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, username, role, password })
		});
		const out = await res.json().catch(() => ({}));
		if (!res.ok) {
			msg = out.message ?? 'ساخته نشد.';
			return;
		}
		msg = 'ساخته شد. رمز اولیه را برای همکار بفرستید.';
		name = username = password = '';
		window.location.reload();
	}

	async function toggle(id: number, isActive: boolean) {
		await fetch('/api/admin/users', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id, isActive: !isActive })
		});
		window.location.reload();
	}
</script>

<main class="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-4">
	<h1 class="text-base font-bold">کاربران پنل</h1>

	<section class="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
		<h2 class="text-sm font-bold">کاربر جدید</h2>
		<div class="flex gap-2">
			<input class="min-w-0 flex-1 rounded-xl border border-border bg-bg p-2 text-sm outline-none" bind:value={name} placeholder="نام" />
			<input class="min-w-0 flex-1 rounded-xl border border-border bg-bg p-2 text-sm outline-none" bind:value={username} placeholder="username" dir="ltr" />
		</div>
		<div class="flex gap-2">
			<select class="flex-1 rounded-xl border border-border bg-bg p-2 text-sm outline-none" bind:value={role}>
				<option value="cashier">صندوق</option>
				<option value="kitchen">آشپزخانه</option>
			</select>
			<input class="flex-1 rounded-xl border border-border bg-bg p-2 text-sm outline-none" bind:value={password} placeholder="رمز اولیه (حداقل ۸)" />
		</div>
		<button type="button" class="h-10 rounded-xl bg-primary text-xs font-bold text-on-primary" onclick={create} disabled={!name || !username || password.length < 8}>ساخت کاربر</button>
		{#if msg}<p class="text-xs text-muted">{msg}</p>{/if}
	</section>

	<section class="flex flex-col gap-2">
		{#each data.users as u (u.id)}
			<article class="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
				<div class="min-w-0 flex-1">
					<p class="font-bold">{u.name}</p>
					<p class="text-xs text-muted" dir="ltr">{u.username} · {ROLE_LABELS[u.role]}</p>
				</div>
				<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {u.isActive ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted'}">{u.isActive ? 'فعال' : 'غیرفعال'}</span>
				<button type="button" class="rounded-lg border border-border px-2 py-1 text-[11px] font-bold" onclick={() => toggle(u.id, u.isActive)}>{u.isActive ? 'غیرفعال' : 'فعال'}</button>
			</article>
		{/each}
	</section>
</main>
