<script lang="ts">
	import { goto } from '$app/navigation';
	import { ROLE_LABELS } from '#lib/shared/status';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		await goto('/login', { replaceState: true });
	}
</script>

<div class="min-h-dvh">
	<header class="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-bold">پنل سفارش‌ها</p>
			<p class="truncate text-xs text-muted">{data.user.name} · {ROLE_LABELS[data.user.role]}</p>
		</div>
		<a href="/kitchen" class="h-10 rounded-xl bg-surface-2 px-3 text-sm leading-10">آشپزخانه</a>
		<button type="button" onclick={logout} class="h-10 rounded-xl border border-border px-3 text-sm">خروج</button>
	</header>
	{@render children()}
</div>
