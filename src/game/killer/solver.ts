/**
 * Killer Sudoku solver (search + MRV + cage pruning).
 * Enforces row / column / box uniqueness AND cage sum / digit uniqueness.
 *
 * Phase 6P: empty-cell MRV list, digit bit lookup, and incremental dig
 * uniqueness (reuse one KillerState across removals — critical on Hermes).
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

/** Power-of-two bit → digit 1..9 (bits outside 1<<1..1<<9 unused). */
const DIGIT_FROM_BIT: number[] = (() => {
	const table = new Array<number>(1 << 10).fill(0)
	for (let digit = 1; digit <= 9; digit += 1) {
		table[1 << digit] = digit
	}
	return table
})()

export interface KillerPuzzleInput {
	/** Starting clues (0 = empty). Usually all zeros for Phase 1. */
	board?: SudokuBoard
	cages: readonly KillerCage[]
}

interface CageRuntime {
	cells: number[]
	sum: number
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
	/** Compact list of currently empty cell indices (MRV domain). */
	emptyCells: number[]
	/** Parallel to board: index into emptyCells, or -1 if filled. */
	emptyPos: number[]
	/** Nodes explored; used as a safety brake. */
	nodes: number
	/** Soft cap on explored nodes (0 = unlimited). */
	nodeLimit: number
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

function markEmpty(state: KillerState, index: number): void {
	state.emptyPos[index] = state.emptyCells.length
	state.emptyCells.push(index)
}

function unmarkEmpty(state: KillerState, index: number): void {
	const pos = state.emptyPos[index]!
	const last = state.emptyCells.length - 1
	const moved = state.emptyCells[last]!
	state.emptyCells[pos] = moved
	state.emptyPos[moved] = pos
	state.emptyCells.pop()
	state.emptyPos[index] = -1
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

	const cellCage = new Array<number>(BOARD_CELLS).fill(-1)
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
		// Keep a stable copy — cages are never mutated during search.
		const cells = cage.cells.slice()

		for (const cell of cells) {
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

		cages.push({ cells, sum: cage.sum })
		cageDigitMask.push(placedMask)
		cageRemainingSum.push(remainingSum)
		cageEmptyCount.push(empty)
	}

	for (let i = 0; i < BOARD_CELLS; i += 1) {
		if (cellCage[i] === -1) {
			return null
		}
	}

	const rowMask = new Array<number>(BOARD_SIZE).fill(0)
	const colMask = new Array<number>(BOARD_SIZE).fill(0)
	const boxMask = new Array<number>(BOARD_SIZE).fill(0)
	const emptyCells: number[] = []
	const emptyPos = new Array<number>(BOARD_CELLS).fill(-1)

	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const value = board[i]!
		if (value === 0) {
			emptyPos[i] = emptyCells.length
			emptyCells.push(i)
			continue
		}
		const bit = 1 << value
		const row = (i / BOARD_SIZE) | 0
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
		emptyCells,
		emptyPos,
		nodes: 0,
		nodeLimit,
	}
}

/**
 * Sudoku ∪ cage candidate mask for an empty cell.
 */
function cellCandidates(state: KillerState, index: number): number {
	const row = (index / BOARD_SIZE) | 0
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
		const digit = DIGIT_FROM_BIT[bit]!
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
				cageUsed | bit,
			)
		) {
			filtered |= bit
		}
	}
	return filtered
}

/**
 * MRV over the compact empty-cell list. Returns cell index or:
 * -1 = solved (no empties), -2 = contradiction (zero candidates).
 * Writes the chosen candidate mask into outMask[0] to avoid a second scan.
 */
function selectMrvCell(state: KillerState, outMask: number[]): number {
	const empties = state.emptyCells
	if (empties.length === 0) {
		outMask[0] = 0
		return -1
	}

	let bestIndex = -1
	let bestCount = 10
	let bestMask = 0

	for (let e = 0; e < empties.length; e += 1) {
		const i = empties[e]!
		const mask = cellCandidates(state, i)
		const count = popcount(mask)
		if (count === 0) {
			outMask[0] = 0
			return -2
		}
		if (count < bestCount) {
			bestCount = count
			bestIndex = i
			bestMask = mask
			if (count === 1) {
				outMask[0] = bestMask
				return bestIndex
			}
		}
	}
	outMask[0] = bestMask
	return bestIndex
}

function place(state: KillerState, index: number, digit: number): void {
	const bit = 1 << digit
	const row = (index / BOARD_SIZE) | 0
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
	unmarkEmpty(state, index)
}

function remove(state: KillerState, index: number, digit: number): void {
	const bit = 1 << digit
	const row = (index / BOARD_SIZE) | 0
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
	markEmpty(state, index)
}

/** Scratch slot reused across recursive calls (single-threaded generation). */
const MRV_MASK_SLOT = [0]

/**
 * Search that keeps placements when a solution is found (for solve).
 */
function searchKeep(state: KillerState): boolean {
	state.nodes += 1
	if (state.nodeLimit > 0 && state.nodes > state.nodeLimit) {
		return false
	}

	const index = selectMrvCell(state, MRV_MASK_SLOT)
	if (index === -1) {
		return true
	}
	if (index === -2) {
		return false
	}

	let mask = MRV_MASK_SLOT[0]!
	while (mask !== 0) {
		const bit = mask & -mask
		mask ^= bit
		const digit = DIGIT_FROM_BIT[bit]!

		place(state, index, digit)
		if (searchKeep(state)) {
			return true
		}
		remove(state, index, digit)
	}
	return false
}

