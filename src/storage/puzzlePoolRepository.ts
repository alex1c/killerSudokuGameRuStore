/**
 * Persist / load the prepared puzzle pool (separate from active game saves).
 */

import type { StorageAdapter } from './index'
import {
	PUZZLE_POOL_STORAGE_KEY,
	createEmptyPuzzlePool,
	parsePuzzlePool,
	serializePuzzlePool,
	type PuzzlePoolV1,
} from './puzzlePool'

export class PuzzlePoolRepository {
	private readonly adapter: StorageAdapter
	private readonly storageKey: string
	/** Serialize writes so consume + refill cannot interleave corruptly. */
	private writeChain: Promise<void> = Promise.resolve()

	constructor(
		adapter: StorageAdapter,
		storageKey: string = PUZZLE_POOL_STORAGE_KEY,
	) {
		this.adapter = adapter
		this.storageKey = storageKey
	}

	async load(): Promise<PuzzlePoolV1> {
		const raw = await this.adapter.getItem(this.storageKey)
		const parsed = parsePuzzlePool(raw)
		if (!parsed.ok) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.warn('[puzzlePool] corrupt/ignored:', parsed.reason)
			}
			await this.adapter.removeItem(this.storageKey)
			return createEmptyPuzzlePool()
		}
		return parsed.pool
	}

	async save(pool: PuzzlePoolV1): Promise<void> {
		const payload = serializePuzzlePool(pool)
		const run = this.writeChain.then(() =>
			this.adapter.setItem(this.storageKey, payload),
		)
		this.writeChain = run.then(
			() => undefined,
			() => undefined,
		)
		await run
	}

	async clear(): Promise<void> {
		const run = this.writeChain.then(() =>
			this.adapter.removeItem(this.storageKey),
		)
		this.writeChain = run.then(
			() => undefined,
			() => undefined,
		)
		await run
	}

	/**
	 * Apply a mutator under the write chain (load → mutate → save).
	 */
	async update(
		mutator: (pool: PuzzlePoolV1) => PuzzlePoolV1,
	): Promise<PuzzlePoolV1> {
		let result = createEmptyPuzzlePool()
		const run = this.writeChain.then(async () => {
			const current = await this.load()
			result = mutator(current)
			await this.adapter.setItem(
				this.storageKey,
				serializePuzzlePool(result),
			)
		})
		this.writeChain = run.then(
			() => undefined,
			() => undefined,
		)
		await run
		return result
	}
}
