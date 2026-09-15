/**
 * Calibrate a unique Killer board to a requested human difficulty grade.
 *
 * Search uniqueness is already established. This module only adjusts givens
 * (never cages) and asks gradeDifficulty — it does not change grader weights.
 *
 * Phase 6P: binary search on fill-prefix length to cut logical-grader calls,
 * then a short linear refine. Final board always passes a full gradeDifficulty.
 */

import type { Difficulty } from '../difficulty'
import { gradeDifficulty, type DifficultyLevel } from '../logic'
import {
	BOARD_CELLS,
	cloneBoard,
	type SudokuBoard,
} from '../sudoku/types'
import type { KillerCage } from './cages'
import { createSeededRandom, shuffledCopy } from '../../utils/seededRandom'

/** Ordered hardness for grade comparisons (unrated = hardest / unusable). */
export function difficultyRank(level: DifficultyLevel): number {
	switch (level) {
		case 'easy':
			return 0
		case 'medium':
			return 1
		case 'hard':
			return 2
		case 'expert':
			return 3
		case 'unrated':
			return 4
		default:
			return 4
	}
}

export interface CalibrateBoardResult {
	board: SudokuBoard
	grade: DifficultyLevel
	givensAdded: number
	/** How many full gradeDifficulty calls ran during calibration. */
	logicalSolverCalls: number
}

/**
 * Build deterministic order for re-adding givens.
 * Prefer reverse dig-removal order; fall back to a seeded shuffle of empties.
 */
export function buildGivenFillOrder(
	board: SudokuBoard,
	removedCells: readonly number[],
	fillSeed: number,
): number[] {
	if (removedCells.length > 0) {
		return removedCells.slice().reverse()
	}
	const empties: number[] = []
	for (let cell = 0; cell < BOARD_CELLS; cell += 1) {
		if ((board[cell] ?? 0) === 0) {
			empties.push(cell)
		}
	}
	return shuffledCopy(empties, createSeededRandom(fillSeed >>> 0))
}

/**
 * Apply the first `count` fill-order cells as givens from the solution.
 */
function applyFillPrefix(
	base: SudokuBoard,
	solution: SudokuBoard,
	fillOrder: readonly number[],
	count: number,
): SudokuBoard {
	const board = cloneBoard(base)
	let added = 0
	for (let i = 0; i < fillOrder.length && added < count; i += 1) {
		const cell = fillOrder[i]!
		if ((board[cell] ?? 0) !== 0) {
			continue
		}
		const digit = solution[cell] ?? 0
		if (digit < 1 || digit > 9) {
			continue
		}
		board[cell] = digit
		added += 1
	}
	return board
}

/**
 * Adjust givens so gradeDifficulty(board) === target.
 *
 * - If already target → return as-is.
 * - If too easy → impossible by adding givens → null.
 * - If too hard / unrated → re-add solution digits until target.
 *
 * Uses binary search on fill-prefix length (grade is roughly monotonic in
 * given count), then linear refine with overshoot undo for exact landing.
 */
export function calibrateBoardToGrade(options: {
	solution: SudokuBoard
	cages: readonly KillerCage[]
	board: SudokuBoard
	removedCells: readonly number[]
	target: Difficulty
	fillSeed: number
}): CalibrateBoardResult | null {
	const { solution, cages, target, fillSeed } = options
	const base = cloneBoard(options.board)
	let logicalSolverCalls = 0

	const gradeOnce = (board: SudokuBoard) => {
		logicalSolverCalls += 1
		return gradeDifficulty({ board, cages })
	}

	let grade = gradeOnce(base)
	const targetRank = difficultyRank(target)

	if (grade.level === target) {
		return {
			board: base,
			grade: grade.level,
			givensAdded: 0,
			logicalSolverCalls,
		}
	}

	if (difficultyRank(grade.level) < targetRank) {
		return null
	}

	const fillOrder = buildGivenFillOrder(
		base,
		options.removedCells,
		fillSeed,
	)
	const maxFill = fillOrder.length

	// Binary search: more givens → easier grade (approximately monotonic).
	let low = 0
	let high = maxFill
	let hitPrefix = -1

	while (low <= high) {
		const mid = (low + high) >> 1
		const candidate = applyFillPrefix(base, solution, fillOrder, mid)
		grade = gradeOnce(candidate)
		const rank = difficultyRank(grade.level)
		if (grade.level === target) {
			hitPrefix = mid
			// Prefer fewer givens when multiple prefixes grade as target.
			high = mid - 1
		} else if (rank > targetRank) {
			low = mid + 1
		} else {
			high = mid - 1
		}
	}

	if (hitPrefix >= 0) {
		const board = applyFillPrefix(base, solution, fillOrder, hitPrefix)
		const finalGrade = gradeOnce(board)
		if (finalGrade.level === target) {
			return {
				board,
				grade: finalGrade.level,
				givensAdded: hitPrefix,
				logicalSolverCalls,
			}
		}
	}

	// Linear refine from the binary-search bracket (handles non-monotonic edges).
	const start = Math.max(0, high)
	const board = applyFillPrefix(base, solution, fillOrder, start)
	let givensAdded = start
	grade = gradeOnce(board)
	if (grade.level === target) {
		return {
			board,
			grade: grade.level,
			givensAdded,
			logicalSolverCalls,
		}
	}

	for (let i = start; i < fillOrder.length; i += 1) {
		const cell = fillOrder[i]!
		if ((board[cell] ?? 0) !== 0) {
			continue
		}
		const digit = solution[cell] ?? 0
		if (digit < 1 || digit > 9) {
			continue
		}
		board[cell] = digit
		givensAdded += 1
		grade = gradeOnce(board)
		if (grade.level === target) {
			return {
				board,
				grade: grade.level,
				givensAdded,
				logicalSolverCalls,
			}
		}
		if (difficultyRank(grade.level) < targetRank) {
			board[cell] = 0
			givensAdded -= 1
		}
	}

	grade = gradeOnce(board)
	if (grade.level === target) {
		return {
			board,
			grade: grade.level,
			givensAdded,
			logicalSolverCalls,
		}
	}
	return null
}
