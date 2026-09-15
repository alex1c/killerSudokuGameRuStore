/**
 * Versioned saved-game schema for Phase 4 Continue / autosave.
 * Pure TypeScript — no React Native imports.
 */

import type { Difficulty } from '../game/difficulty'
import {
	validateKillerPuzzle,
	type KillerCage,
	type KillerPuzzle,
} from '../game/killer'
import { isValidSudoku, type SudokuBoard } from '../game/sudoku'
import type { GameState } from '../gameplay'

export const SAVED_GAME_SCHEMA_VERSION = 1 as const
export const ACTIVE_GAME_STORAGE_KEY = 'killerSudoku.activeGame.v1'
/** Dev-only Phase 4 QA namespace — never use for user Continue saves. */
export const PHASE4_QA_STORAGE_KEY = 'killerSudoku.dev.phase4qa'

export interface SerializedKillerPuzzleV1 {
	seed: number
	attempt: number
	difficultyPreset: Difficulty
	board: SudokuBoard
	solution: SudokuBoard
	cages: KillerCage[]
}

/**
 * Persisted active game (playing only).
 * Transient UI (selectedCell, modals, loading) is intentionally omitted.
 * Undo history is not persisted — history resets after restore.
 */
export interface SavedGameV1 {
	schemaVersion: typeof SAVED_GAME_SCHEMA_VERSION
	seed: number
	difficulty: Difficulty
	puzzle: SerializedKillerPuzzleV1
	values: number[]
	/** Note bitmasks (bits 1..9), length 81. */
	notes: number[]
	/** Elapsed playtime in milliseconds (paused). */
	elapsedMs: number
	status: 'playing'
	savedAt: number
}

export type LoadSavedGameResult =
	| { ok: true; save: SavedGameV1 }
	| { ok: false; reason: string }

function isNumberArray(value: unknown, length: number): value is number[] {
	return (
		Array.isArray(value) &&
		value.length === length &&
		value.every((item) => typeof item === 'number' && Number.isFinite(item))
	)
}

