/**
 * Generate orthogonally connected Killer cages from a solved board.
 *
 * Topology-only generator (fast). Uniqueness is enforced by the
 * full puzzle pipeline via cage constraints (+ optional minimized givens).
 */

import {
	createSeededRandom,
	pickOne,
	shuffledCopy,
	type SeededRandom,
} from '../../utils/seededRandom'
import {
	DEFAULT_CAGE_PRESET,
	type CageGenerationPreset,
} from '../difficulty/types'
import {
	BOARD_CELLS,
	orthogonalNeighbors,
	type CellIndex,
	type Digit,
	type SudokuBoard,
} from '../sudoku/types'
import { type KillerCage, isOrthogonallyConnected } from './cages'

export interface GenerateKillerCagesOptions {
	preset?: CageGenerationPreset
	minSize?: number
	maxSize?: number
}

/**
 * Weighted size picker for the configured size range.
 */
function pickTargetSize(
	rng: SeededRandom,
	preset: CageGenerationPreset,
	minSize: number,
	maxSize: number,
): number {
	const sizes: number[] = []
	const weights: number[] = []
	for (let size = minSize; size <= maxSize; size += 1) {
		const weightIndex = size - preset.minSize
		sizes.push(size)
		weights.push(Math.max(0, preset.sizeWeights[weightIndex] ?? 1))
	}
	const total = weights.reduce((sum, w) => sum + w, 0)
	if (total <= 0) {
		return minSize
	}
	let roll = rng() * total
	for (let i = 0; i < sizes.length; i += 1) {
		roll -= weights[i]!
		if (roll <= 0) {
			return sizes[i]!
		}
	}
	return sizes[sizes.length - 1]!
}

function cageDigits(
	solution: SudokuBoard,
	cells: readonly CellIndex[],
): Set<Digit> {
	return new Set(cells.map((cell) => solution[cell] as Digit))
}

function growCage(
	solution: SudokuBoard,
	start: CellIndex,
	targetSize: number,
	claimed: boolean[],
	rng: SeededRandom,
): CellIndex[] {
	const cells: CellIndex[] = [start]
	const used = new Set<Digit>([solution[start] as Digit])
	claimed[start] = true

	while (cells.length < targetSize) {
		const frontier: CellIndex[] = []
		const seen = new Set<CellIndex>()
		for (const cell of cells) {
			for (const neighbor of orthogonalNeighbors(cell)) {
				if (claimed[neighbor] || seen.has(neighbor)) {
					continue
				}
				const digit = solution[neighbor] as Digit
				if (used.has(digit)) {
					continue
				}
				seen.add(neighbor)
				frontier.push(neighbor)
			}
		}
		if (frontier.length === 0) {
			break
		}
		const next = pickOne(shuffledCopy(frontier, rng), rng)
		cells.push(next)
		used.add(solution[next] as Digit)
		claimed[next] = true
	}

	return cells
}

function tryAbsorbCell(
	solution: SudokuBoard,
	cell: CellIndex,
	cages: KillerCage[],
	cellToCage: Map<CellIndex, number>,
	maxSize: number,
): boolean {
	const digit = solution[cell] as Digit
	const neighborOrder = [...orthogonalNeighbors(cell)].sort((a, b) => a - b)

	for (const neighbor of neighborOrder) {
		const cageIndex = cellToCage.get(neighbor)
		if (cageIndex === undefined) {
			continue
		}
		const cage = cages[cageIndex]!
		if (cage.cells.length >= maxSize) {
			continue
		}
		const digits = cageDigits(solution, cage.cells)
		if (digits.has(digit)) {
			continue
		}
		cage.cells.push(cell)
		cage.sum += digit
		cellToCage.set(cell, cageIndex)
		return true
	}
	return false
}

/**
 * Partition a solved board into Killer cages (topology + sums).
 */
