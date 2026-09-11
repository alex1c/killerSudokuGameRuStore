import {
	countKillerSolutions,
	generateKillerPuzzle,
	validateKillerPuzzle,
} from '../../../src/game/killer'

describe('generateKillerPuzzle', () => {
	it('returns a validated unique puzzle', () => {
		const puzzle = generateKillerPuzzle({ seed: 100 })
		const validation = validateKillerPuzzle({
			solution: puzzle.solution,
			cages: puzzle.cages,
		})
		expect(validation.valid).toBe(true)
		expect(
			countKillerSolutions(
				{ board: puzzle.board, cages: puzzle.cages },
				2,
			),
		).toBe(1)
	})

	it('is deterministic for the same seed', () => {
		const a = generateKillerPuzzle({ seed: 555 })
		const b = generateKillerPuzzle({ seed: 555 })
		expect(a.solution).toEqual(b.solution)
		expect(a.cages).toEqual(b.cages)
	})

	it('generates a small batch of unique puzzles', () => {
		const seeds = Array.from({ length: 12 }, (_, i) => 1000 + i)
		for (const seed of seeds) {
			const puzzle = generateKillerPuzzle({ seed })
			expect(
				validateKillerPuzzle({
					solution: puzzle.solution,
					cages: puzzle.cages,
				}).valid,
			).toBe(true)
			expect(
				countKillerSolutions(
					{ board: puzzle.board, cages: puzzle.cages },
					2,
				),
			).toBe(1)
		}
	})
})
