/**
 * Active-game persistence repository with serialized async writes.
 */

import type { StorageAdapter } from './index'
import {
	ACTIVE_GAME_STORAGE_KEY,
	parseSavedGame,
	serializeSavedGame,
	type LoadSavedGameResult,
	type SavedGameV1,
} from './savedGame'
import type { GameState } from '../gameplay'

/**
 * Latest-wins write queue so an older async write cannot clobber a newer save.
 * Optional `storageKey` lets QA use a separate namespace without touching user saves.
 */
export class GameSaveRepository {
	private readonly adapter: StorageAdapter
	private readonly storageKey: string
	private writeChain: Promise<void> = Promise.resolve()
	private writeEpoch = 0

	constructor(
		adapter: StorageAdapter,
		storageKey: string = ACTIVE_GAME_STORAGE_KEY,
	) {
		this.adapter = adapter
		this.storageKey = storageKey
	}

	async load(): Promise<LoadSavedGameResult> {
		try {
			const raw = await this.adapter.getItem(this.storageKey)
			const parsed = parseSavedGame(raw)
			if (!parsed.ok && raw !== null) {
				if (typeof __DEV__ !== 'undefined' && __DEV__) {
					console.warn('[save] corrupt/ignored:', parsed.reason)
				}
				await this.adapter.removeItem(this.storageKey)
			}
			return parsed
		} catch (error) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				console.warn('[save] load failed', error)
			}
			return { ok: false, reason: 'load-error' }
		}
	}

	/**
	 * Queue a save of the current playing state.
	 * Completed games should call clear() instead.
	 */
	savePlaying(state: GameState, now: number = Date.now()): Promise<void> {
		if (state.status !== 'playing') {
			return this.clear()
		}
		const payload = JSON.stringify(serializeSavedGame(state, now))
		const epoch = ++this.writeEpoch
		this.writeChain = this.writeChain
			.catch(() => undefined)
			.then(async () => {
				if (epoch !== this.writeEpoch) {
					return
				}
				try {
					await this.adapter.setItem(this.storageKey, payload)
				} catch (error) {
					if (typeof __DEV__ !== 'undefined' && __DEV__) {
						console.warn('[save] write failed', error)
					}
				}
			})
		return this.writeChain
	}

	clear(): Promise<void> {
		const epoch = ++this.writeEpoch
		this.writeChain = this.writeChain
			.catch(() => undefined)
			.then(async () => {
				if (epoch !== this.writeEpoch) {
					return
				}
				try {
					await this.adapter.removeItem(this.storageKey)
				} catch (error) {
					if (typeof __DEV__ !== 'undefined' && __DEV__) {
						console.warn('[save] clear failed', error)
					}
				}
			})
		return this.writeChain
	}

	/**
	 * Persist a SavedGameV1 document directly (backup restore).
	 * Pass null to clear the active-game slot.
	 */
	saveDocument(save: SavedGameV1 | null): Promise<void> {
		if (save === null) {
			return this.clear()
		}
		const payload = JSON.stringify(save)
		const epoch = ++this.writeEpoch
		this.writeChain = this.writeChain
			.catch(() => undefined)
			.then(async () => {
				if (epoch !== this.writeEpoch) {
					return
				}
				try {
					await this.adapter.setItem(this.storageKey, payload)
				} catch (error) {
					if (typeof __DEV__ !== 'undefined' && __DEV__) {
						console.warn('[save] document write failed', error)
					}
				}
			})
		return this.writeChain
	}

	/** Test helper: wait until queued writes settle. */
	async flush(): Promise<void> {
		await this.writeChain.catch(() => undefined)
	}
}

export type { SavedGameV1 }
