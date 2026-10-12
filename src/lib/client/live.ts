export type LiveHandlers = {
	onOpen?: () => void;
	onError?: () => void;
	events: Record<string, (data: unknown) => void>;
};

/** Opens an SSE connection. EventSource reconnects by itself; callers resync on reopen. */
export function connectLive(url: string, handlers: LiveHandlers): () => void {
	const source = new EventSource(url);
	source.onopen = () => handlers.onOpen?.();
	source.onerror = () => handlers.onError?.();
	for (const [type, listener] of Object.entries(handlers.events)) {
		source.addEventListener(type, (event) => {
			try {
				listener(JSON.parse((event as MessageEvent<string>).data));
			} catch {
				// Ignore malformed frames; the next snapshot resyncs state.
			}
		});
	}
	return () => source.close();
}
