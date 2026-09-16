/**
 * Lifetime stats persistence schema (product block).
 * Versioned JSON under killerSudoku.stats.v1 — separate from active game.
 */

import type { Difficulty } from '../game/difficulty'
import { PLAYABLE_DIFFICULTIES } from '../game/difficulty'
import type {
	DifficultyStatsV1,
	RecordGameCompletedInput,
	StatsV1,
} from '../stats/types'

export const STATS_SCHEMA_VERSION = 1 as const
export const STATS_STORAGE_KEY = 'killerSudoku.stats.v1'

/** Max unique difficulty:seed keys retained in uniqueSolvedSeeds. */
export const UNIQUE_SOLVED_SEEDS_CAP = 500

export type { DifficultyStatsV1, RecordGameCompletedInput, StatsV1 }

export type LoadStatsResult =
	| { ok: true; stats: StatsV1 }
	| { ok: false; reason: string }

function createEmptyDifficultyStats(): DifficultyStatsV1 {
	return {
		started: 0,
		completed: 0,
		bestTimeMs: null,
		totalCompletedTimeMs: 0,
	}
}

function createEmptyByDifficulty(): Record<Difficulty, DifficultyStatsV1> {
	return {
		easy: createEmptyDifficultyStats(),
		medium: createEmptyDifficultyStats(),
		hard: createEmptyDifficultyStats(),
		expert: createEmptyDifficultyStats(),
	}
}

/** Fresh zeroed stats document (also the corrupt-recovery fallback). */
export function createEmptyStats(): StatsV1 {
	return {
		schemaVersion: STATS_SCHEMA_VERSION,
		totalCompleted: 0,
		totalPlayTimeMs: 0,
		uniqueSolvedSeeds: [],
		currentDailyStreak: 0,
		bestDailyStreak: 0,
		byDifficulty: createEmptyByDifficulty(),
	}
}

/**
 * Stable unique-solved key: difficulty + numeric seed.
 * Example: `hard:42`
 */
export function uniqueKey(difficulty: Difficulty, seed: number): string {
	return `${difficulty}:${seed}`
}

function isDifficulty(value: unknown): value is Difficulty {
	return (
		value === 'easy' ||
		value === 'medium' ||
		value === 'hard' ||
		value === 'expert'
	)
}

function isNonNegativeNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isDifficultyStats(value: unknown): value is DifficultyStatsV1 {
	if (value === null || typeof value !== 'object') {
		return false
	}
	const row = value as Partial<DifficultyStatsV1>
	const bestOk =
		row.bestTimeMs === null ||
		(typeof row.bestTimeMs === 'number' &&
			Number.isFinite(row.bestTimeMs) &&
			row.bestTimeMs >= 0)
	return (
		isNonNegativeNumber(row.started) &&
		isNonNegativeNumber(row.completed) &&
		bestOk &&
		isNonNegativeNumber(row.totalCompletedTimeMs)
	)
}

function parseByDifficulty(
	value: unknown,
): Record<Difficulty, DifficultyStatsV1> | null {
	if (value === null || typeof value !== 'object') {
		return null
	}
	const raw = value as Partial<Record<Difficulty, DifficultyStatsV1>>
	const result = createEmptyByDifficulty()
	for (const difficulty of PLAYABLE_DIFFICULTIES) {
		const row = raw[difficulty]
		if (row === undefined) {
			continue
		}
		if (!isDifficultyStats(row)) {
			return null
		}
		result[difficulty] = {
			started: row.started,
			completed: row.completed,
			bestTimeMs: row.bestTimeMs,
			totalCompletedTimeMs: row.totalCompletedTimeMs,
		}
	}
	return result
}

/**
 * Parse stats JSON. Empty/missing → empty stats.
 * Corrupt / wrong-version payloads return ok:false (repository clears + empty).
 */
