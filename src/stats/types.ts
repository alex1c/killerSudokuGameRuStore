/**
 * Lifetime / aggregate stats schema (product block).
 * Pure types — persistence and mutators live in src/storage/stats.ts.
 */

import type { Difficulty } from '../game/difficulty'

/** Per-difficulty counters embedded in StatsV1.byDifficulty. */
export interface DifficultyStatsV1 {
	started: number
	completed: number
	/** Best clear time in ms; null until the first completion. */
	bestTimeMs: number | null
	/** Sum of elapsedMs across all completions for this difficulty. */
	totalCompletedTimeMs: number
}

/**
 * Versioned lifetime stats document.
 * Daily streak fields mirror daily progress but are owned here for profile UI.
 */
export interface StatsV1 {
	schemaVersion: 1
	totalCompleted: number
	totalPlayTimeMs: number
	/**
	 * Unique solved puzzle keys (`${difficulty}:${seed}`), newest last.
	 * Capped at UNIQUE_SOLVED_SEEDS_CAP when persisted / mutated.
	 */
	uniqueSolvedSeeds: string[]
	currentDailyStreak: number
	bestDailyStreak: number
	byDifficulty: Record<Difficulty, DifficultyStatsV1>
}

/** Payload for recordGameCompleted — pure stats update, no I/O. */
export interface RecordGameCompletedInput {
	difficulty: Difficulty
	seed: number
	elapsedMs: number
	/**
	 * When true, this clear may be recorded in uniqueSolvedSeeds
	 * (if the difficulty:seed key is not already present).
	 */
	isReplayUnique: boolean
}
