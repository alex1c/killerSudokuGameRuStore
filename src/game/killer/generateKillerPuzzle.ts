/**
 * Full Killer Sudoku puzzle generation pipeline (Phase 4 performance).
 *
 * seed → solved board → cages → uniqueness → optional dig → puzzle
 *
 * Dig is capped by preset.maxEmptyCells and soft node budgets so mobile
 * devices do not spend tens of seconds proving uniqueness on sparse boards.
 */

import { createSeededRandom, shuffledCopy } from '../../utils/seededRandom'
import {
	getCagePreset,
	type Difficulty,
	type CageGenerationPreset,
} from '../difficulty'
import { generateSolvedBoard } from '../sudoku/generateSolvedBoard'
import {
	BOARD_CELLS,
	cloneBoard,
	createEmptyBoard,
	type SudokuBoard,
} from '../sudoku/types'
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

	constructor(seed: number, attempts: number, message: string) {
		super(message)
		this.name = 'KillerPuzzleGenerationError'
		this.seed = seed
		this.attempts = attempts
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

/**
 * Dig givens from a full solution while uniqueness holds.
 * Stops early when maxEmptyCells is reached to keep dig cheap on device.
 */
function minimizeGivens(
	solution: SudokuBoard,
	cages: readonly KillerCage[],
	seed: number,
	preset: CageGenerationPreset,
): SudokuBoard {
	const board = cloneBoard(solution)
	const rng = createSeededRandom(seed >>> 0)
	const order = shuffledCopy(
		Array.from({ length: BOARD_CELLS }, (_, index) => index),
		rng,
	)

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
		}
	}

	return board
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

/**
 * Generate a validated unique Killer puzzle for the given seed.
 */
export function generateKillerPuzzle(
	options: GenerateKillerPuzzleOptions,
): KillerPuzzle {
	const baseSeed = options.seed >>> 0
	const preset =
		options.preset ?? getCagePreset(options.difficultyPreset)
	const maxAttempts = options.maxAttempts ?? preset.maxAttempts
	const startedMs = monotonicMs()

	let lastError = 'unknown failure'

	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const boardSeed = (baseSeed + attempt * 0x9e3779b9) >>> 0
		const cageSeed = (baseSeed ^ (attempt * 0x85ebca6b)) >>> 0
		const digSeed = (baseSeed + attempt * 0xc2b2ae35) >>> 0

		try {
			const solution = generateSolvedBoard(boardSeed)
			const cages = generateKillerCages(solution, cageSeed, {
				preset,
			})

			const validation = validateKillerPuzzle({ solution, cages })
			if (!validation.valid) {
				lastError = validation.errors
					.map((error) => error.code)
					.join(',')
				continue
			}

			let board = createEmptyBoard()
			let solutionCount = countKillerSolutions(
				{ board, cages },
				2,
				preset.cageOnlyNodeLimit,
			)

			if (solutionCount !== 1) {
				board = minimizeGivens(solution, cages, digSeed, preset)
				solutionCount = countKillerSolutions(
					{ board, cages },
					2,
					preset.digNodeLimit,
				)
				if (solutionCount !== 1) {
					lastError = `non-unique-after-dig:${solutionCount}`
					continue
				}
			}

			if (!solutionMatchesPuzzle(solution, board, cages)) {
				lastError = 'solver-mismatch'
				continue
			}

			const puzzle: KillerPuzzle = {
				seed: baseSeed,
				attempt,
				difficultyPreset: preset.id,
				board,
				solution,
				cages,
			}

			// Development-only: actual engine generation time (not UI loading).
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				const generationMs = monotonicMs() - startedMs
				console.log(
					`[KILLER_GEN] difficulty=${preset.id} seed=${baseSeed} generationMs=${generationMs.toFixed(1)}`,
				)
			}

			return puzzle
		} catch (error) {
			lastError =
				error instanceof Error ? error.message : String(error)
		}
	}

	throw new KillerPuzzleGenerationError(
		baseSeed,
		maxAttempts,
		`Failed to generate unique Killer puzzle for seed=${baseSeed} after ${maxAttempts} attempts (${lastError})`,
	)
}
