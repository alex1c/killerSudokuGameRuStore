/**
 * Deterministic daily puzzle helpers.
 * Generation runs only when the player picks a difficulty — never on Home/Daily mount.
 */

import type { Difficulty } from '../game/difficulty'
import {
	generateKillerPuzzle,
	generateKillerPuzzleAsync,
	type KillerPuzzle,
} from '../game/killer'
import {
	DAILY_GENERATOR_VERSION,
	dailySeed,
	putDailyPuzzleCache,
	type DailyProgressV1,
	type LocalDateString,
} from '../storage/dailyProgress'
import { serializeKillerPuzzle } from '../storage/puzzlePool'
import type { SerializedKillerPuzzleV1 } from '../storage/savedGame'

/** Cache map key: `${YYYY-MM-DD}|${difficulty}`. */
export function dailyCacheKey(
	dateStr: LocalDateString,
	difficulty: Difficulty,
): string {
	return `${dateStr}|${difficulty}`
}

/**
 * Seed for today's daily at a given difficulty.
 * Always uses the storage dailyVersion contract (DAILY_GENERATOR_VERSION).
 */
export function getDailySeed(
	dateStr: LocalDateString,
	difficulty: Difficulty,
): number {
	return dailySeed(dateStr, difficulty, DAILY_GENERATOR_VERSION)
}

/** Rehydrate a cached serialized puzzle into a runtime KillerPuzzle. */
export function serializedToKillerPuzzle(
	serialized: SerializedKillerPuzzleV1,
): KillerPuzzle {
	return {
		seed: serialized.seed,
		attempt: serialized.attempt,
		difficultyPreset: serialized.difficultyPreset,
		board: serialized.board.slice() as KillerPuzzle['board'],
		solution: serialized.solution.slice() as KillerPuzzle['solution'],
		cages: serialized.cages.map((cage) => ({
			id: cage.id,
			sum: cage.sum,
			cells: cage.cells.slice(),
		})),
	}
}

/**
 * Repository-shaped deps so createOrLoadDailyPuzzle stays free of RN
 * and easy to unit-test with MemoryStorageAdapter-backed repos.
 */
export interface DailyPuzzleRepoHelpers {
	load: () => Promise<DailyProgressV1>
	update: (
		mutator: (progress: DailyProgressV1) => DailyProgressV1,
	) => Promise<DailyProgressV1>
}

/**
 * Return the cached daily puzzle or generate once, then persist to puzzleCache.
 * Easy/medium: sync calibrated generator. Hard/expert: cooperative async.
 */
export async function createOrLoadDailyPuzzle(
	dateStr: LocalDateString,
	difficulty: Difficulty,
	repo: DailyPuzzleRepoHelpers,
): Promise<KillerPuzzle> {
	const cacheKey = dailyCacheKey(dateStr, difficulty)
	const progress = await repo.load()
	const cached = progress.puzzleCache[cacheKey]
	if (cached) {
		return serializedToKillerPuzzle(cached)
	}

	const seed = getDailySeed(dateStr, difficulty)
	const puzzle =
		difficulty === 'hard' || difficulty === 'expert'
			? await generateKillerPuzzleAsync({
					seed,
					difficultyPreset: difficulty,
				})
			: generateKillerPuzzle({
					seed,
					difficultyPreset: difficulty,
				})

	const serialized = serializeKillerPuzzle(puzzle)
	await repo.update((current) => {
		// Another concurrent caller may have filled the cache — keep first win.
		if (current.puzzleCache[cacheKey]) {
			return current
		}
		return putDailyPuzzleCache(current, cacheKey, serialized)
	})

	return puzzle
}
