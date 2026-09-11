/**
 * Core Sudoku domain types.
 * Board is always length 81; empty cells use 0.
 */

/** Legal filled digit on a classic / Killer Sudoku grid. */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Flat cell index in [0, 80]. */
export type CellIndex = number

/** Row/column coordinates in [0, 8]. */
export interface CellPosition {
	row: number
	col: number
}

/**
 * Flat 9×9 board representation.
 * Index mapping: index = row * 9 + col.
 * Values: 0 = empty, 1–9 = digit.
 */
export type SudokuBoard = number[]

export const BOARD_SIZE = 9
export const BOARD_CELLS = 81
export const BOX_SIZE = 3

/** All digits 1–9 as a reusable constant array. */
export const ALL_DIGITS: readonly Digit[] = [
	1, 2, 3, 4, 5, 6, 7, 8, 9,
]

/**
 * Convert flat index to row/col.
 */
export function indexToPosition(index: CellIndex): CellPosition {
	return {
		row: Math.floor(index / BOARD_SIZE),
		col: index % BOARD_SIZE,
	}
}

/**
 * Convert row/col to flat index.
 */
export function positionToIndex(row: number, col: number): CellIndex {
	return row * BOARD_SIZE + col
}

/**
 * Box index (0–8) for a cell.
 */
export function boxIndex(row: number, col: number): number {
	return Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(col / BOX_SIZE)
}

/**
 * Box index from flat cell index.
 */
export function boxIndexFromCell(index: CellIndex): number {
	const { row, col } = indexToPosition(index)
	return boxIndex(row, col)
}

/**
 * Create an empty 81-cell board filled with zeros.
 */
export function createEmptyBoard(): SudokuBoard {
	return Array.from({ length: BOARD_CELLS }, () => 0)
}

/**
 * Shallow-safe board copy.
 */
export function cloneBoard(board: SudokuBoard): SudokuBoard {
	return board.slice()
}

/**
 * Assert board length is 81. Throws on invalid length.
 */
export function assertBoardLength(board: SudokuBoard): void {
	if (board.length !== BOARD_CELLS) {
		throw new Error(
			`Sudoku board must have ${BOARD_CELLS} cells, got ${board.length}`,
		)
	}
}

/**
 * Orthogonal (4-direction) neighbor indices for a cell.
 */
export function orthogonalNeighbors(index: CellIndex): CellIndex[] {
	const { row, col } = indexToPosition(index)
	const result: CellIndex[] = []
	if (row > 0) {
		result.push(positionToIndex(row - 1, col))
	}
	if (row < BOARD_SIZE - 1) {
		result.push(positionToIndex(row + 1, col))
	}
	if (col > 0) {
		result.push(positionToIndex(row, col - 1))
	}
	if (col < BOARD_SIZE - 1) {
		result.push(positionToIndex(row, col + 1))
	}
	return result
}