/**
 * Like searchKeep, but always undoes placements (existence probe only).
 * Used by alternate-solution dig checks so the dig state stays intact.
 */
function searchExists(state: KillerState): boolean {
	state.nodes += 1
	if (state.nodeLimit > 0 && state.nodes > state.nodeLimit) {
		// Budget hit while hunting an alternate — treat as "found" so dig
		// restores the given (conservative uniqueness).
		return true
	}

	const index = selectMrvCell(state, MRV_MASK_SLOT)
	if (index === -1) {
		return true
	}
	if (index === -2) {
		return false
	}

	let mask = MRV_MASK_SLOT[0]!
	while (mask !== 0) {
		const bit = mask & -mask
		mask ^= bit
		const digit = DIGIT_FROM_BIT[bit]!

		place(state, index, digit)
		const found = searchExists(state)
		remove(state, index, digit)
		if (found) {
			return true
		}
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

	const index = selectMrvCell(state, MRV_MASK_SLOT)
	if (index === -1) {
		return 1
	}
	if (index === -2) {
		return 0
	}

	let found = 0
	let mask = MRV_MASK_SLOT[0]!
	while (mask !== 0) {
		const bit = mask & -mask
		mask ^= bit
		const digit = DIGIT_FROM_BIT[bit]!

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
 * Search for a second solution that differs from `knownSolution`.
 * Returns 1 if an alternate exists (not unique), 0 if only the known solution
 * fits within the node budget. Budget exhaustion returns 1 (conservative:
 * treat as non-unique so dig restores the given — same as count===limit).
 */
function searchAlternate(
	state: KillerState,
	knownSolution: SudokuBoard,
): number {
	state.nodes += 1
	if (state.nodeLimit > 0 && state.nodes > state.nodeLimit) {
		return 1
	}

	const index = selectMrvCell(state, MRV_MASK_SLOT)
	if (index === -1) {
		// Completed a filling. If it matches the known solution this branch
		// is not an alternate; otherwise uniqueness failed.
		for (let i = 0; i < BOARD_CELLS; i += 1) {
			if (state.board[i] !== knownSolution[i]) {
				return 1
			}
		}
		return 0
	}
	if (index === -2) {
		return 0
	}

	const knownDigit = knownSolution[index]!
	let mask = MRV_MASK_SLOT[0]!
	const knownBit = 1 << knownDigit

	// Prefer digits that disagree with the known solution — finds conflicts fast.
	let rest = mask
	while (rest !== 0) {
		const bit = rest & -rest
		rest ^= bit
		if (bit === knownBit) {
			continue
		}
		const digit = DIGIT_FROM_BIT[bit]!
		place(state, index, digit)
		const found = searchExists(state)
		remove(state, index, digit)
		if (found) {
			return 1
		}
	}

	if ((mask & knownBit) !== 0) {
		place(state, index, knownDigit)
		const found = searchAlternate(state, knownSolution)
		remove(state, index, knownDigit)
		return found
	}
	return 0
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

export interface DigUniquenessResult {
	board: SudokuBoard
	removedCells: number[]
	/** How many dig candidates were uniqueness-probed. */
	candidateDigAttempts: number
	/** How many uniqueness searches ran (same as candidateDigAttempts). */
	uniquenessChecks: number
}

/**
 * Dig givens from a full solution while uniqueness holds, reusing one solver
 * state across removals. Uses alternate-solution search against the known
 * grid so dig stays cheap on Hermes compared to full rebuild+count each cell.
 *
 * Optional `shouldStop` lets the generator halt once the logical grade is
 * already hard enough — avoids ultra-sparse uniqueness probes that Phase 6
 * calibration would only fill back in.
 */
export function digGivensIncremental(
	solution: SudokuBoard,
	cages: readonly KillerCage[],
	order: readonly number[],
	maxEmptyCells: number,
	nodeLimit: number,
	shouldStop?: (board: SudokuBoard, emptyCount: number) => boolean,
): DigUniquenessResult {
	const board = cloneBoard(solution)
	const state = createKillerState({ board, cages }, nodeLimit)
	if (state === null) {
		return {
			board,
			removedCells: [],
			candidateDigAttempts: 0,
			uniquenessChecks: 0,
		}
	}

	const removedCells: number[] = []
	let emptyCount = 0
	let candidateDigAttempts = 0
	let uniquenessChecks = 0

	for (const index of order) {
		if (emptyCount >= maxEmptyCells) {
			break
		}
		if (
			shouldStop !== undefined &&
			emptyCount > 0 &&
			shouldStop(state.board, emptyCount)
		) {
			break
		}
		if (board[index] === 0) {
			continue
		}
		const backup = board[index]!
		candidateDigAttempts += 1

		// Remove the given from board + runtime masks.
		remove(state, index, backup)
		state.nodes = 0
		uniquenessChecks += 1

		// Alternate search: 0 = only known solution, 1 = second solution / budget.
		const alternate = searchAlternate(state, solution)
		if (alternate !== 0) {
			place(state, index, backup)
		} else {
			emptyCount += 1
			removedCells.push(index)
			// board already 0 via remove(); keep it empty.
		}
	}

	return {
		board: state.board,
		removedCells,
		candidateDigAttempts,
		uniquenessChecks,
	}
}
