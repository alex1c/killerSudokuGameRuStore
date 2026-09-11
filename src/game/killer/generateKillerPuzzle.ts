/**
 * Full Killer Sudoku puzzle generation pipeline.
 *
 * seed → solved board → cages → minimize givens under Killer uniqueness → puzzle
 *
 * Uniqueness is always checked with Killer constraints (cages + remaining givens).
 * The generator prefers cage-only boards and keeps minimal givens only when needed.
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
import {
	countKillerSolutions,
	solveKillerSudoku,
	DEFAULT_KILLER_NODE_LIMIT,
} from './solver'
import { validateKillerPuzzle } from './validator'

export interface GenerateKillerPuzzleOptions {
	seed: number
	/** Architectural difficulty preset (not a human grader). */
	difficultyPreset?: Difficulty
	/** Optional raw preset override. */
	preset?: CageGenerationPreset
	/** Override attempt budget. */
	maxAttempts?: number
}

export interface KillerPuzzle {
	seed: number
	/** Attempt index that succeeded (0-based). */
	attempt: number
	difficultyPreset: Difficulty
	/**
	 * Starting board clues (0 = empty).
	 * Prefer empty (cage-only); may keep minimal givens for uniqueness.
	 */
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

function boardsEqual(a: SudokuBoard, b: SudokuBoard): boolean {
	if (a.length !== b.length) {
		return false
	}
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) {
			return false
		}
	}
	return true
}

/**
 * Remove as many givens as possible while preserving Killer uniqueness.
 * Starts from the full solution so uniqueness is initially guaranteed.
 */
function minimizeGivens(
	solution: SudokuBoard,
	cages: readonly KillerCage[],
	seed: number,
	nodeLimit: number,
): SudokuBoard {
	const board = cloneBoard(solution)
	const rng = createSeededRandom(seed >>> 0)
	const order = shuffledCopy(
		Array.from({ length: BOARD_CELLS }, (_, index) => index),
		rng,
	)

	for (const index of order) {
		if (board[index] === 0) {
			continue
		}
		const backup = board[index]!
		board[index] = 0
		const solutions = countKillerSolutions(
			{ board, cages },
			2,
			nodeLimit,
		)
		if (solutions !== 1) {
			board[index] = backup
		}
	}

	return board
}

/**
 * Generate a validated unique Killer puzzle for the given seed.
 * Retries cage layouts up to maxAttempts. Never loops forever.
 */
export function generateKillerPuzzle(
	options: GenerateKillerPuzzleOptions,
): KillerPuzzle {
	const baseSeed = options.seed >>> 0
	const preset =
		options.preset ?? getCagePreset(options.difficultyPreset)
	const maxAttempts = options.maxAttempts ?? preset.maxAttempts
	const nodeLimit = DEFAULT_KILLER_NODE_LIMIT

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

			// Fast path: try cage-only uniqueness first.
			let board = createEmptyBoard()
			let solutionCount = countKillerSolutions(
				{ board, cages },
				2,
				nodeLimit,
			)

			if (solutionCount !== 1) {
				// Guaranteed-unique path: dig givens from the full solution.
				board = minimizeGivens(solution, cages, digSeed, nodeLimit)
				solutionCount = countKillerSolutions(
					{ board, cages },
					2,
					nodeLimit,
				)
				if (solutionCount !== 1) {
					lastError = `non-unique-after-dig:${solutionCount}`
					continue
				}
			}

			const solved = solveKillerSudoku({ board, cages })
			if (solved === null || !boardsEqual(solved, solution)) {
				lastError = 'solver-mismatch'
				continue
			}

			return {
				seed: baseSeed,
				attempt,
				difficultyPreset: preset.id,
				board,
				solution,
				cages,
			}
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
