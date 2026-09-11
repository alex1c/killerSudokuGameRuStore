/**
 * Classic Sudoku solver with bit-mask state and MRV heuristics.
 * Does not mutate the input board.
 */

import {
	BOARD_CELLS,
	BOARD_SIZE,
	assertBoardLength,
	boxIndex,
	cloneBoard,
	type SudokuBoard,
} from './types'
import { isValidSudoku } from './validation'

/** Bitmask of digits 1–9 (bits 1..9 set). */
const FULL_DIGIT_MASK = 0b1111111110

interface SolverState {
	board: SudokuBoard
	rowMask: number[]
	colMask: number[]
	boxMask: number[]
}

/**
 * Lowest set-bit digit for a single-bit mask.
 */
function digitFromBit(bit: number): number {
	let value = 0
	let current = bit
	while (current > 1) {
		current >>= 1
		value += 1
	}
	return value
}

/**
 * Build solver masks from the current board contents.
 */
function createState(board: SudokuBoard): SolverState | null {
	const rowMask = Array.from({ length: BOARD_SIZE }, () => 0)
	const colMask = Array.from({ length: BOARD_SIZE }, () => 0)
	const boxMask = Array.from({ length: BOARD_SIZE }, () => 0)

	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const value = board[i]!
		if (value === 0) {
			continue
		}
		if (value < 1 || value > 9) {
			return null
		}
		const bit = 1 << value
		const row = Math.floor(i / BOARD_SIZE)
		const col = i % BOARD_SIZE
		const box = boxIndex(row, col)
		if (
			(rowMask[row]! & bit) !== 0 ||
			(colMask[col]! & bit) !== 0 ||
			(boxMask[box]! & bit) !== 0
		) {
			return null
		}
		rowMask[row]! |= bit
		colMask[col]! |= bit
		boxMask[box]! |= bit
	}

	return { board, rowMask, colMask, boxMask }
}

/**
 * Candidates bitmask for an empty cell.
 */
function candidatesMask(state: SolverState, index: number): number {
	const row = Math.floor(index / BOARD_SIZE)
	const col = index % BOARD_SIZE
	const box = boxIndex(row, col)
	const used =
		state.rowMask[row]! | state.colMask[col]! | state.boxMask[box]!
	return FULL_DIGIT_MASK & ~used
}

/**
 * Count set bits in a 32-bit integer.
 */
function popcount(mask: number): number {
	let n = mask
	let count = 0
	while (n !== 0) {
		n &= n - 1
		count += 1
	}
	return count
}

/**
 * Choose the empty cell with the fewest candidates (MRV).
 * Returns -1 when the board is complete.
 * Returns -2 when some empty cell has zero candidates (dead end).
 */
function selectMrvCell(state: SolverState): number {
	let bestIndex = -1
	let bestCount = 10

	for (let i = 0; i < BOARD_CELLS; i += 1) {
		if (state.board[i] !== 0) {
			continue
		}
		const count = popcount(candidatesMask(state, i))
		if (count === 0) {
			return -2
		}
		if (count < bestCount) {
			bestCount = count
			bestIndex = i
			if (count === 1) {
				return bestIndex
			}
		}
	}
	return bestIndex
}

/**
 * Place a digit into the solver state.
 */
function place(
	state: SolverState,
	index: number,
	digit: number,
): void {
	const bit = 1 << digit
	const row = Math.floor(index / BOARD_SIZE)
	const col = index % BOARD_SIZE
	const box = boxIndex(row, col)
	state.board[index] = digit
	state.rowMask[row]! |= bit
	state.colMask[col]! |= bit
	state.boxMask[box]! |= bit
}

/**
 * Remove a digit from the solver state.
 */
function remove(
	state: SolverState,
	index: number,
	digit: number,
): void {
	const bit = 1 << digit
	const row = Math.floor(index / BOARD_SIZE)
	const col = index % BOARD_SIZE
	const box = boxIndex(row, col)
	state.board[index] = 0
	state.rowMask[row]! &= ~bit
	state.colMask[col]! &= ~bit
	state.boxMask[box]! &= ~bit
}

/**
 * Search that keeps placements when a solution is found (for solve).
 */
function searchKeep(state: SolverState): boolean {
	const index = selectMrvCell(state)
	if (index === -1) {
		return true
	}
	if (index === -2) {
		return false
	}

	let mask = candidatesMask(state, index)
	while (mask !== 0) {
		const bit = mask & -mask
		mask ^= bit
		const digit = digitFromBit(bit)

		place(state, index, digit)
		if (searchKeep(state)) {
			return true
		}
		remove(state, index, digit)
	}
	return false
}

/**
 * Search that always undoes placements and counts solutions up to `limit`.
 */
function searchCount(state: SolverState, limit: number): number {
	if (limit <= 0) {
		return 0
	}

	const index = selectMrvCell(state)
	if (index === -1) {
		return 1
	}
	if (index === -2) {
		return 0
	}

	let found = 0
	let mask = candidatesMask(state, index)
	while (mask !== 0) {
		const bit = mask & -mask
		mask ^= bit
		const digit = digitFromBit(bit)

		place(state, index, digit)
		found += searchCount(state, limit - found)
		remove(state, index, digit)

		if (found >= limit) {
			return found
		}
	}
	return found
}

/**
 * Solve a classic Sudoku puzzle.
 * Returns a new solved board, or null when unsatisfiable / invalid.
 * Input board is never mutated.
 */
export function solveSudoku(board: SudokuBoard): SudokuBoard | null {
	assertBoardLength(board)
	if (!isValidSudoku(board)) {
		return null
	}

	const working = cloneBoard(board)
	const state = createState(working)
	if (state === null) {
		return null
	}

	if (!searchKeep(state)) {
		return null
	}
	return working
}

/**
 * Count classic Sudoku solutions up to `limit`.
 * Stops early once `limit` solutions are found — use limit=2 for uniqueness.
 * Input board is never mutated.
 */
export function countSolutions(
	board: SudokuBoard,
	limit: number = Number.MAX_SAFE_INTEGER,
): number {
	assertBoardLength(board)
	if (limit <= 0) {
		return 0
	}
	if (!isValidSudoku(board)) {
		return 0
	}

	const working = cloneBoard(board)
	const state = createState(working)
	if (state === null) {
		return 0
	}
	return searchCount(state, limit)
}

/**
 * Convenience: true when the puzzle has exactly one solution.
 */
export function hasUniqueSolution(board: SudokuBoard): boolean {
	return countSolutions(board, 2) === 1
}
