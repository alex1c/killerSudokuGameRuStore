/**
 * Pure selectors for highlights, conflicts, notes, and completion checks.
 * Mid-game conflicts never consult the hidden solution.
 */

import {
	BOARD_CELLS,
	BOARD_SIZE,
	BOX_SIZE,
	boxIndex,
	indexToPosition,
	type CellIndex,
} from '../game/sudoku'
import type { KillerCage } from '../game/killer'
import { notesToDigits } from './notes'
import type { GameState } from './types'

/**
 * True when the cell was provided as a given clue.
 */
export function isGivenCell(state: GameState, cell: CellIndex): boolean {
	return (state.puzzle.board[cell] ?? 0) !== 0
}

/**
 * Display value for a cell (given or player entry).
 */
export function getCellValue(state: GameState, cell: CellIndex): number {
	return state.values[cell] ?? 0
}

/**
 * Note bitmask for a cell.
 */
export function getCellNotesMask(state: GameState, cell: CellIndex): number {
	return state.notes[cell] ?? 0
}

/**
 * Map each cell index to its cage.
 */
export function buildCellCageMap(
	cages: readonly KillerCage[],
): Map<CellIndex, KillerCage> {
	const map = new Map<CellIndex, KillerCage>()
	for (const cage of cages) {
		for (const cell of cage.cells) {
			map.set(cell, cage)
		}
	}
	return map
}

/**
 * All cells belonging to the same cage as `cell`.
 */
export function getCageCellsFor(
	state: GameState,
	cell: CellIndex,
): readonly CellIndex[] {
	for (const cage of state.puzzle.cages) {
		if (cage.cells.includes(cell)) {
			return cage.cells
		}
	}
	return []
}

/**
 * Top-left-like anchor for cage sum labels: smallest row, then smallest col.
 */
export function getCageSumAnchor(cage: KillerCage): CellIndex {
	let best = cage.cells[0]!
	let bestPos = indexToPosition(best)
	for (let i = 1; i < cage.cells.length; i += 1) {
		const nextCell = cage.cells[i]!
		const pos = indexToPosition(nextCell)
		if (
			pos.row < bestPos.row ||
			(pos.row === bestPos.row && pos.col < bestPos.col)
		) {
			best = nextCell
			bestPos = pos
		}
	}
	return best
}

export interface CageBorderFlags {
	top: boolean
	right: boolean
	bottom: boolean
	left: boolean
}

/**
 * Which sides of a cell need a cage boundary (no same-cage neighbor).
 */
export function getCageBorderFlags(
	cell: CellIndex,
	cellToCage: Map<CellIndex, KillerCage>,
): CageBorderFlags {
	const cage = cellToCage.get(cell)
	if (!cage) {
		return { top: true, right: true, bottom: true, left: true }
	}
	const { row, col } = indexToPosition(cell)
	const same = (r: number, c: number): boolean => {
		if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
			return false
		}
		const neighbor = r * BOARD_SIZE + c
		return cellToCage.get(neighbor)?.id === cage.id
	}
	return {
		top: !same(row - 1, col),
		right: !same(row, col + 1),
		bottom: !same(row + 1, col),
		left: !same(row, col - 1),
	}
}

/**
 * Cells in the same row, column, or 3×3 box as `cell` (includes self).
 */
export function getRelatedCells(cell: CellIndex): Set<CellIndex> {
	const { row, col } = indexToPosition(cell)
	const box = boxIndex(row, col)
	const related = new Set<CellIndex>()

	for (let c = 0; c < BOARD_SIZE; c += 1) {
		related.add(row * BOARD_SIZE + c)
	}
	for (let r = 0; r < BOARD_SIZE; r += 1) {
		related.add(r * BOARD_SIZE + col)
	}
	const boxRow = Math.floor(box / BOX_SIZE) * BOX_SIZE
	const boxCol = (box % BOX_SIZE) * BOX_SIZE
	for (let r = boxRow; r < boxRow + BOX_SIZE; r += 1) {
		for (let c = boxCol; c < boxCol + BOX_SIZE; c += 1) {
			related.add(r * BOARD_SIZE + c)
		}
	}
	return related
}

/**
 * All cells showing digit `value` (givens + player).
 */
export function getSameNumberCells(
	state: GameState,
	value: number,
): Set<CellIndex> {
	const result = new Set<CellIndex>()
	if (value < 1 || value > 9) {
		return result
	}
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		if (getCellValue(state, i) === value) {
			result.add(i)
		}
	}
	return result
}

/**
 * Count how many times each digit 1–9 appears as a main value.
 */
export function countDigitOccurrences(state: GameState): number[] {
	const counts = Array.from({ length: 10 }, () => 0)
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const value = state.values[i] ?? 0
		if (value >= 1 && value <= 9) {
			counts[value]! += 1
		}
	}
	return counts
}

