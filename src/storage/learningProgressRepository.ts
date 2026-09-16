/**
 * Persist / load learning progress (MemoryStorageAdapter-compatible).
 */

import type { StorageAdapter } from './index'
import {
	LEARNING_PROGRESS_STORAGE_KEY,
	createEmptyLearningProgress,
	parseLearningProgress,
	serializeLearningProgress,
	type LearningProgressV1,
} from './learningProgress'

export class LearningProgressRepository {
	private readonly adapter: StorageAdapter
	private readonly storageKey: string
	/** Serialize writes so concurrent saves cannot interleave corruptly. */
	private writeChain: Promise<void> = Promise.resolve()

	constructor(
		adapter: StorageAdapter,
		storageKey: string = LEARNING_PROGRESS_STORAGE_KEY,
	) {
		this.adapter = adapter
		this.storageKey = storageKey
	}

	async load(): Promise<LearningProgressV1> {
		const raw = await this.adapter.getItem(this.storageKey)
		const parsed = parseLearningProgress(raw)
		if (!parsed.ok) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.warn('[learning] corrupt/ignored:', parsed.reason)
			}
			await this.adapter.removeItem(this.storageKey)
			return createEmptyLearningProgress()
		}
		return parsed.progress
	}

	async save(progress: LearningProgressV1): Promise<void> {
		const payload = serializeLearningProgress(progress)
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
		mutator: (progress: LearningProgressV1) => LearningProgressV1,
	): Promise<LearningProgressV1> {
		let result = createEmptyLearningProgress()
		const run = this.writeChain.then(async () => {
			const current = await this.load()
			result = mutator(current)
			await this.adapter.setItem(
				this.storageKey,
				serializeLearningProgress(result),
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
