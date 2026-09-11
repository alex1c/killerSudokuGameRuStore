/**
 * Killer Sudoku solver (search + MRV + cage pruning).
 * Enforces row / column / box uniqueness AND cage sum / digit uniqueness.
 */

import {
	BOARD_CELLS,
	BOARD_SIZE,
	assertBoardLength,
	boxIndex,
	cloneBoard,
	createEmptyBoard,
	type SudokuBoard,
} from '../sudoku/types'
import { isValidSudoku } from '../sudoku/validation'
import { type KillerCage } from './cages'
import { hasCageCombinationMask } from './combinations'

/** Bits 1..9 set. */
const FULL_DIGIT_MASK = 0b1111111110

export interface KillerPuzzleInput {
	/** Starting clues (0 = empty). Usually all zeros for Phase 1. */
	board?: SudokuBoard
	cages: readonly KillerCage[]
}

interface CageRuntime {
	cells: number[]
	sum: number
	/** Index into emptyCells list positions — tracked via board values. */
}

interface KillerState {
	board: SudokuBoard
	rowMask: number[]
	colMask: number[]
	boxMask: number[]
	/** Per-cage: bitmask of digits already placed. */
	cageDigitMask: number[]
	/** Per-cage: remaining sum still to place. */
	cageRemainingSum: number[]
	/** Per-cage: count of still-empty cells. */
	cageEmptyCount: number[]
	/** Cell index → cage index. */
	cellCage: number[]
	cages: CageRuntime[]
	/** Nodes explored; used as a safety brake. */
	nodes: number
	/** Soft cap on explored nodes (0 = unlimited). */
	nodeLimit: number
}

/**
 * Lowest set-bit digit (bit must be a single power of two in 1..9).
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
 * Build runtime solver state. Returns null when the input is inconsistent.
 */
