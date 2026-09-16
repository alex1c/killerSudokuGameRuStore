/**
 * Prepared puzzle pool schema (Phase 6Q).
 * Separate from killerSudoku.activeGame.v1 — Continue saves stay independent.
 */

import type { Difficulty } from '../game/difficulty'
import { PUZZLE_GENERATOR_VERSION } from '../game/killer/generatorVersion'
import type { KillerPuzzle } from '../game/killer/generateKillerPuzzle'
import type { KillerCage } from '../game/killer/cages'
import type { SudokuBoard } from '../game/sudoku'
import type { SerializedKillerPuzzleV1 } from './savedGame'

export const PUZZLE_POOL_SCHEMA_VERSION = 1 as const
export const PUZZLE_POOL_STORAGE_KEY = 'killerSudoku.puzzlePool.v1'

/** Difficulties kept warm in the local prepared pool. */
export type PooledDifficulty = 'hard' | 'expert'

export const POOLED_DIFFICULTIES: readonly PooledDifficulty[] = [
	'hard',
	'expert',
] as const

/** Small v1 targets — Hard/Expert only. */
export const POOL_TARGET_COUNTS: Record<PooledDifficulty, number> = {
	hard: 2,
	expert: 2,
}

/** Remember recently consumed seeds to avoid immediate repeats. */
export const POOL_RECENT_SEEDS_LIMIT = 32

export interface PreparedPuzzleV1 {
	schemaVersion: typeof PUZZLE_POOL_SCHEMA_VERSION
	generatorVersion: number
	seed: number
	difficulty: PooledDifficulty
	puzzle: SerializedKillerPuzzleV1
	/** Graded level at generation time (must equal difficulty). */
	gradeLevel: Difficulty
	generatedAt: number
}

export interface PuzzlePoolV1 {
	schemaVersion: typeof PUZZLE_POOL_SCHEMA_VERSION
	generatorVersion: number
	items: PreparedPuzzleV1[]
	/** Recently consumed / issued seeds (oldest first). */
	recentSeeds: number[]
}

export type LoadPuzzlePoolResult =
	| { ok: true; pool: PuzzlePoolV1 }
	| { ok: false; reason: string }

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

function isPooledDifficulty(value: unknown): value is PooledDifficulty {
	return value === 'hard' || value === 'expert'
}

function isValidPreparedItem(value: unknown): value is PreparedPuzzleV1 {
	if (value === null || typeof value !== 'object') {
		return false
	}
	const item = value as Partial<PreparedPuzzleV1>
	return (
		item.schemaVersion === PUZZLE_POOL_SCHEMA_VERSION &&
		typeof item.generatorVersion === 'number' &&
		typeof item.seed === 'number' &&
		Number.isInteger(item.seed) &&
		isPooledDifficulty(item.difficulty) &&
		isValidSerializedPuzzle(item.puzzle) &&
		item.puzzle.difficultyPreset === item.difficulty &&
		item.puzzle.seed === item.seed &&
		item.gradeLevel === item.difficulty &&
		typeof item.generatedAt === 'number' &&
		Number.isFinite(item.generatedAt)
	)
}

export function createEmptyPuzzlePool(): PuzzlePoolV1 {
	return {
		schemaVersion: PUZZLE_POOL_SCHEMA_VERSION,
		generatorVersion: PUZZLE_GENERATOR_VERSION,
		items: [],
		recentSeeds: [],
	}
}

export function serializeKillerPuzzle(
	puzzle: KillerPuzzle,
): SerializedKillerPuzzleV1 {
	return {
		seed: puzzle.seed,
		attempt: puzzle.attempt,
		difficultyPreset: puzzle.difficultyPreset,
		board: puzzle.board.slice() as SudokuBoard,
		solution: puzzle.solution.slice() as SudokuBoard,
		cages: puzzle.cages.map((cage) => ({
			id: cage.id,
			sum: cage.sum,
			cells: cage.cells.slice(),
		})),
	}
}

export function preparedPuzzleToKillerPuzzle(
	item: PreparedPuzzleV1,
): KillerPuzzle {
	return {
		seed: item.puzzle.seed,
		attempt: item.puzzle.attempt,
		difficultyPreset: item.puzzle.difficultyPreset,
		board: item.puzzle.board.slice() as SudokuBoard,
		solution: item.puzzle.solution.slice() as SudokuBoard,
		cages: item.puzzle.cages.map((cage) => ({
			id: cage.id,
			sum: cage.sum,
			cells: cage.cells.slice(),
		})),
	}
}

