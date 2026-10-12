import { EventEmitter } from 'node:events';

export type RealtimeEvent = { type: string; data: unknown };

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publish(channel: string, event: RealtimeEvent): void {
	bus.emit(channel, event);
}

export function subscribe(channel: string, listener: (event: RealtimeEvent) => void): () => void {
	bus.on(channel, listener);
	return () => bus.off(channel, listener);
}

export function sseResponse(
	request: Request,
	channel: string,
	options: { initial?: RealtimeEvent; filter?: (event: RealtimeEvent) => boolean } = {}
): Response {
	const encoder = new TextEncoder();
	let teardown: () => void = () => {};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let closed = false;
			const write = (chunk: string) => {
				if (!closed) controller.enqueue(encoder.encode(chunk));
			};
			const send = (event: RealtimeEvent) => {
				if (options.filter && !options.filter(event)) return;
				write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
			};

			write('retry: 2000\n\n');
			if (options.initial) send(options.initial);

			const unsubscribe = subscribe(channel, send);
			const heartbeat = setInterval(() => write(': ping\n\n'), 15_000);

			teardown = () => {
				if (closed) return;
				closed = true;
				clearInterval(heartbeat);
				unsubscribe();
				try {
					controller.close();
				} catch {
					// already closed by the client
				}
			};
			request.signal.addEventListener('abort', teardown);
		},
		cancel() {
			teardown();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-store',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
}
