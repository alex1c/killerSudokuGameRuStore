/**
 * Daily challenge progress persistence (product block).
 * Versioned JSON under killerSudoku.daily.v1 — separate from active game.
 */

import type { Difficulty } from '../game/difficulty'
import { PLAYABLE_DIFFICULTIES } from '../game/difficulty'
import { hashSeedLabel } from '../gameplay/types'
import type {
	DailyDayProgress,
	DailyProgressV1,
	LocalDateString,
} from '../daily/types'
import type { KillerCage } from '../game/killer/cages'
import type { SudokuBoard } from '../game/sudoku'
import type { SerializedKillerPuzzleV1 } from './savedGame'

export const DAILY_PROGRESS_SCHEMA_VERSION = 1 as const
/** Generator / seed-contract version stored on DailyProgressV1.dailyVersion. */
export const DAILY_GENERATOR_VERSION = 1 as const
export const DAILY_PROGRESS_STORAGE_KEY = 'killerSudoku.daily.v1'

/**
 * Soft cap for puzzleCache entries (`${date}|${difficulty}`).
 * Evicts oldest insertion-order keys when exceeded.
 */
export const DAILY_PUZZLE_CACHE_CAP = 16

export type { DailyDayProgress, DailyProgressV1, LocalDateString }

export type LoadDailyProgressResult =
	| { ok: true; progress: DailyProgressV1 }
	| { ok: false; reason: string }

/** Fresh empty daily progress (also corrupt-recovery fallback). */
export function createEmptyDailyProgress(): DailyProgressV1 {
	return {
		schemaVersion: DAILY_PROGRESS_SCHEMA_VERSION,
		dailyVersion: DAILY_GENERATOR_VERSION,
		days: {},
		lastPlayedDate: null,
		currentStreak: 0,
		bestStreak: 0,
		puzzleCache: {},
	}
}

/**
 * Format a Date as local YYYY-MM-DD using local calendar getters
 * (not UTC — daily challenges follow the player's local day).
 */
