/**
 * Killer Sudoku cage model and topology validators.
 */

import {
	BOARD_CELLS,
	orthogonalNeighbors,
	type CellIndex,
	type Digit,
	type SudokuBoard,
} from '../sudoku/types'

/**
 * A contiguous region of cells with a target sum.
 * Digits inside a cage must be unique (Killer rule).
 */
export interface KillerCage {
	/** Stable cage identifier (unique within a puzzle). */
	id: string
	/** Target sum of solution digits in this cage. */
	sum: number
	/** Flat cell indexes belonging to the cage. */
	cells: CellIndex[]
}

export interface CageTopologyError {
	code:
		| 'EMPTY_CAGE'
		| 'OUT_OF_BOUNDS'
		| 'DUPLICATE_CELL_IN_CAGE'
		| 'OVERLAP'
		| 'INCOMPLETE_COVERAGE'
		| 'NOT_CONNECTED'
		| 'INVALID_SUM'
		| 'REPEATED_DIGITS'
	message: string
	cageId?: string
}

/**
 * True when every pair of cells in the set is linked via
 * orthogonal steps that stay inside the set (4-connected).
 */
export function isOrthogonallyConnected(cells: readonly CellIndex[]): boolean {
	if (cells.length <= 1) {
		return true
	}
	const membership = new Set(cells)
	const start = cells[0]!
	const seen = new Set<CellIndex>([start])
	const queue: CellIndex[] = [start]

	while (queue.length > 0) {
		const current = queue.pop()!
		for (const neighbor of orthogonalNeighbors(current)) {
			if (membership.has(neighbor) && !seen.has(neighbor)) {
				seen.add(neighbor)
				queue.push(neighbor)
			}
		}
	}
	return seen.size === cells.length
}

/**
 * Validate cage topology independent of a solution board.
 * Checks coverage, overlaps, bounds, connectivity, and intra-cage duplicates.
 */
export function validateCageTopology(
	cages: readonly KillerCage[],
): CageTopologyError[] {
	const errors: CageTopologyError[] = []
	const owner = new Map<CellIndex, string>()

	for (const cage of cages) {
		if (cage.cells.length === 0) {
			errors.push({
				code: 'EMPTY_CAGE',
				message: `Cage ${cage.id} has no cells`,
				cageId: cage.id,
			})
			continue
		}

		const local = new Set<CellIndex>()
		for (const cell of cage.cells) {
			if (!Number.isInteger(cell) || cell < 0 || cell >= BOARD_CELLS) {
				errors.push({
					code: 'OUT_OF_BOUNDS',
					message: `Cage ${cage.id} contains out-of-bounds cell ${cell}`,
					cageId: cage.id,
				})
				continue
			}
			if (local.has(cell)) {
				errors.push({
					code: 'DUPLICATE_CELL_IN_CAGE',
					message: `Cage ${cage.id} repeats cell ${cell}`,
					cageId: cage.id,
				})
				continue
			}
			local.add(cell)

			const previous = owner.get(cell)
			if (previous !== undefined) {
				errors.push({
					code: 'OVERLAP',
					message: `Cell ${cell} belongs to cages ${previous} and ${cage.id}`,
					cageId: cage.id,
				})
			} else {
				owner.set(cell, cage.id)
			}
		}

		if (!isOrthogonallyConnected(cage.cells)) {
			errors.push({
				code: 'NOT_CONNECTED',
				message: `Cage ${cage.id} is not orthogonally connected`,
				cageId: cage.id,
			})
		}
	}

	if (owner.size !== BOARD_CELLS) {
		errors.push({
			code: 'INCOMPLETE_COVERAGE',
			message: `Cages cover ${owner.size} cells, expected ${BOARD_CELLS}`,
		})
	}

	return errors
}

/**
 * Validate cage sums and digit uniqueness against a known solution.
 */
export function validateCagesAgainstSolution(
	cages: readonly KillerCage[],
	solution: SudokuBoard,
): CageTopologyError[] {
	const errors: CageTopologyError[] = []

	for (const cage of cages) {
		const digits = new Set<Digit>()
		let sum = 0
		let hasRepeat = false

		for (const cell of cage.cells) {
			const value = solution[cell]
			if (value === undefined || value < 1 || value > 9) {
				errors.push({
					code: 'INVALID_SUM',
					message: `Cage ${cage.id} references non-digit solution at ${cell}`,
					cageId: cage.id,
				})
				continue
			}
			const digit = value as Digit
			sum += digit
			if (digits.has(digit)) {
				hasRepeat = true
			}
			digits.add(digit)
		}

		if (hasRepeat) {
			errors.push({
				code: 'REPEATED_DIGITS',
				message: `Cage ${cage.id} has repeated solution digits`,
				cageId: cage.id,
			})
		}

		if (sum !== cage.sum) {
			errors.push({
				code: 'INVALID_SUM',
				message: `Cage ${cage.id} sum ${cage.sum} != solution sum ${sum}`,
				cageId: cage.id,
			})
		}
	}

	return errors
}
