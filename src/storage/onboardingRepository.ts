/**
 * Persist / load onboarding progress (MemoryStorageAdapter-compatible).
 */

import type { StorageAdapter } from './index'
import {
	ONBOARDING_STORAGE_KEY,
	createEmptyOnboarding,
	parseOnboarding,
	serializeOnboarding,
	type OnboardingV1,
} from './onboarding'

export class OnboardingRepository {
	private readonly adapter: StorageAdapter
	private readonly storageKey: string
	/** Serialize writes so concurrent saves cannot interleave corruptly. */
	private writeChain: Promise<void> = Promise.resolve()

	constructor(
		adapter: StorageAdapter,
		storageKey: string = ONBOARDING_STORAGE_KEY,
	) {
		this.adapter = adapter
		this.storageKey = storageKey
	}

	async load(): Promise<OnboardingV1> {
		const raw = await this.adapter.getItem(this.storageKey)
		const parsed = parseOnboarding(raw)
		if (!parsed.ok) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.warn('[onboarding] corrupt/ignored:', parsed.reason)
			}
			await this.adapter.removeItem(this.storageKey)
			return createEmptyOnboarding()
		}
		return parsed.onboarding
	}

	async save(onboarding: OnboardingV1): Promise<void> {
		const payload = serializeOnboarding(onboarding)
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
		mutator: (onboarding: OnboardingV1) => OnboardingV1,
	): Promise<OnboardingV1> {
		let result = createEmptyOnboarding()
		const run = this.writeChain.then(async () => {
			const current = await this.load()
			result = mutator(current)
			await this.adapter.setItem(
				this.storageKey,
				serializeOnboarding(result),
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