export function localDateString(date: Date): LocalDateString {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

/**
 * Deterministic daily puzzle seed from date, difficulty, and generator version.
 */
export function dailySeed(
	dateStr: LocalDateString,
	difficulty: Difficulty,
	dailyVersion: number = DAILY_GENERATOR_VERSION,
): number {
	return hashSeedLabel(
		`daily|v${dailyVersion}|${dateStr}|${difficulty}`,
	)
}

/** True when any difficulty flag on the day is set. */
export function isDayCompleted(day: DailyDayProgress | undefined): boolean {
	if (!day) {
		return false
	}
	return PLAYABLE_DIFFICULTIES.some((difficulty) => day[difficulty] === true)
}

/**
 * All local YYYY-MM-DD strings in a calendar month (1-based month).
 * Example: monthCalendar(2026, 9) → ['2026-09-01', ..., '2026-09-30']
 */
export function monthCalendar(year: number, month: number): LocalDateString[] {
	const daysInMonth = new Date(year, month, 0).getDate()
	const result: LocalDateString[] = []
	for (let day = 1; day <= daysInMonth; day += 1) {
		const monthStr = String(month).padStart(2, '0')
		const dayStr = String(day).padStart(2, '0')
		result.push(`${year}-${monthStr}-${dayStr}`)
	}
	return result
}

/** Previous local calendar day as YYYY-MM-DD (handles month/year boundaries). */
function previousDateString(dateStr: LocalDateString): LocalDateString {
	const [yearStr, monthStr, dayStr] = dateStr.split('-')
	const year = Number(yearStr)
	const month = Number(monthStr)
	const day = Number(dayStr)
	// noon local avoids DST edge cases when stepping calendar days
	const date = new Date(year, month - 1, day, 12, 0, 0, 0)
	date.setDate(date.getDate() - 1)
	return localDateString(date)
}

/**
 * Mark a difficulty complete for dateStr and update streak counters.
 *
 * Streak = consecutive local calendar days with ≥1 difficulty done.
 * When recording progress on dateStr:
 * - If that day already had any completion → streak unchanged (already counted).
 * - Else if the previous calendar day was completed → extend currentStreak.
 * - Else → reset currentStreak to 1.
 * bestStreak tracks the high-water mark.
 */
export function markDailyCompleted(
	progress: DailyProgressV1,
	dateStr: LocalDateString,
	difficulty: Difficulty,
): DailyProgressV1 {
	const existingDay = progress.days[dateStr] ?? {}
	const hadProgressBefore = isDayCompleted(existingDay)
	const nextDay: DailyDayProgress = {
		...existingDay,
		[difficulty]: true,
	}
	const days = {
		...progress.days,
		[dateStr]: nextDay,
	}

	let currentStreak = progress.currentStreak
	if (!hadProgressBefore) {
		const yesterday = previousDateString(dateStr)
		if (isDayCompleted(days[yesterday])) {
			currentStreak = progress.currentStreak + 1
		} else {
			currentStreak = 1
		}
	}

	const bestStreak = Math.max(progress.bestStreak, currentStreak)

	return {
		...progress,
		days,
		lastPlayedDate: dateStr,
		currentStreak,
		bestStreak,
	}
}

/**
 * Insert / replace a cached daily puzzle; evict oldest keys past the cap.
 * Key format: `${date}|${difficulty}`
 */
export function putDailyPuzzleCache(
	progress: DailyProgressV1,
	cacheKey: string,
	puzzle: SerializedKillerPuzzleV1,
): DailyProgressV1 {
	const puzzleCache: Record<string, SerializedKillerPuzzleV1> = {
		...progress.puzzleCache,
	}
	// Delete then re-insert so this key becomes newest in insertion order.
	if (Object.prototype.hasOwnProperty.call(puzzleCache, cacheKey)) {
		delete puzzleCache[cacheKey]
	}
	puzzleCache[cacheKey] = puzzle
	return {
		...progress,
		puzzleCache: trimPuzzleCache(puzzleCache),
	}
}

function trimPuzzleCache(
	cache: Record<string, SerializedKillerPuzzleV1>,
): Record<string, SerializedKillerPuzzleV1> {
	const keys = Object.keys(cache)
	if (keys.length <= DAILY_PUZZLE_CACHE_CAP) {
		return cache
	}
	const dropCount = keys.length - DAILY_PUZZLE_CACHE_CAP
	const next: Record<string, SerializedKillerPuzzleV1> = { ...cache }
	for (let i = 0; i < dropCount; i += 1) {
		delete next[keys[i]!]
	}
	return next
}

function isSudokuBoard(value: unknown): value is SudokuBoard {
	return (
		Array.isArray(value) &&
		value.length === 81 &&
		value.every(
			(item) =>
				typeof item === 'number' &&
				Number.isInteger(item) &&
				item >= 0 &&
				item <= 9,
		)
	)
}

function isValidCage(value: unknown): value is KillerCage {
	if (value === null || typeof value !== 'object') {
		return false
	}
	const cage = value as Partial<KillerCage>
	return (
		typeof cage.id === 'string' &&
		Number.isFinite(cage.sum) &&
		Array.isArray(cage.cells) &&
		cage.cells.every(
			(cell) =>
				typeof cell === 'number' &&
				Number.isInteger(cell) &&
				cell >= 0 &&
				cell < 81,
		)
	)
}

function isValidSerializedPuzzle(
	value: unknown,
): value is SerializedKillerPuzzleV1 {
	if (value === null || typeof value !== 'object') {
		return false
	}
	const puzzle = value as Partial<SerializedKillerPuzzleV1>
	return (
		typeof puzzle.seed === 'number' &&
		Number.isInteger(puzzle.seed) &&
		typeof puzzle.attempt === 'number' &&
		Number.isInteger(puzzle.attempt) &&
		(puzzle.difficultyPreset === 'easy' ||
			puzzle.difficultyPreset === 'medium' ||
			puzzle.difficultyPreset === 'hard' ||
			puzzle.difficultyPreset === 'expert') &&
		isSudokuBoard(puzzle.board) &&
		isSudokuBoard(puzzle.solution) &&
		Array.isArray(puzzle.cages) &&
		puzzle.cages.every(isValidCage)
	)
}

function isLocalDateString(value: unknown): value is LocalDateString {
	return (
		typeof value === 'string' &&
		/^\d{4}-\d{2}-\d{2}$/.test(value)
	)
}

function isDifficulty(value: unknown): value is Difficulty {
	return (
		value === 'easy' ||
		value === 'medium' ||
		value === 'hard' ||
		value === 'expert'
	)
}

function parseDayProgress(value: unknown): DailyDayProgress | null {
	if (value === null || typeof value !== 'object') {
		return null
	}
	const raw = value as Partial<Record<Difficulty, unknown>>
	const day: DailyDayProgress = {}
	for (const difficulty of PLAYABLE_DIFFICULTIES) {
		const flag = raw[difficulty]
		if (flag === undefined) {
			continue
		}
		if (typeof flag !== 'boolean') {
			return null
		}
		if (flag) {
			day[difficulty] = true
		}
	}
	return day
}

function parseDays(
	value: unknown,
): Record<LocalDateString, DailyDayProgress> | null {
	if (value === null || typeof value !== 'object') {
		return null
	}
	const raw = value as Record<string, unknown>
	const days: Record<LocalDateString, DailyDayProgress> = {}
	for (const [dateStr, dayValue] of Object.entries(raw)) {
		if (!isLocalDateString(dateStr)) {
			continue
		}
		const day = parseDayProgress(dayValue)
		if (day === null) {
			return null
		}
		days[dateStr] = day
	}
	return days
}

function parsePuzzleCache(
	value: unknown,
): Record<string, SerializedKillerPuzzleV1> | null {
	if (value === null || typeof value !== 'object') {
		return null
	}
	const raw = value as Record<string, unknown>
	const cache: Record<string, SerializedKillerPuzzleV1> = {}
	for (const [key, puzzleValue] of Object.entries(raw)) {
		const sep = key.indexOf('|')
		if (sep <= 0) {
			continue
		}
		const datePart = key.slice(0, sep)
		const difficultyPart = key.slice(sep + 1)
		if (!isLocalDateString(datePart) || !isDifficulty(difficultyPart)) {
			continue
		}
		if (!isValidSerializedPuzzle(puzzleValue)) {
			continue
		}
		cache[key] = puzzleValue
	}
	return trimPuzzleCache(cache)
}

/**
 * Parse daily progress JSON. Empty/missing → empty progress.
 * Corrupt / wrong-version payloads return ok:false (repository clears + empty).
 * Individual corrupt cache entries are dropped; generator mismatch clears all.
 */
export function parseDailyProgress(
	raw: string | null,
): LoadDailyProgressResult {
	if (raw === null || raw.trim() === '') {
		return { ok: true, progress: createEmptyDailyProgress() }
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
	const doc = parsed as Partial<DailyProgressV1>
	if (doc.schemaVersion !== DAILY_PROGRESS_SCHEMA_VERSION) {
		return { ok: false, reason: 'schema-version' }
	}
	if (doc.dailyVersion !== DAILY_GENERATOR_VERSION) {
		return { ok: false, reason: 'daily-version' }
	}
	if (
		typeof doc.currentStreak !== 'number' ||
		!Number.isFinite(doc.currentStreak) ||
		doc.currentStreak < 0 ||
		typeof doc.bestStreak !== 'number' ||
		!Number.isFinite(doc.bestStreak) ||
		doc.bestStreak < 0
	) {
		return { ok: false, reason: 'streak' }
	}
	if (
		doc.lastPlayedDate !== null &&
		!isLocalDateString(doc.lastPlayedDate)
	) {
		return { ok: false, reason: 'lastPlayedDate' }
	}
	const days = parseDays(doc.days)
	if (days === null) {
		return { ok: false, reason: 'days' }
	}
	const puzzleCache = parsePuzzleCache(doc.puzzleCache ?? {})
	if (puzzleCache === null) {
		return { ok: false, reason: 'puzzleCache' }
	}

	return {
		ok: true,
		progress: {
			schemaVersion: DAILY_PROGRESS_SCHEMA_VERSION,
			dailyVersion: DAILY_GENERATOR_VERSION,
			days,
			lastPlayedDate: doc.lastPlayedDate ?? null,
			currentStreak: doc.currentStreak,
			bestStreak: doc.bestStreak,
			puzzleCache,
		},
	}
}

export function serializeDailyProgress(progress: DailyProgressV1): string {
	return JSON.stringify(progress)
}