/**
 * Explicit-rule conflict cells (no hidden-solution checking).
 */
export function getConflictCells(state: GameState): Set<CellIndex> {
	const conflicts = new Set<CellIndex>()
	const values = state.values

	const markDuplicates = (indexes: readonly CellIndex[]): void => {
		const seen = new Map<number, CellIndex[]>()
		for (const index of indexes) {
			const value = values[index] ?? 0
			if (value === 0) {
				continue
			}
			const list = seen.get(value) ?? []
			list.push(index)
			seen.set(value, list)
		}
		for (const list of seen.values()) {
			if (list.length > 1) {
				for (const index of list) {
					conflicts.add(index)
				}
			}
		}
	}

	for (let unit = 0; unit < BOARD_SIZE; unit += 1) {
		const rowCells: CellIndex[] = []
		const colCells: CellIndex[] = []
		for (let k = 0; k < BOARD_SIZE; k += 1) {
			rowCells.push(unit * BOARD_SIZE + k)
			colCells.push(k * BOARD_SIZE + unit)
		}
		markDuplicates(rowCells)
		markDuplicates(colCells)

		const boxRow = Math.floor(unit / BOX_SIZE) * BOX_SIZE
		const boxCol = (unit % BOX_SIZE) * BOX_SIZE
		const boxCells: CellIndex[] = []
		for (let r = 0; r < BOX_SIZE; r += 1) {
			for (let c = 0; c < BOX_SIZE; c += 1) {
				boxCells.push((boxRow + r) * BOARD_SIZE + (boxCol + c))
			}
		}
		markDuplicates(boxCells)
	}

	for (const cage of state.puzzle.cages) {
		markDuplicates(cage.cells)

		let filled = 0
		let sum = 0
		for (const cell of cage.cells) {
			const value = values[cell] ?? 0
			if (value !== 0) {
				filled += 1
				sum += value
			}
		}

		if (sum > cage.sum) {
			for (const cell of cage.cells) {
				if ((values[cell] ?? 0) !== 0) {
					conflicts.add(cell)
				}
			}
		} else if (filled === cage.cells.length && sum !== cage.sum) {
			for (const cell of cage.cells) {
				conflicts.add(cell)
			}
		}
	}

	return conflicts
}

/**
 * True when every cell has a non-zero value.
 */
export function isBoardComplete(state: GameState): boolean {
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		if ((state.values[i] ?? 0) === 0) {
			return false
		}
	}
	return true
}

/**
 * True when the board is full and has no explicit-rule conflicts.
 * Does not consult the hidden solution.
 */
export function isBoardValid(state: GameState): boolean {
	if (!isBoardComplete(state)) {
		return false
	}
	return getConflictCells(state).size === 0
}

/**
 * Cells whose main digit disagrees with the hidden solution.
 * Used for immediate / on-complete error UX — never reveals the correct digit.
 */
export function getSolutionMismatchCells(state: GameState): Set<number> {
	const set = new Set<number>()
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		const value = state.values[i] ?? 0
		if (value !== 0 && value !== (state.puzzle.solution[i] ?? 0)) {
			set.add(i)
		}
	}
	return set
}

/**
 * Completion check: full + explicit-valid + matches hidden solution.
 * Solution is consulted only at this completion gate.
 */
export function isPuzzleSolved(state: GameState): boolean {
	if (!isBoardValid(state)) {
		return false
	}
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		if (state.values[i] !== state.puzzle.solution[i]) {
			return false
		}
	}
	return true
}

/**
 * True when the session has any player progress worth confirming on New Game.
 */
export function hasPlayerProgress(state: GameState): boolean {
	if (state.history.length > 0) {
		return true
	}
	for (let i = 0; i < BOARD_CELLS; i += 1) {
		if (isGivenCell(state, i)) {
			continue
		}
		if ((state.values[i] ?? 0) !== 0) {
			return true
		}
		if ((state.notes[i] ?? 0) !== 0) {
			return true
		}
	}
	return false
}

/**
 * Accessibility label for a cell.
 */
export function getCellAccessibilityLabel(
	state: GameState,
	cell: CellIndex,
): string {
	const { row, col } = indexToPosition(cell)
	const value = getCellValue(state, cell)
	const base = `Строка ${row + 1}, столбец ${col + 1}`
	if (value !== 0) {
		if (isGivenCell(state, cell)) {
			return `${base}, задано ${value}`
		}
		return `${base}, ${value}`
	}
	const notes = notesToDigits(getCellNotesMask(state, cell))
	if (notes.length > 0) {
		return `${base}, заметки ${notes.join(' ')}`
	}
	return base
}