export function parseStats(raw: string | null): LoadStatsResult {
	if (raw === null || raw.trim() === '') {
		return { ok: true, stats: createEmptyStats() }
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		return { ok: false, reason: 'invalid-json' }
	}
	if (parsed === null || typeof parsed !== 'object') {
		return { ok: false, reason: 'not-object' }
	}
	const doc = parsed as Partial<StatsV1>
	if (doc.schemaVersion !== STATS_SCHEMA_VERSION) {
		return { ok: false, reason: 'schema-version' }
	}
	if (
		!isNonNegativeNumber(doc.totalCompleted) ||
		!isNonNegativeNumber(doc.totalPlayTimeMs) ||
		!isNonNegativeNumber(doc.currentDailyStreak) ||
		!isNonNegativeNumber(doc.bestDailyStreak) ||
		!Array.isArray(doc.uniqueSolvedSeeds)
	) {
		return { ok: false, reason: 'shape' }
	}
	const byDifficulty = parseByDifficulty(doc.byDifficulty)
	if (byDifficulty === null) {
		return { ok: false, reason: 'byDifficulty' }
	}

	// Keep only well-formed difficulty:seed keys; cap to the newest entries.
	const uniqueSolvedSeeds = doc.uniqueSolvedSeeds
		.filter((item): item is string => typeof item === 'string')
		.filter((item) => {
			const sep = item.indexOf(':')
			if (sep <= 0) {
				return false
			}
			const difficulty = item.slice(0, sep)
			const seedPart = item.slice(sep + 1)
			if (!isDifficulty(difficulty)) {
				return false
			}
			const seed = Number(seedPart)
			return Number.isInteger(seed)
		})
		.slice(-UNIQUE_SOLVED_SEEDS_CAP)

	return {
		ok: true,
		stats: {
			schemaVersion: STATS_SCHEMA_VERSION,
			totalCompleted: doc.totalCompleted,
			totalPlayTimeMs: doc.totalPlayTimeMs,
			uniqueSolvedSeeds,
			currentDailyStreak: doc.currentDailyStreak,
			bestDailyStreak: doc.bestDailyStreak,
			byDifficulty,
		},
	}
}

export function serializeStats(stats: StatsV1): string {
	return JSON.stringify(stats)
}

/**
 * Pure: increment the started counter for a difficulty.
 * Does not touch completed / unique / streak fields.
 */
export function recordGameStarted(
	stats: StatsV1,
	difficulty: Difficulty,
): StatsV1 {
	const row = stats.byDifficulty[difficulty]
	return {
		...stats,
		byDifficulty: {
			...stats.byDifficulty,
			[difficulty]: {
				...row,
				started: row.started + 1,
			},
		},
	}
}

/**
 * Pure: record a successful clear.
 * Updates totals, per-difficulty aggregates, best time, and optionally
 * uniqueSolvedSeeds (when isReplayUnique and the key is new).
 * Daily streak fields are left for callers / daily progress sync.
 */
export function recordGameCompleted(
	stats: StatsV1,
	input: RecordGameCompletedInput,
): StatsV1 {
	const { difficulty, seed, elapsedMs, isReplayUnique } = input
	const safeElapsed =
		typeof elapsedMs === 'number' && Number.isFinite(elapsedMs)
			? Math.max(0, elapsedMs)
			: 0
	const row = stats.byDifficulty[difficulty]
	const nextBest =
		row.bestTimeMs === null
			? safeElapsed
			: Math.min(row.bestTimeMs, safeElapsed)

	let uniqueSolvedSeeds = stats.uniqueSolvedSeeds
	if (isReplayUnique) {
		const key = uniqueKey(difficulty, seed)
		if (!uniqueSolvedSeeds.includes(key)) {
			uniqueSolvedSeeds = [...uniqueSolvedSeeds, key].slice(
				-UNIQUE_SOLVED_SEEDS_CAP,
			)
		}
	}

	return {
		...stats,
		totalCompleted: stats.totalCompleted + 1,
		totalPlayTimeMs: stats.totalPlayTimeMs + safeElapsed,
		uniqueSolvedSeeds,
		byDifficulty: {
			...stats.byDifficulty,
			[difficulty]: {
				started: row.started,
				completed: row.completed + 1,
				bestTimeMs: nextBest,
				totalCompletedTimeMs: row.totalCompletedTimeMs + safeElapsed,
			},
		},
	}
}
