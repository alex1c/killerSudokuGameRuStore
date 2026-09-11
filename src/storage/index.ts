/**
 * Minimal storage abstraction for future persistence.
 * Phase 1 keeps this free of React Native imports so the engine
 * stays testable in pure Node/Jest.
 */

export interface StorageAdapter {
	getItem(key: string): Promise<string | null>
	setItem(key: string, value: string): Promise<void>
	removeItem(key: string): Promise<void>
}

/** In-memory adapter for unit tests and early development. */
export class MemoryStorageAdapter implements StorageAdapter {
	private readonly data = new Map<string, string>()

	async getItem(key: string): Promise<string | null> {
		return this.data.has(key) ? this.data.get(key)! : null
	}

	async setItem(key: string, value: string): Promise<void> {
		this.data.set(key, value)
	}

	async removeItem(key: string): Promise<void> {
		this.data.delete(key)
	}
}

/** Current persistence schema version (bump on future migrations). */
export const STORAGE_SCHEMA_VERSION = 1
