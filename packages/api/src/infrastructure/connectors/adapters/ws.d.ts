/** Minimal type declaration for ws — transitive dep without @types/ws */
declare module 'ws' {
	class WebSocket {
		static readonly OPEN: number;
		readonly readyState: number;
		constructor(url: string, options?: Record<string, unknown>);
		send(data: string, cb?: (err?: Error) => void): void;
		ping(): void;
		terminate(): void;
		close(): void;
		removeAllListeners(): void;
		on(event: 'open', cb: () => void): void;
		on(event: 'close', cb: () => void): void;
		on(event: 'error', cb: (err: unknown) => void): void;
		on(event: 'message', cb: (data: Buffer) => void): void;
		on(event: 'pong', cb: () => void): void;
	}
	export default WebSocket;
}
