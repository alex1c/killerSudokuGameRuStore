/**
 * Cooperative event-loop yield for background generation (Phase 6Q).
 * Gives React Native a chance to paint / handle input between expensive stages.
 */

export function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0)
	})
}

export interface GenerationCancelToken {
	readonly cancelled: boolean
	cancel(): void
}

export function createGenerationCancelToken(): GenerationCancelToken {
	let cancelled = false
	return {
		get cancelled() {
			return cancelled
		},
		cancel() {
			cancelled = true
		},
	}
}

export class GenerationCancelledError extends Error {
	constructor(message = 'Killer puzzle generation cancelled') {
		super(message)
		this.name = 'GenerationCancelledError'
	}
}