function createKillerState(
	input: KillerPuzzleInput,
	nodeLimit: number = 0,
): KillerState | null {
	const board = cloneBoard(input.board ?? createEmptyBoard())
	assertBoardLength(board)
	if (!isValidSudoku(board)) {
		return null
	}
	if (input.cages.length === 0) {
		return null
	}

	const cellCage = Array.from({ length: BOARD_CELLS }, () => -1)
	const cages: CageRuntime[] = []
	const cageDigitMask: number[] = []
	const cageRemainingSum: number[] = []
	const cageEmptyCount: number[] = []

	for (let cageIndex = 0; cageIndex < input.cages.length; cageIndex += 1) {
		const cage = input.cages[cageIndex]!
		if (cage.cells.length === 0) {
			return null
		}

		let placedSum = 0
		let placedMask = 0
		let empty = 0

		for (const cell of cage.cells) {
			if (cell < 0 || cell >= BOARD_CELLS || cellCage[cell] !== -1) {
				return null
			}
			cellCage[cell] = cageIndex
			const value = board[cell]!
			if (value === 0) {
				empty += 1
			} else {
				const bit = 1 << value
				if ((placedMask & bit) !== 0) {
					return null
				}
				placedMask |= bit
				placedSum += value
			}
		}

		const remainingSum = cage.sum - placedSum
		if (remainingSum < 0) {
			return null
		}
		if (empty === 0 && remainingSum !== 0) {
			return null
		}
		if (
			empty > 0 &&
			!hasCageCombinationMask(empty, remainingSum, placedMask)
		) {
			return null
		}

		cages.push({ cells: [...cage.cells], sum: cage.sum })
		cageDigitMask.push(placedMask)
		cageRemainingSum.push(remainingSum)
		cageEmptyCount.push(empty)
	}

	for (let i = 0; i < BOARD_CELLS; i += 1) {
		if (cellCage[i] === -1) {
			return null
		}
	}

	const rowMask = Array.from({ length: BOARD_SIZE }, () => 0)
	const colMask = Array.from({ length: BOARD_SIZE }, () => 0)
	const boxMask = Array.from({ length: BOARD_SIZE }, () => 0)

	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const value = board[i]!
		if (value === 0) {
			continue
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

	return {
		board,
		rowMask,
		colMask,
		boxMask,
		cageDigitMask,
		cageRemainingSum,
		cageEmptyCount,
		cellCage,
		cages,
		nodes: 0,
		nodeLimit,
	}
}

/**
 * Sudoku ∪ cage candidate mask for an empty cell.
 */
function cellCandidates(state: KillerState, index: number): number {
	const row = Math.floor(index / BOARD_SIZE)
	const col = index % BOARD_SIZE
	const box = boxIndex(row, col)
	const cageIndex = state.cellCage[index]!
	const cageUsed = state.cageDigitMask[cageIndex]!
	const used =
		state.rowMask[row]! |
		state.colMask[col]! |
		state.boxMask[box]! |
		cageUsed
	let mask = FULL_DIGIT_MASK & ~used

	const emptyCount = state.cageEmptyCount[cageIndex]!
	const remainingSum = state.cageRemainingSum[cageIndex]!

	let filtered = 0
	let bits = mask
	while (bits !== 0) {
		const bit = bits & -bits
		bits ^= bit
		const digit = digitFromBit(bit)
		const nextEmpty = emptyCount - 1
		const nextSum = remainingSum - digit
		if (nextEmpty === 0) {
			if (nextSum === 0) {
				filtered |= bit
			}
			continue
		}
		if (
			nextSum > 0 &&
			hasCageCombinationMask(
				nextEmpty,
				nextSum,
				cageUsed | (1 << digit),
			)
		) {
			filtered |= bit
		}
	}
	return filtered
}

function selectMrvCell(state: KillerState): number {
	let bestIndex = -1
	let bestCount = 10

	for (let i = 0; i < BOARD_CELLS; i += 1) {
		if (state.board[i] !== 0) {
			continue
		}
		const count = popcount(cellCandidates(state, i))
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

function place(state: KillerState, index: number, digit: number): void {
	const bit = 1 << digit
	const row = Math.floor(index / BOARD_SIZE)
	const col = index % BOARD_SIZE
	const box = boxIndex(row, col)
	const cageIndex = state.cellCage[index]!

	state.board[index] = digit
	state.rowMask[row]! |= bit
	state.colMask[col]! |= bit
	state.boxMask[box]! |= bit
	state.cageDigitMask[cageIndex]! |= bit
	state.cageRemainingSum[cageIndex]! -= digit
	state.cageEmptyCount[cageIndex]! -= 1
}

function remove(state: KillerState, index: number, digit: number): void {
	const bit = 1 << digit
	const row = Math.floor(index / BOARD_SIZE)
	const col = index % BOARD_SIZE
	const box = boxIndex(row, col)
	const cageIndex = state.cellCage[index]!

	state.board[index] = 0
	state.rowMask[row]! &= ~bit
	state.colMask[col]! &= ~bit
	state.boxMask[box]! &= ~bit
	state.cageDigitMask[cageIndex]! &= ~bit
	state.cageRemainingSum[cageIndex]! += digit
	state.cageEmptyCount[cageIndex]! += 1
}

/**
 * Search that keeps placements when a solution is found (for solve).
 */
function searchKeep(state: KillerState): boolean {
	state.nodes += 1
	if (state.nodeLimit > 0 && state.nodes > state.nodeLimit) {
		return false
	}

	const index = selectMrvCell(state)
	if (index === -1) {
		return true
	}
	if (index === -2) {
		return false
	}

	let mask = cellCandidates(state, index)
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
function searchCount(state: KillerState, limit: number): number {
	if (limit <= 0) {
		return 0
	}
	state.nodes += 1
	if (state.nodeLimit > 0 && state.nodes > state.nodeLimit) {
		// Treat budget exhaustion as "not enough evidence of uniqueness".
		return limit
	}

	const index = selectMrvCell(state)
	if (index === -1) {
		return 1
	}
	if (index === -2) {
		return 0
	}

	let found = 0
	let mask = cellCandidates(state, index)
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

/** Default node budget for generator uniqueness checks. */
export const DEFAULT_KILLER_NODE_LIMIT = 250_000

/**
 * Solve a Killer Sudoku puzzle.
 * Returns a new board or null. Never mutates the input board array.
 */
export function solveKillerSudoku(
	puzzle: KillerPuzzleInput,
): SudokuBoard | null {
	const state = createKillerState(puzzle, 0)
	if (state === null) {
		return null
	}
	if (!searchKeep(state)) {
		return null
	}
	return state.board
}

/**
 * Count Killer solutions up to `limit` (use 2 for uniqueness checks).
 */
export function countKillerSolutions(
	puzzle: KillerPuzzleInput,
	limit: number = Number.MAX_SAFE_INTEGER,
	nodeLimit: number = 0,
): number {
	if (limit <= 0) {
		return 0
	}
	const state = createKillerState(puzzle, nodeLimit)
	if (state === null) {
		return 0
	}
	return searchCount(state, limit)
}

/**
 * True when the Killer constraints admit exactly one solution.
 */
export function hasUniqueKillerSolution(puzzle: KillerPuzzleInput): boolean {
	return countKillerSolutions(puzzle, 2) === 1
}
