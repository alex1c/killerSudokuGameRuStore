/**
 * Persist / load daily challenge progress (MemoryStorageAdapter-compatible).
 */

import type { StorageAdapter } from './index'
import {
	DAILY_PROGRESS_STORAGE_KEY,
	createEmptyDailyProgress,
	parseDailyProgress,
	serializeDailyProgress,
	type DailyProgressV1,
} from './dailyProgress'

export class DailyProgressRepository {
	private readonly adapter: StorageAdapter
	private readonly storageKey: string
	/** Serialize writes so concurrent saves cannot interleave corruptly. */
	private writeChain: Promise<void> = Promise.resolve()

	constructor(
		adapter: StorageAdapter,
		storageKey: string = DAILY_PROGRESS_STORAGE_KEY,
	) {
		this.adapter = adapter
		this.storageKey = storageKey
	}

	async load(): Promise<DailyProgressV1> {
		const raw = await this.adapter.getItem(this.storageKey)
		const parsed = parseDailyProgress(raw)
		if (!parsed.ok) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.warn('[daily] corrupt/ignored:', parsed.reason)
			}
			await this.adapter.removeItem(this.storageKey)
			return createEmptyDailyProgress()
		}
		return parsed.progress
	}

	async save(progress: DailyProgressV1): Promise<void> {
		const payload = serializeDailyProgress(progress)
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
		mutator: (progress: DailyProgressV1) => DailyProgressV1,
	): Promise<DailyProgressV1> {
		let result = createEmptyDailyProgress()
		const run = this.writeChain.then(async () => {
			const current = await this.load()
			result = mutator(current)
			await this.adapter.setItem(
				this.storageKey,
				serializeDailyProgress(result),
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
