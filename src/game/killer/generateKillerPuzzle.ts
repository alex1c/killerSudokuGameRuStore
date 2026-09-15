/**
 * Calibrated Killer Sudoku puzzle generation (Phase 6).
 *
 * seed → solved board → cages → uniqueness dig → grade calibrate → puzzle
 *
 * Search solver (`countKillerSolutions`) owns uniqueness.
 * Logical grader (`gradeDifficulty`) owns human difficulty acceptance.
 * Wrong grades and `unrated` are rejected — never silently remapped.
 */

import { createSeededRandom, shuffledCopy } from '../../utils/seededRandom'
import {
	getCagePreset,
	type Difficulty,
	type CageGenerationPreset,
} from '../difficulty'
import { gradeDifficulty } from '../logic'
import { generateSolvedBoard } from '../sudoku/generateSolvedBoard'
import {
	BOARD_CELLS,
	cloneBoard,
	createEmptyBoard,
	type SudokuBoard,
} from '../sudoku/types'
import { calibrateBoardToGrade } from './calibrateGrade'
import { generateKillerCages } from './cageGenerator'
import { type KillerCage } from './cages'
import { countKillerSolutions } from './solver'
import { validateKillerPuzzle } from './validator'
import { isValidSudoku } from '../sudoku/validation'

export interface GenerateKillerPuzzleOptions {
	seed: number
	difficultyPreset?: Difficulty
	preset?: CageGenerationPreset
	maxAttempts?: number
}

export interface KillerPuzzle {
	seed: number
	attempt: number
	difficultyPreset: Difficulty
	board: SudokuBoard
	solution: SudokuBoard
	cages: KillerCage[]
}

export class KillerPuzzleGenerationError extends Error {
	readonly seed: number
	readonly attempts: number
	readonly targetDifficulty: Difficulty

	constructor(
		seed: number,
		attempts: number,
		targetDifficulty: Difficulty,
		message: string,
	) {
		super(message)
		this.name = 'KillerPuzzleGenerationError'
		this.seed = seed
		this.attempts = attempts
		this.targetDifficulty = targetDifficulty
	}
}

/**
 * True when the known solution still satisfies the clue board + cages.
 * Cheaper than a full re-solve after uniqueness is already proven.
 */
function solutionMatchesPuzzle(
	solution: SudokuBoard,
	board: SudokuBoard,
	cages: readonly KillerCage[],
): boolean {
	if (!isValidSudoku(solution)) {
		return false
	}
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const clue = board[i] ?? 0
		if (clue !== 0 && clue !== solution[i]) {
			return false
		}
	}
	for (const cage of cages) {
		const digits = new Set<number>()
		let sum = 0
		for (const cell of cage.cells) {
			const digit = solution[cell] ?? 0
			if (digit < 1 || digit > 9 || digits.has(digit)) {
				return false
			}
			digits.add(digit)
			sum += digit
		}
		if (sum !== cage.sum) {
			return false
		}
	}
	return true
}

export interface DigGivensResult {
	board: SudokuBoard
	/** Cells successfully emptied, in dig order (first removed first). */
	removedCells: number[]
}

/**
 * Dig givens from a full solution while uniqueness holds.
 * Records removal order so calibrateBoardToGrade can re-add deterministically.
 */
export function digGivensWithOrder(
	solution: SudokuBoard,
	cages: readonly KillerCage[],
	seed: number,
	preset: CageGenerationPreset,
): DigGivensResult {
	const board = cloneBoard(solution)
	const rng = createSeededRandom(seed >>> 0)
	const order = shuffledCopy(
		Array.from({ length: BOARD_CELLS }, (_, index) => index),
		rng,
	)

	const removedCells: number[] = []
	let emptyCount = 0
	for (const index of order) {
		if (emptyCount >= preset.maxEmptyCells) {
			break
		}
		if (board[index] === 0) {
			continue
		}
		const backup = board[index]!
		board[index] = 0
		const solutions = countKillerSolutions(
			{ board, cages },
			2,
			preset.digNodeLimit,
		)
		if (solutions !== 1) {
			board[index] = backup
		} else {
			emptyCount += 1
			removedCells.push(index)
		}
	}

	return { board, removedCells }
}

/** Monotonic clock for generation instrumentation (dev + profiling). */
function monotonicMs(): number {
	if (
		typeof performance !== 'undefined' &&
		typeof performance.now === 'function'
	) {
		return performance.now()
	}
	return Date.now()
}

export type CalibratedAttemptResult =
	| { ok: true; puzzle: KillerPuzzle }
	| {
			ok: false
			reason:
				| 'validation'
				| 'non-unique'
				| 'solver-mismatch'
				| 'rejected-unrated'
				| 'rejected-wrong-grade'
				| 'calibrate-mismatch'
				| 'error'
			detail?: string
			observedGrade?: string
	  }

