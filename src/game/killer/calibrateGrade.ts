/**
 * Calibrate a unique Killer board to a requested human difficulty grade.
 *
 * Search uniqueness is already established. This module only adjusts givens
 * (never cages) and asks gradeDifficulty — it does not change grader weights.
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
 * Adjust givens so gradeDifficulty(board) === target.
 *
 * - If already target → return as-is.
 * - If too easy → impossible by adding givens → null.
 * - If too hard / unrated → re-add solution digits in fill order until target.
 *   Overshooting to easier than target undoes that given and continues.
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
	const board = cloneBoard(options.board)
	let grade = gradeDifficulty({ board, cages })
	const targetRank = difficultyRank(target)

	if (grade.level === target) {
		return { board, grade: grade.level, givensAdded: 0 }
	}

	if (difficultyRank(grade.level) < targetRank) {
		return null
	}

	const fillOrder = buildGivenFillOrder(
		board,
		options.removedCells,
		fillSeed,
	)
	let givensAdded = 0

	for (const cell of fillOrder) {
		if ((board[cell] ?? 0) !== 0) {
			continue
		}
		const digit = solution[cell] ?? 0
		if (digit < 1 || digit > 9) {
			continue
		}
		board[cell] = digit
		givensAdded += 1
		grade = gradeDifficulty({ board, cages })
		if (grade.level === target) {
			return { board, grade: grade.level, givensAdded }
		}
		if (difficultyRank(grade.level) < targetRank) {
			// Overshot below target — undo and try another cell.
			board[cell] = 0
			givensAdded -= 1
		}
	}

	grade = gradeDifficulty({ board, cages })
	if (grade.level === target) {
		return { board, grade: grade.level, givensAdded }
	}
	return null
}
