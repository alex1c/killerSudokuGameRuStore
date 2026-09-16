/**
 * Background prepared-puzzle pool controller (Phase 6Q).
 *
 * Fills Hard/Expert cooperatively while the app is idle on Home.
 * Never runs expensive refill during active gameplay.
 */

import type { Difficulty } from '../game/difficulty'
import {
	createGenerationCancelToken,
	GenerationCancelledError,
	yieldToEventLoop,
	type GenerationCancelToken,
} from '../game/killer/cooperative'
import { generateKillerPuzzleAsync } from '../game/killer/generateAsync'
import { gradeDifficulty } from '../game/logic'
import { hashSeedLabel } from '../gameplay/types'
import type { StorageAdapter } from '../storage'
import {
	appendPreparedPuzzle,
	consumePreparedPuzzle,
	countPrepared,
	createPreparedPuzzle,
	isSeedBlocked,
	nextFillDifficulty,
	POOL_TARGET_COUNTS,
	POOLED_DIFFICULTIES,
	poolNeedsFill,
	preparedPuzzleToKillerPuzzle,
	type PooledDifficulty,
	type PreparedPuzzleV1,
	type PuzzlePoolV1,
} from '../storage/puzzlePool'
import { PuzzlePoolRepository } from '../storage/puzzlePoolRepository'
import type { KillerPuzzle } from '../game/killer/generateKillerPuzzle'

export type PoolControllerMode = 'idle' | 'filling' | 'paused'

export interface PuzzlePoolSnapshot {
	hard: number
	expert: number
	hardTarget: number
	expertTarget: number
	mode: PoolControllerMode
	recentSeeds: number[]
}

export interface ConsumePreparedResult {
	ok: true
	puzzle: KillerPuzzle
	retrievalMs: number
	fromPool: true
}

function isPooledDifficulty(value: Difficulty): value is PooledDifficulty {
	return value === 'hard' || value === 'expert'
}

function createPoolSeed(
	difficulty: PooledDifficulty,
	pool: PuzzlePoolV1,
	salt: number,
): number {
	let seed = hashSeedLabel(
		`pool-${difficulty}-${salt}-${pool.recentSeeds.length}-${Date.now()}`,
	)
	let guard = 0
	while (isSeedBlocked(pool, seed) && guard < 32) {
		seed = (seed + 0x9e3779b9 + guard) >>> 0
		guard += 1
	}
	return seed
}

/**
 * Owns in-memory pool cache + cooperative background fill job.
 */
export class PuzzlePoolController {
	private readonly repository: PuzzlePoolRepository
	private pool: PuzzlePoolV1 | null = null
	private mode: PoolControllerMode = 'idle'
	private fillToken: GenerationCancelToken | null = null
	private fillPromise: Promise<void> | null = null
	private appActive = true
	private gameplayActive = false
	private homeVisible = false
	private listeners = new Set<(snapshot: PuzzlePoolSnapshot) => void>()
	private fillGeneration = 0

	constructor(adapter: StorageAdapter, storageKey?: string) {
		this.repository = new PuzzlePoolRepository(adapter, storageKey)
	}

	subscribe(listener: (snapshot: PuzzlePoolSnapshot) => void): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	getSnapshot(): PuzzlePoolSnapshot {
		const pool = this.pool
		return {
			hard: pool ? countPrepared(pool, 'hard') : 0,
			expert: pool ? countPrepared(pool, 'expert') : 0,
			hardTarget: POOL_TARGET_COUNTS.hard,
			expertTarget: POOL_TARGET_COUNTS.expert,
			mode: this.mode,
			recentSeeds: pool ? [...pool.recentSeeds] : [],
		}
	}

	private emit(): void {
		const snapshot = this.getSnapshot()
		for (const listener of this.listeners) {
			listener(snapshot)
		}
	}

	async ensureLoaded(): Promise<PuzzlePoolV1> {
		if (this.pool === null) {
			this.pool = await this.repository.load()
			this.emit()
		}
		return this.pool
	}

	setHomeVisible(visible: boolean): void {
		this.homeVisible = visible
		if (visible) {
			this.gameplayActive = false
		} else {
			this.pauseFill()
		}
	}

	setGameplayActive(active: boolean): void {
		this.gameplayActive = active
		if (active) {
			this.pauseFill()
		}
	}

	setAppActive(active: boolean): void {
		this.appActive = active
		if (!active) {
			this.pauseFill()
		} else if (this.homeVisible && !this.gameplayActive) {
			void this.scheduleFill('app-active')
		}
	}

	/** Cancel any in-flight fill (gameplay / background / leave home). */
	pauseFill(): void {
		if (this.fillToken !== null) {
			this.fillToken.cancel()
			this.fillToken = null
		}
		if (this.mode === 'filling') {
			this.mode = 'paused'
			this.emit()
		}
	}

	async clearPool(): Promise<void> {
		this.pauseFill()
		await this.repository.clear()
		this.pool = await this.repository.load()
		this.mode = 'idle'
		this.emit()
	}