function isIntegerArrayInRange(
	value: unknown,
	length: number,
	min: number,
	max: number,
): value is number[] {
	return (
		isNumberArray(value, length) &&
		value.every(
			(item) => Number.isInteger(item) && item >= min && item <= max,
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

function isValidPersistedPuzzle(
	puzzle: SerializedKillerPuzzleV1,
): boolean {
	if (!isValidSudoku(puzzle.solution) || !isValidSudoku(puzzle.board)) {
		return false
	}
	for (let i = 0; i < puzzle.board.length; i += 1) {
		if (puzzle.board[i] !== 0 && puzzle.board[i] !== puzzle.solution[i]) {
			return false
		}
	}
	return validateKillerPuzzle({
		solution: puzzle.solution,
		cages: puzzle.cages,
	}).valid
}

/**
 * Serialize a playing GameState into SavedGameV1.
 */
export function serializeSavedGame(
	state: GameState,
	now: number = Date.now(),
): SavedGameV1 {
	const elapsedMs =
		state.timerRunningSince === null
			? state.timerAccumulatedMs
			: state.timerAccumulatedMs + (now - state.timerRunningSince)

	return {
		schemaVersion: SAVED_GAME_SCHEMA_VERSION,
		seed: state.puzzle.seed,
		difficulty: state.puzzle.difficultyPreset,
		puzzle: {
			seed: state.puzzle.seed,
			attempt: state.puzzle.attempt,
			difficultyPreset: state.puzzle.difficultyPreset,
			board: state.puzzle.board.slice(),
			solution: state.puzzle.solution.slice(),
			cages: state.puzzle.cages.map((cage) => ({
				id: cage.id,
				sum: cage.sum,
				cells: [...cage.cells],
			})),
		},
		values: state.values.slice(),
		notes: state.notes.slice(),
		elapsedMs: Math.max(0, Math.floor(elapsedMs)),
		status: 'playing',
		savedAt: now,
	}
}

/**
 * Parse and validate a saved-game JSON payload.
 */
export function parseSavedGame(raw: string | null): LoadSavedGameResult {
	if (raw === null || raw.trim() === '') {
		return { ok: false, reason: 'empty' }
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

	const candidate = parsed as Partial<SavedGameV1>
	if (candidate.schemaVersion !== SAVED_GAME_SCHEMA_VERSION) {
		return { ok: false, reason: 'unsupported-schema' }
	}
	if (candidate.status !== 'playing') {
		return { ok: false, reason: 'not-playing' }
	}
	if (typeof candidate.seed !== 'number' || !Number.isFinite(candidate.seed)) {
		return { ok: false, reason: 'bad-seed' }
	}
	if (
		candidate.difficulty !== 'easy' &&
		candidate.difficulty !== 'medium' &&
		candidate.difficulty !== 'hard' &&
		candidate.difficulty !== 'expert'
	) {
		return { ok: false, reason: 'bad-difficulty' }
	}
	if (
		typeof candidate.elapsedMs !== 'number' ||
		!Number.isFinite(candidate.elapsedMs) ||
		candidate.elapsedMs < 0
	) {
		return { ok: false, reason: 'bad-elapsed' }
	}
	if (
		typeof candidate.savedAt !== 'number' ||
		!Number.isFinite(candidate.savedAt)
	) {
		return { ok: false, reason: 'bad-savedAt' }
	}
	if (!isIntegerArrayInRange(candidate.values, 81, 0, 9)) {
		return { ok: false, reason: 'bad-values' }
	}
	if (!isIntegerArrayInRange(candidate.notes, 81, 0, 0b1111111110)) {
		return { ok: false, reason: 'bad-notes' }
	}

	const puzzle = candidate.puzzle as Partial<SerializedKillerPuzzleV1> | undefined
	if (!puzzle || typeof puzzle !== 'object') {
		return { ok: false, reason: 'missing-puzzle' }
	}
	if (!isNumberArray(puzzle.board, 81) || !isNumberArray(puzzle.solution, 81)) {
		return { ok: false, reason: 'bad-puzzle-boards' }
	}
	if (!Array.isArray(puzzle.cages) || puzzle.cages.length === 0) {
		return { ok: false, reason: 'bad-cages' }
	}
	if (!puzzle.cages.every(isValidCage)) {
		return { ok: false, reason: 'corrupt-cages' }
	}
	if (
		typeof puzzle.seed !== 'number' ||
		!Number.isFinite(puzzle.seed) ||
		typeof puzzle.attempt !== 'number' ||
		!Number.isInteger(puzzle.attempt) ||
		puzzle.attempt < 0 ||
		puzzle.difficultyPreset !== candidate.difficulty
	) {
		return { ok: false, reason: 'bad-puzzle-meta' }
	}
	if (!isValidPersistedPuzzle(puzzle as SerializedKillerPuzzleV1)) {
		return { ok: false, reason: 'invalid-puzzle' }
	}

	return {
		ok: true,
		save: {
			schemaVersion: SAVED_GAME_SCHEMA_VERSION,
			seed: candidate.seed,
			difficulty: candidate.difficulty,
			puzzle: {
				seed: puzzle.seed,
				attempt: puzzle.attempt,
				difficultyPreset: puzzle.difficultyPreset,
				board: puzzle.board,
				solution: puzzle.solution,
				cages: puzzle.cages,
			},
			values: candidate.values,
			notes: candidate.notes,
			elapsedMs: candidate.elapsedMs,
			status: 'playing',
			savedAt: candidate.savedAt,
		},
	}
}

/**
 * Restore a GameState from a validated save (history empty, timer paused).
 */
export function restoreGameFromSave(save: SavedGameV1): GameState {
	const puzzle: KillerPuzzle = {
		seed: save.puzzle.seed,
		attempt: save.puzzle.attempt,
		difficultyPreset: save.puzzle.difficultyPreset,
		board: save.puzzle.board.slice(),
		solution: save.puzzle.solution.slice(),
		cages: save.puzzle.cages.map((cage) => ({
			id: cage.id,
			sum: cage.sum,
			cells: [...cage.cells],
		})),
	}

	return {
		puzzle,
		values: save.values.slice(),
		notes: save.notes.slice(),
		selectedCell: null,
		notesMode: false,
		timerAccumulatedMs: save.elapsedMs,
		timerRunningSince: null,
		status: 'playing',
		history: [],
		mistakes: 0,
	}
}

/**
 * Progress over editable (non-given) cells, 0..1.
 */
export function computeEditableProgress(
	puzzleBoard: readonly number[],
	values: readonly number[],
): number {
	let editable = 0
	let filled = 0
	for (let i = 0; i < puzzleBoard.length; i += 1) {
		if ((puzzleBoard[i] ?? 0) !== 0) {
			continue
		}
		editable += 1
		if ((values[i] ?? 0) !== 0) {
			filled += 1
		}
	}
	if (editable === 0) {
		return 1
	}
	return filled / editable
}

export function formatProgressPercent(progress: number): string {
	return `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
}
