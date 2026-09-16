/**
 * Persist / load user settings (MemoryStorageAdapter-compatible).
 */

import type { StorageAdapter } from './index'
import {
	SETTINGS_STORAGE_KEY,
	createEmptySettings,
	parseSettings,
	serializeSettings,
	type SettingsV1,
} from './settings'

export class SettingsRepository {
	private readonly adapter: StorageAdapter
	private readonly storageKey: string
	/** Serialize writes so concurrent saves cannot interleave corruptly. */
	private writeChain: Promise<void> = Promise.resolve()

	constructor(
		adapter: StorageAdapter,
		storageKey: string = SETTINGS_STORAGE_KEY,
	) {
		this.adapter = adapter
		this.storageKey = storageKey
	}

	async load(): Promise<SettingsV1> {
		const raw = await this.adapter.getItem(this.storageKey)
		const parsed = parseSettings(raw)
		if (!parsed.ok) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.warn('[settings] corrupt/ignored:', parsed.reason)
			}
			await this.adapter.removeItem(this.storageKey)
			return createEmptySettings()
		}
		return parsed.settings
	}

	async save(settings: SettingsV1): Promise<void> {
		const payload = serializeSettings(settings)
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
		mutator: (settings: SettingsV1) => SettingsV1,
	): Promise<SettingsV1> {
		let result = createEmptySettings()
		const run = this.writeChain.then(async () => {
			const current = await this.load()
			result = mutator(current)
			await this.adapter.setItem(
				this.storageKey,
				serializeSettings(result),
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
