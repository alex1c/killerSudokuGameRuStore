import {
	ALL_DIGITS,
	BOARD_CELLS,
	BOARD_SIZE,
	BOX_SIZE,
	indexToPosition,
	type Digit,
} from '../sudoku/types'
import { getCageCombinations } from '../killer/combinations'
import type { KillerCage } from '../killer/cages'
import {
	digitMask,
	FULL_CANDIDATE_MASK,
	maskToDigits,
	type CandidateMask,
	type LogicalPuzzle,
	type LogicalState,
} from './types'

function peers(cell: number): number[] {
	const { row, col } = indexToPosition(cell)
	const result = new Set<number>()
	for (let i = 0; i < BOARD_SIZE; i += 1) {
		result.add(row * BOARD_SIZE + i)
		result.add(i * BOARD_SIZE + col)
	}
	const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE
	const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE
	for (let r = boxRow; r < boxRow + BOX_SIZE; r += 1) {
		for (let c = boxCol; c < boxCol + BOX_SIZE; c += 1) result.add(r * 9 + c)
	}
	result.delete(cell)
	return [...result]
}

function sudokuCandidates(values: number[], cell: number): CandidateMask {
	if (values[cell] !== 0) return digitMask(values[cell] as Digit)
	let mask = FULL_CANDIDATE_MASK
	for (const peer of peers(cell)) {
		const value = values[peer]
		if (value !== 0) mask &= ~digitMask(value as Digit)
	}
	return mask
}

function cageForCell(cages: readonly KillerCage[], cell: number): KillerCage | undefined {
	return cages.find((cage) => cage.cells.includes(cell))
}

function cagePossibleMasks(
	values: number[],
	cage: KillerCage,
	base: CandidateMask[],
): CandidateMask[] {
	const known = new Set<Digit>()
	let knownSum = 0
	const empty = [] as number[]
	for (const cell of cage.cells) {
		const value = values[cell] ?? 0
		if (value === 0) empty.push(cell)
		else {
			known.add(value as Digit)
			knownSum += value
		}
	}
	const masks = cage.cells.map(() => 0)
	if (empty.length === 0) return masks
	const combinations = getCageCombinations(empty.length, cage.sum - knownSum, known)
	for (const combination of combinations) {
		const assignments = (cells: number[], digits: Digit[], index: number, selected: Digit[] = []): void => {
			if (index === cells.length) {
				for (let i = 0; i < cells.length; i += 1) {
					const cageIndex = cage.cells.indexOf(cells[i]!)
					masks[cageIndex] = (masks[cageIndex] ?? 0) | digitMask(selected[i]!)
				}
				return
			}
			const cell = cells[index]!
			for (const digit of digits) {
				if ((base[cell]! & digitMask(digit)) === 0) continue
				const nextDigits = digits.filter((candidate) => candidate !== digit)
				assignments(cells, nextDigits, index + 1, [...selected, digit])
			}
		}
		assignments(empty, combination, 0)
	}
	return masks
}

export function initializeLogicalState(puzzle: LogicalPuzzle): LogicalState {
	const values = puzzle.board.slice()
	let candidates = Array.from({ length: BOARD_CELLS }, (_, cell) => sudokuCandidates(values, cell))
	for (const cage of puzzle.cages) {
		const possible = cagePossibleMasks(values, cage, candidates)
		for (let i = 0; i < cage.cells.length; i += 1) {
			const cell = cage.cells[i]!
			if (values[cell] === 0 && possible[i] !== 0) candidates[cell] = candidates[cell]! & possible[i]!
		}
	}
	return { values, candidates }
}

export function cloneLogicalState(state: LogicalState): LogicalState {
	return { values: state.values.slice(), candidates: state.candidates.slice() }
}

export function unitCells(kind: 'row' | 'column' | 'box', unit: number): number[] {
	if (kind === 'row') return Array.from({ length: 9 }, (_, col) => unit * 9 + col)
	if (kind === 'column') return Array.from({ length: 9 }, (_, row) => row * 9 + unit)
	const row = Math.floor(unit / 3) * 3
	const col = (unit % 3) * 3
	return Array.from({ length: 9 }, (_, i) => (row + Math.floor(i / 3)) * 9 + col + (i % 3))
}

export function recomputeCageCandidateMask(
	state: LogicalState,
	cage: KillerCage,
): CandidateMask[] {
	return cagePossibleMasks(state.values, cage, state.candidates)
}

/** Digits that every mathematically possible cage combination must contain. */
export function cageForcedDigits(state: LogicalState, cage: KillerCage): Digit[] {
	const known = new Set<Digit>()
	let knownSum = 0
	for (const cell of cage.cells) {
		const value = state.values[cell] ?? 0
		if (value !== 0) {
			known.add(value as Digit)
			knownSum += value
		}
	}
	const emptyCount = cage.cells.filter((cell) => state.values[cell] === 0).length
	const combinations = getCageCombinations(emptyCount, cage.sum - knownSum, known)
	if (!combinations.length) return []
	let forced = allDigitsMask(combinations[0]!)
	for (const combination of combinations.slice(1)) forced &= allDigitsMask(combination)
	return maskToDigits(forced)
}

export function digitsInMask(mask: CandidateMask): Digit[] {
	return maskToDigits(mask)
}

export function allDigitsMask(digits: readonly Digit[]): CandidateMask {
	return digits.reduce((mask, digit) => mask | digitMask(digit), 0)
}

export { ALL_DIGITS, cageForCell }
