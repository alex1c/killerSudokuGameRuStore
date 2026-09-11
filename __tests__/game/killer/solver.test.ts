import {
	countKillerSolutions,
	generateKillerPuzzle,
	solveKillerSudoku,
	validateKillerPuzzle,
	type KillerCage,
} from '../../../src/game/killer'
import { createEmptyBoard, type SudokuBoard } from '../../../src/game/sudoku'
import { CLASSIC_SOLUTION } from '../../fixtures/sudoku'

/**
 * Build trivial size-1 cages for negative-path tests.
 * Not used by the default generator.
 */
function singletonCages(solution: SudokuBoard): KillerCage[] {
	return solution.map((digit, index) => ({
		id: `s-${index}`,
		sum: digit,
		cells: [index],
	}))
}

describe('killer solver', () => {
	it('solves a generated unique fixture puzzle', () => {
		const puzzle = generateKillerPuzzle({ seed: 4242 })
		const solved = solveKillerSudoku({
			board: puzzle.board,
			cages: puzzle.cages,
		})
		expect(solved).toEqual(puzzle.solution)
		expect(
			countKillerSolutions({ board: puzzle.board, cages: puzzle.cages }, 2),
		).toBe(1)
	})

	it('rejects an invalid cage layout', () => {
		const cages: KillerCage[] = [
			{ id: 'a', sum: 10, cells: [0, 1] },
			{ id: 'b', sum: 10, cells: [1, 2] },
		]
		expect(
			solveKillerSudoku({ board: createEmptyBoard(), cages }),
		).toBeNull()
		expect(
			countKillerSolutions({ board: createEmptyBoard(), cages }, 2),
		).toBe(0)
	})

	it('reports unsatisfiable when cage sums contradict the board', () => {
		const cages = singletonCages(CLASSIC_SOLUTION)
		cages[0] = { ...cages[0]!, sum: 9 }
		expect(
			solveKillerSudoku({
				board: createEmptyBoard(),
				cages,
			}),
		).toBeNull()
	})

	it('can observe multiple solutions for under-constrained cages', () => {
		// Row-sum cages alone are a weak Killer encoding.
		const solution = CLASSIC_SOLUTION
		const cages: KillerCage[] = []
		for (let row = 0; row < 9; row += 1) {
			const cells = Array.from({ length: 9 }, (_, col) => row * 9 + col)
			const sum = cells.reduce((acc, cell) => acc + solution[cell]!, 0)
			cages.push({ id: `row-${row}`, sum, cells })
		}
		const count = countKillerSolutions(
			{ board: createEmptyBoard(), cages },
			2,
		)
		expect(count).toBe(2)
	})
})

describe('validateKillerPuzzle', () => {
	it('passes for a generated puzzle', () => {
		const puzzle = generateKillerPuzzle({ seed: 7 })
		const result = validateKillerPuzzle({
			solution: puzzle.solution,
			cages: puzzle.cages,
		})
		expect(result.valid).toBe(true)
		expect(result.errors).toEqual([])
	})

	it('returns structured errors for bad input', () => {
		const result = validateKillerPuzzle({
			solution: createEmptyBoard(),
			cages: [],
		})
		expect(result.valid).toBe(false)
		expect(result.errors.length).toBeGreaterThan(0)
	})
})
