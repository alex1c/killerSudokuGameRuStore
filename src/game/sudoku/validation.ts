/**
 * Classic Sudoku validity helpers (rows / columns / 3×3 boxes).
 */

import {
	ALL_DIGITS,
	BOARD_CELLS,
	BOARD_SIZE,
	BOX_SIZE,
	assertBoardLength,
	boxIndex,
	type SudokuBoard,
} from './types'

/**
 * Returns true when a digit may be placed at (row, col)
 * without violating row / column / box uniqueness.
 * Does not mutate the board.
 */
export function canPlaceDigit(
	board: SudokuBoard,
	row: number,
	col: number,
	digit: number,
): boolean {
	for (let c = 0; c < BOARD_SIZE; c += 1) {
		if (board[row * BOARD_SIZE + c] === digit) {
			return false
		}
	}
	for (let r = 0; r < BOARD_SIZE; r += 1) {
		if (board[r * BOARD_SIZE + col] === digit) {
			return false
		}
	}
	const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE
	const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE
	for (let r = boxRow; r < boxRow + BOX_SIZE; r += 1) {
		for (let c = boxCol; c < boxCol + BOX_SIZE; c += 1) {
			if (board[r * BOARD_SIZE + c] === digit) {
				return false
			}
		}
	}
	return true
}

/**
 * Validates that every filled cell respects Sudoku rules and
 * that all values are in {0..9}. Empty cells (0) are allowed.
 */
export function isValidSudoku(board: SudokuBoard): boolean {
	assertBoardLength(board)

	const rows = Array.from({ length: BOARD_SIZE }, () => 0)
	const cols = Array.from({ length: BOARD_SIZE }, () => 0)
	const boxes = Array.from({ length: BOARD_SIZE }, () => 0)

	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const value = board[i]
		if (value === undefined || value < 0 || value > 9 || !Number.isInteger(value)) {
			return false
		}
		if (value === 0) {
			continue
		}
		const bit = 1 << value
		const row = Math.floor(i / BOARD_SIZE)
		const col = i % BOARD_SIZE
		const box = boxIndex(row, col)
		if (
			(rows[row]! & bit) !== 0 ||
			(cols[col]! & bit) !== 0 ||
			(boxes[box]! & bit) !== 0
		) {
			return false
		}
		rows[row]! |= bit
		cols[col]! |= bit
		boxes[box]! |= bit
	}
	return true
}

/**
 * Returns true when the board is fully filled and valid.
 */
export function isSolvedSudoku(board: SudokuBoard): boolean {
	if (!isValidSudoku(board)) {
		return false
	}
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const value = board[i]
		if (value === undefined || value < 1 || value > 9) {
			return false
		}
	}
	// Each unit must contain all digits 1–9 exactly once.
	for (let unit = 0; unit < BOARD_SIZE; unit += 1) {
		let rowMask = 0
		let colMask = 0
		let boxMask = 0
		for (let k = 0; k < BOARD_SIZE; k += 1) {
			rowMask |= 1 << board[unit * BOARD_SIZE + k]!
			colMask |= 1 << board[k * BOARD_SIZE + unit]!
			const boxRow = Math.floor(unit / BOX_SIZE) * BOX_SIZE + Math.floor(k / BOX_SIZE)
			const boxCol = (unit % BOX_SIZE) * BOX_SIZE + (k % BOX_SIZE)
			boxMask |= 1 << board[boxRow * BOARD_SIZE + boxCol]!
		}
		const full = ALL_DIGITS.reduce((mask, d) => mask | (1 << d), 0)
		if (rowMask !== full || colMask !== full || boxMask !== full) {
			return false
		}
	}
	return true
}