export function generateKillerCages(
	solution: SudokuBoard,
	seed: number,
	options: GenerateKillerCagesOptions = {},
): KillerCage[] {
	const preset = options.preset ?? DEFAULT_CAGE_PRESET
	const minSize = options.minSize ?? preset.minSize
	const maxSize = options.maxSize ?? preset.maxSize
	const rng = createSeededRandom(seed >>> 0)

	const claimed = Array.from({ length: BOARD_CELLS }, () => false)
	const cages: KillerCage[] = []

	const freeCells = (): CellIndex[] => {
		const list: CellIndex[] = []
		for (let i = 0; i < BOARD_CELLS; i += 1) {
			if (!claimed[i]) {
				list.push(i)
			}
		}
		return list
	}

	let safety = 0
	while (true) {
		const free = freeCells()
		if (free.length === 0) {
			break
		}
		safety += 1
		if (safety > BOARD_CELLS * 3) {
			throw new Error('generateKillerCages: growth safety limit')
		}

		const ordered = shuffledCopy(free, rng)
		const start = ordered[0]!
		const remaining = free.length

		let target = pickTargetSize(rng, preset, minSize, maxSize)
		target = Math.min(target, maxSize, remaining)
		if (
			minSize > 1 &&
			remaining > target &&
			remaining - target < minSize
		) {
			target = Math.max(minSize, remaining - minSize)
			target = Math.min(target, maxSize, remaining)
		}

		const cells = growCage(solution, start, target, claimed, rng)
		const sum = cells.reduce((acc, cell) => acc + solution[cell]!, 0)
		cages.push({
			id: `cage-${cages.length}`,
			sum,
			cells,
		})
	}

	const cellToCage = new Map<CellIndex, number>()
	cages.forEach((cage, index) => {
		for (const cell of cage.cells) {
			cellToCage.set(cell, index)
		}
	})

	let changed = true
	let absorbGuard = 0
	while (changed) {
		changed = false
		absorbGuard += 1
		if (absorbGuard > BOARD_CELLS) {
			throw new Error('generateKillerCages: absorb safety limit')
		}

		for (let i = 0; i < cages.length; i += 1) {
			const cage = cages[i]
			if (!cage || cage.cells.length === 0) {
				continue
			}
			if (cage.cells.length >= minSize) {
				continue
			}

			const cells = [...cage.cells]
			for (const cell of cells) {
				cellToCage.delete(cell)
			}
			cage.cells = []
			cage.sum = 0

			for (const cell of cells) {
				const ok = tryAbsorbCell(
					solution,
					cell,
					cages,
					cellToCage,
					maxSize,
				)
				if (!ok) {
					if (preset.allowSingletons || minSize <= 1) {
						cage.cells.push(cell)
						cage.sum += solution[cell]!
						cellToCage.set(cell, i)
					} else {
						throw new Error(
							'generateKillerCages: cannot absorb undersized cage',
						)
					}
				} else {
					changed = true
				}
			}
		}
	}

	const compact = cages.filter((cage) => cage.cells.length > 0)

	for (const cage of compact) {
		if (!isOrthogonallyConnected(cage.cells)) {
			throw new Error(
				`generateKillerCages: cage ${cage.id} not connected`,
			)
		}
		const digits = cageDigits(solution, cage.cells)
		if (digits.size !== cage.cells.length) {
			throw new Error(
				`generateKillerCages: cage ${cage.id} has repeated digits`,
			)
		}
		if (!preset.allowSingletons && cage.cells.length < minSize) {
			throw new Error(
				`generateKillerCages: cage ${cage.id} below minSize`,
			)
		}
		const expectedSum = cage.cells.reduce(
			(acc, cell) => acc + solution[cell]!,
			0,
		)
		if (expectedSum !== cage.sum) {
			throw new Error(
				`generateKillerCages: cage ${cage.id} sum mismatch`,
			)
		}
	}

	const covered = new Set<CellIndex>()
	for (const cage of compact) {
		for (const cell of cage.cells) {
			if (covered.has(cell)) {
				throw new Error('generateKillerCages: overlap detected')
			}
			covered.add(cell)
		}
	}
	if (covered.size !== BOARD_CELLS) {
		throw new Error('generateKillerCages: incomplete coverage')
	}

	return compact.map((cage, index) => ({
		id: `cage-${index}`,
		sum: cage.sum,
		cells: [...cage.cells].sort((a, b) => a - b),
	}))
}
