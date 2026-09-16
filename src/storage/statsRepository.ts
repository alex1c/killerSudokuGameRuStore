/**
 * Persist / load lifetime stats (MemoryStorageAdapter-compatible).
 */

import type { StorageAdapter } from './index'
import {
	STATS_STORAGE_KEY,
	createEmptyStats,
	parseStats,
	serializeStats,
	type StatsV1,
} from './stats'

export class StatsRepository {
	private readonly adapter: StorageAdapter
	private readonly storageKey: string
	/** Serialize writes so concurrent saves cannot interleave corruptly. */
	private writeChain: Promise<void> = Promise.resolve()

	constructor(
		adapter: StorageAdapter,
		storageKey: string = STATS_STORAGE_KEY,
	) {
		this.adapter = adapter
		this.storageKey = storageKey
	}

	async load(): Promise<StatsV1> {
		const raw = await this.adapter.getItem(this.storageKey)
		const parsed = parseStats(raw)
		if (!parsed.ok) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.warn('[stats] corrupt/ignored:', parsed.reason)
			}
			await this.adapter.removeItem(this.storageKey)
			return createEmptyStats()
		}
		return parsed.stats
	}

	async save(stats: StatsV1): Promise<void> {
		const payload = serializeStats(stats)
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
	async update(mutator: (stats: StatsV1) => StatsV1): Promise<StatsV1> {
		let result = createEmptyStats()
		const run = this.writeChain.then(async () => {
			const current = await this.load()
			result = mutator(current)
			await this.adapter.setItem(
				this.storageKey,
				serializeStats(result),
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
