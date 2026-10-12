export type CallKind = 'waiter' | 'bill';

export const CALL_SUCCESS: Record<CallKind, string> = {
	waiter: 'گارسون در راه است.',
	bill: 'درخواست صورتحساب ثبت شد.'
};

export async function requestCall(tableNumber: number, kind: CallKind): Promise<string> {
	try {
		const res = await fetch('/api/calls', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ tableNumber, kind })
		});
		const body = (await res.json().catch(() => ({}))) as { message?: string };
		return res.ok ? CALL_SUCCESS[kind] : (body.message ?? 'ثبت نشد. دوباره تلاش کنید.');
	} catch {
		return 'اتصال برقرار نشد. دوباره تلاش کنید.';
	}
}