export function createPreparedPuzzle(
	puzzle: KillerPuzzle,
	difficulty: PooledDifficulty,
	generatedAt: number = Date.now(),
): PreparedPuzzleV1 {
	return {
		schemaVersion: PUZZLE_POOL_SCHEMA_VERSION,
		generatorVersion: PUZZLE_GENERATOR_VERSION,
		seed: puzzle.seed,
		difficulty,
		puzzle: serializeKillerPuzzle(puzzle),
		gradeLevel: difficulty,
		generatedAt,
	}
}

/**
 * Parse pool JSON. Corrupt / wrong-version pools return ok:false.
 * Valid pools drop individual corrupt items; generator mismatch clears all.
 */
export function parsePuzzlePool(raw: string | null): LoadPuzzlePoolResult {
	if (raw === null || raw.trim() === '') {
		return { ok: true, pool: createEmptyPuzzlePool() }
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
	const pool = parsed as Partial<PuzzlePoolV1>
	if (pool.schemaVersion !== PUZZLE_POOL_SCHEMA_VERSION) {
		return { ok: false, reason: 'schema-version' }
	}
	if (pool.generatorVersion !== PUZZLE_GENERATOR_VERSION) {
		return { ok: false, reason: 'generator-version' }
	}
	if (!Array.isArray(pool.items) || !Array.isArray(pool.recentSeeds)) {
		return { ok: false, reason: 'shape' }
	}

	const items: PreparedPuzzleV1[] = []
	for (const item of pool.items) {
		if (
			isValidPreparedItem(item) &&
			item.generatorVersion === PUZZLE_GENERATOR_VERSION
		) {
			items.push(item)
		}
	}

	const recentSeeds = pool.recentSeeds.filter(
		(seed) => typeof seed === 'number' && Number.isInteger(seed),
	)

	return {
		ok: true,
		pool: {
			schemaVersion: PUZZLE_POOL_SCHEMA_VERSION,
			generatorVersion: PUZZLE_GENERATOR_VERSION,
			items,
			recentSeeds: recentSeeds.slice(-POOL_RECENT_SEEDS_LIMIT),
		},
	}
}

export function serializePuzzlePool(pool: PuzzlePoolV1): string {
	return JSON.stringify(pool)
}

export function countPrepared(
	pool: PuzzlePoolV1,
	difficulty: PooledDifficulty,
): number {
	return pool.items.filter((item) => item.difficulty === difficulty).length
}

export function poolNeedsFill(pool: PuzzlePoolV1): boolean {
	for (const difficulty of POOLED_DIFFICULTIES) {
		if (countPrepared(pool, difficulty) < POOL_TARGET_COUNTS[difficulty]) {
			return true
		}
	}
	return false
}

export function nextFillDifficulty(
	pool: PuzzlePoolV1,
): PooledDifficulty | null {
	for (const difficulty of POOLED_DIFFICULTIES) {
		if (countPrepared(pool, difficulty) < POOL_TARGET_COUNTS[difficulty]) {
			return difficulty
		}
	}
	return null
}

/**
 * Atomically take the oldest prepared puzzle for a difficulty.
 * Returns null when empty. Mutates a copy — caller persists.
 */
export function consumePreparedPuzzle(
	pool: PuzzlePoolV1,
	difficulty: PooledDifficulty,
): { pool: PuzzlePoolV1; item: PreparedPuzzleV1 } | null {
	const index = pool.items.findIndex(
		(item) => item.difficulty === difficulty,
	)
	if (index < 0) {
		return null
	}
	const item = pool.items[index]!
	const items = pool.items.slice()
	items.splice(index, 1)
	const recentSeeds = [...pool.recentSeeds, item.seed].slice(
		-POOL_RECENT_SEEDS_LIMIT,
	)
	return {
		item,
		pool: {
			...pool,
			items,
			recentSeeds,
		},
	}
}

export function appendPreparedPuzzle(
	pool: PuzzlePoolV1,
	item: PreparedPuzzleV1,
): PuzzlePoolV1 {
	// Reject duplicates of an in-pool or recently used seed.
	if (
		pool.items.some((existing) => existing.seed === item.seed) ||
		pool.recentSeeds.includes(item.seed)
	) {
		return pool
	}
	const target = POOL_TARGET_COUNTS[item.difficulty]
	const current = countPrepared(pool, item.difficulty)
	if (current >= target) {
		return pool
	}
	return {
		...pool,
		items: [...pool.items, item],
	}
}

export function isSeedBlocked(pool: PuzzlePoolV1, seed: number): boolean {
	return (
		pool.items.some((item) => item.seed === seed) ||
		pool.recentSeeds.includes(seed)
	)
}