	/**
	 * Start cooperative refill if allowed. Single-flight.
	 */
	async scheduleFill(_reason: string = 'manual'): Promise<void> {
		if (!this.appActive || this.gameplayActive || !this.homeVisible) {
			return
		}
		await this.ensureLoaded()
		if (this.pool === null || !poolNeedsFill(this.pool)) {
			this.mode = 'idle'
			this.emit()
			return
		}
		if (this.fillPromise !== null) {
			return
		}

		const generation = ++this.fillGeneration
		const token = createGenerationCancelToken()
		this.fillToken = token
		this.mode = 'filling'
		this.emit()

		this.fillPromise = this.runFillLoop(token, generation).finally(() => {
			if (this.fillGeneration === generation) {
				this.fillPromise = null
				this.fillToken = null
				if (this.mode === 'filling') {
					this.mode = 'idle'
				}
				this.emit()
			}
		})

		await this.fillPromise
	}

	private async runFillLoop(
		token: GenerationCancelToken,
		generation: number,
	): Promise<void> {
		try {
			while (
				generation === this.fillGeneration &&
				!token.cancelled &&
				this.appActive &&
				this.homeVisible &&
				!this.gameplayActive
			) {
				const pool = await this.ensureLoaded()
				const difficulty = nextFillDifficulty(pool)
				if (difficulty === null) {
					break
				}

				const seed = createPoolSeed(
					difficulty,
					pool,
					this.fillGeneration + pool.items.length,
				)
				try {
					const puzzle = await generateKillerPuzzleAsync({
						seed,
						difficultyPreset: difficulty,
						cancelToken: token,
						digYieldEvery: 3,
					})
					if (token.cancelled || generation !== this.fillGeneration) {
						break
					}
					const grade = gradeDifficulty({
						board: puzzle.board,
						cages: puzzle.cages,
					})
					if (grade.level !== difficulty) {
						await yieldToEventLoop()
						continue
					}
					const item = createPreparedPuzzle(
						puzzle,
						difficulty,
						Date.now(),
					)
					this.pool = await this.repository.update((current) =>
						appendPreparedPuzzle(current, item),
					)
					this.emit()
				} catch (error) {
					if (error instanceof GenerationCancelledError) {
						break
					}
					if (typeof __DEV__ !== 'undefined' && __DEV__) {
						console.warn('[puzzlePool] fill error', error)
					}
				}
				await yieldToEventLoop()
			}
		} finally {
			if (generation === this.fillGeneration && this.mode === 'filling') {
				this.mode = 'idle'
			}
		}
	}

	/**
	 * Take one prepared puzzle for Hard/Expert. Atomic remove + persist.
	 */
	async consume(
		difficulty: Difficulty,
	): Promise<ConsumePreparedResult | null> {
		if (!isPooledDifficulty(difficulty)) {
			return null
		}
		const t0 =
			typeof performance !== 'undefined' && performance.now
				? performance.now()
				: Date.now()
		await this.ensureLoaded()
		let taken: PreparedPuzzleV1 | null = null
		this.pool = await this.repository.update((current) => {
			const result = consumePreparedPuzzle(current, difficulty)
			if (result === null) {
				return current
			}
			taken = result.item
			return result.pool
		})
		this.emit()
		if (taken === null) {
			return null
		}
		const item = taken as PreparedPuzzleV1
		const retrievalMs =
			(typeof performance !== 'undefined' && performance.now
				? performance.now()
				: Date.now()) - t0
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			console.log(
				`[KILLER_POOL] consume ${difficulty} seed=${item.seed} retrievalMs=${retrievalMs.toFixed(1)}`,
			)
		}
		return {
			ok: true,
			puzzle: preparedPuzzleToKillerPuzzle(item),
			retrievalMs,
			fromPool: true,
		}
	}

	/** Force-fill until targets met (DEV QA). Respects cancel via pauseFill. */
	async fillToTargets(): Promise<PuzzlePoolSnapshot> {
		this.homeVisible = true
		this.gameplayActive = false
		this.appActive = true
		await this.scheduleFill('dev-fill')
		// Keep scheduling until full or cancelled.
		let guard = 0
		while (
			this.pool !== null &&
			poolNeedsFill(this.pool) &&
			guard < 20
		) {
			guard += 1
			await this.scheduleFill('dev-fill-loop')
		}
		return this.getSnapshot()
	}
}

/** Shared app-level controller (wired from App.tsx). */
let sharedController: PuzzlePoolController | null = null

export function getSharedPuzzlePoolController(
	adapter: StorageAdapter,
): PuzzlePoolController {
	if (sharedController === null) {
		sharedController = new PuzzlePoolController(adapter)
	}
	return sharedController
}

export function resetSharedPuzzlePoolControllerForTests(): void {
	sharedController = null
}

export { POOLED_DIFFICULTIES, POOL_TARGET_COUNTS }
