import {
	generateKillerCages,
	isOrthogonallyConnected,
	validateCageTopology,
	validateCagesAgainstSolution,
} from '../../../src/game/killer'
import { generateSolvedBoard } from '../../../src/game/sudoku'

describe('killer cages', () => {
	it('covers 81 cells without overlap and stays connected', () => {
		const solution = generateSolvedBoard(2026)
		const cages = generateKillerCages(solution, 77)

		const topology = validateCageTopology(cages)
		expect(topology).toEqual([])

		const against = validateCagesAgainstSolution(cages, solution)
		expect(against).toEqual([])

		const covered = new Set<number>()
		for (const cage of cages) {
			expect(isOrthogonallyConnected(cage.cells)).toBe(true)
			expect(cage.cells.length).toBeGreaterThanOrEqual(2)

			const digits = new Set<number>()
			let sum = 0
			for (const cell of cage.cells) {
				expect(covered.has(cell)).toBe(false)
				covered.add(cell)
				const digit = solution[cell]!
				expect(digits.has(digit)).toBe(false)
				digits.add(digit)
				sum += digit
			}
			expect(sum).toBe(cage.sum)
		}
		expect(covered.size).toBe(81)
	})

	it('is deterministic for the same solution + seed', () => {
		const solution = generateSolvedBoard(9)
		const a = generateKillerCages(solution, 1001)
		const b = generateKillerCages(solution, 1001)
		expect(a).toEqual(b)
	})
})
