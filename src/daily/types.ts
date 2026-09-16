/**
 * Daily challenge progress schema (product block).
 * Pure types — persistence and helpers live in src/storage/dailyProgress.ts.
 */

import type { Difficulty } from '../game/difficulty'
import type { SerializedKillerPuzzleV1 } from '../storage/savedGame'

/** Local calendar date string YYYY-MM-DD. */
export type LocalDateString = string

/** Which difficulties were cleared on a given local calendar day. */
export type DailyDayProgress = Partial<Record<Difficulty, boolean>>

/**
 * Versioned daily-challenge document.
 * Seeds are derived from date + difficulty + dailyVersion (see dailySeed).
 */
export interface DailyProgressV1 {
	schemaVersion: 1
	/** Bump when the daily seed / puzzle contract changes. */
	dailyVersion: 1
	/** Map of local YYYY-MM-DD → per-difficulty completion flags. */
	days: Record<LocalDateString, DailyDayProgress>
	lastPlayedDate: LocalDateString | null
	currentStreak: number
	bestStreak: number
	/**
	 * Cached generated dailies keyed by `${date}|${difficulty}`.
	 * Size is capped (see DAILY_PUZZLE_CACHE_CAP); oldest entries evict first.
	 */
	puzzleCache: Record<string, SerializedKillerPuzzleV1>
}
