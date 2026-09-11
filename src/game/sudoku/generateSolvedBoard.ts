/**
 * Deterministic solved-board generator driven by a seeded RNG.
 */

import { createSeededRandom, shuffledCopy } from '../../utils/seededRandom'
import {
	ALL_DIGITS,
	BOARD_CELLS,
	BOARD_SIZE,
	BOX_SIZE,
	createEmptyBoard,
	type SudokuBoard,
} from './types'
import { canPlaceDigit, isSolvedSudoku } from './validation'

/**
 * Fill the three independent diagonal boxes first, then solve the rest
 * with a seeded candidate order. This is a standard fast construction.
 */
function fillDiagonalBoxes(board: SudokuBoard, seed: number): void {
	const rng = createSeededRandom(seed ^ 0x11111111)
	for (let box = 0; box < BOARD_SIZE; box += BOX_SIZE + 1) {
		const digits = shuffledCopy(ALL_DIGITS, rng)
		let cursor = 0
		const startRow = Math.floor(box / BOX_SIZE) * BOX_SIZE
		const startCol = (box % BOX_SIZE) * BOX_SIZE
		for (let r = 0; r < BOX_SIZE; r += 1) {
			for (let c = 0; c < BOX_SIZE; c += 1) {
				board[(startRow + r) * BOARD_SIZE + (startCol + c)] =
					digits[cursor]!
				cursor += 1
			}
		}
	}
}

/**
 * Backtracking fill with seeded digit order for remaining empty cells.
 */
function fillRemaining(
	board: SudokuBoard,
	index: number,
	seed: number,
): boolean {
	if (index >= BOARD_CELLS) {
		return true
	}
	if (board[index] !== 0) {
		return fillRemaining(board, index + 1, seed)
	}

	const row = Math.floor(index / BOARD_SIZE)
	const col = index % BOARD_SIZE
	// Mix seed with index so each cell gets a stable but distinct shuffle.
	const cellRng = createSeededRandom(
		(seed ^ (index * 0x9e3779b9)) >>> 0,
	)
	const digits = shuffledCopy(ALL_DIGITS, cellRng)

	for (const digit of digits) {
		if (canPlaceDigit(board, row, col, digit)) {
			board[index] = digit
			if (fillRemaining(board, index + 1, seed)) {
				return true
			}
			board[index] = 0
		}
	}
	return false
}

/**
 * Generate a complete valid Sudoku solution for the given seed.
 * Same seed ⇒ same board. Different seeds usually differ.
 */
export function generateSolvedBoard(seed: number): SudokuBoard {
	const board = createEmptyBoard()
	fillDiagonalBoxes(board, seed)
	const ok = fillRemaining(board, 0, seed)
	if (!ok || !isSolvedSudoku(board)) {
		throw new Error(
			`generateSolvedBoard failed for seed=${seed}`,
		)
	}
	return board
}