/**
 * One deterministic proposal attempt for (baseSeed, attempt, preset).
 * Used by generateKillerPuzzle and calibrated yield analysis.
 */
export function tryCalibratedKillerAttempt(options: {
	baseSeed: number
	attempt: number
	preset: CageGenerationPreset
}): CalibratedAttemptResult {
	const { baseSeed, attempt, preset } = options
	const target = preset.id
	const boardSeed = (baseSeed + attempt * 0x9e3779b9) >>> 0
	const cageSeed = (baseSeed ^ (attempt * 0x85ebca6b)) >>> 0
	const digSeed = (baseSeed + attempt * 0xc2b2ae35) >>> 0
	const fillSeed = (baseSeed ^ (attempt * 0x27d4eb2d)) >>> 0

	try {
		const solution = generateSolvedBoard(boardSeed)
		const cages = generateKillerCages(solution, cageSeed, { preset })

		const validation = validateKillerPuzzle({ solution, cages })
		if (!validation.valid) {
			return {
				ok: false,
				reason: 'validation',
				detail: validation.errors.map((error) => error.code).join(','),
			}
		}

		let board = createEmptyBoard()
		let removedCells: number[] = []
		let solutionCount = countKillerSolutions(
			{ board, cages },
			2,
			preset.cageOnlyNodeLimit,
		)

		if (solutionCount !== 1) {
			const dug = digGivensWithOrder(
				solution,
				cages,
				digSeed,
				preset,
			)
			board = dug.board
			removedCells = dug.removedCells
			solutionCount = countKillerSolutions(
				{ board, cages },
				2,
				preset.digNodeLimit,
			)
			if (solutionCount !== 1) {
				return {
					ok: false,
					reason: 'non-unique',
					detail: String(solutionCount),
				}
			}
		}

		if (!solutionMatchesPuzzle(solution, board, cages)) {
			return { ok: false, reason: 'solver-mismatch' }
		}

		const calibrated = calibrateBoardToGrade({
			solution,
			cages,
			board,
			removedCells,
			target,
			fillSeed,
		})

		if (calibrated === null) {
			const observed = gradeDifficulty({ board, cages }).level
			if (observed === 'unrated') {
				return {
					ok: false,
					reason: 'rejected-unrated',
					observedGrade: observed,
				}
			}
			return {
				ok: false,
				reason: 'rejected-wrong-grade',
				observedGrade: observed,
			}
		}

		if (calibrated.grade === 'unrated') {
			return {
				ok: false,
				reason: 'rejected-unrated',
				observedGrade: 'unrated',
			}
		}

		if (calibrated.grade !== target) {
			return {
				ok: false,
				reason: 'rejected-wrong-grade',
				observedGrade: calibrated.grade,
			}
		}

		if (!solutionMatchesPuzzle(solution, calibrated.board, cages)) {
			return { ok: false, reason: 'calibrate-mismatch' }
		}

		const finalCount = countKillerSolutions(
			{ board: calibrated.board, cages },
			2,
			preset.digNodeLimit,
		)
		if (finalCount !== 1) {
			return {
				ok: false,
				reason: 'non-unique',
				detail: `after-calibrate:${finalCount}`,
			}
		}

		return {
			ok: true,
			puzzle: {
				seed: baseSeed,
				attempt,
				difficultyPreset: target,
				board: calibrated.board,
				solution,
				cages,
			},
		}
	} catch (error) {
		return {
			ok: false,
			reason: 'error',
			detail: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * Generate a validated unique Killer puzzle whose logical grade matches
 * the requested difficulty. Deterministic for the same seed + difficulty.
 */
export function generateKillerPuzzle(
	options: GenerateKillerPuzzleOptions,
): KillerPuzzle {
	const baseSeed = options.seed >>> 0
	const preset =
		options.preset ?? getCagePreset(options.difficultyPreset)
	const target = preset.id
	const maxAttempts = options.maxAttempts ?? preset.maxAttempts
	const startedMs = monotonicMs()

	let lastError = 'unknown failure'

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const result = tryCalibratedKillerAttempt({
			baseSeed,
			attempt,
			preset,
		})
		if (result.ok) {
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				const generationMs = monotonicMs() - startedMs
				console.log(
					`[KILLER_GEN] difficulty=${target} seed=${baseSeed} attempt=${attempt} generationMs=${generationMs.toFixed(1)} grade=${target}`,
				)
			}
			return result.puzzle
		}

		lastError =
			result.reason === 'rejected-wrong-grade'
				? `rejected-wrong-grade:${result.observedGrade ?? '?'}`
				: result.reason === 'rejected-unrated'
					? 'rejected-unrated'
					: result.detail
						? `${result.reason}:${result.detail}`
						: result.reason
	}

	throw new KillerPuzzleGenerationError(
		baseSeed,
		maxAttempts,
		target,
		`Failed to generate graded Killer puzzle target=${target} seed=${baseSeed} after ${maxAttempts} attempts (${lastError})`,
	)
}
