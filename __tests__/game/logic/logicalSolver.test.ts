import { CLASSIC_PUZZLE } from '../../fixtures/sudoku'
import { getCageCombinations } from '../../../src/game/killer/combinations'
import {
	applyLogicalStep,
	findNextLogicalStep,
	gradeDifficulty,
	initializeLogicalState,
	solveLogically,
	FULL_CANDIDATE_MASK,
	type LogicalPuzzle,
	type LogicalState,
} from '../../../src/game/logic'
import { maskToDigits } from '../../../src/game/logic'

const emptyPuzzle: LogicalPuzzle = { board: Array(81).fill(0), cages: [] }
const fullState = (): LogicalState => ({ values: Array(81).fill(0), candidates: Array(81).fill(FULL_CANDIDATE_MASK) })

describe('logical solver', () => {
	it('finds and applies a naked single without mutating the input', () => {
		const state = fullState()
		state.candidates[0] = 1 << 7 | 1 << 8
		state.candidates[1] = 1 << 7
		const before = state.values.slice()
		const found = findNextLogicalStep(emptyPuzzle, state)
		expect(found?.technique).toBe('naked_single')
		expect(found?.placements).toEqual([{ cell: 1, digit: 7 }])
		const next = applyLogicalStep(state, found!)
		expect(next.values[1]).toBe(7)
		expect(state.values).toEqual(before)
	})

	it.each([
		['row', 0, [0, 1]],
		['column', 0, [0, 9]],
		['box', 0, [0, 1]],
	] as const)('finds a hidden single in a %s', (unit, _index, cells) => {
		const state = fullState()
		const unitCells = unit === 'row' ? Array.from({ length: 9 }, (_, cell) => cell) : unit === 'column' ? Array.from({ length: 9 }, (_, cell) => cell * 9) : [0, 1, 2, 9, 10, 11, 18, 19, 20]
		for (const cell of unitCells) state.candidates[cell] = state.candidates[cell]! & ~(1 << 7)
		state.candidates[cells[0]] = (1 << 7) | (1 << 8)
		state.candidates[cells[1]] = (1 << 8) | (1 << 9)
		const found = findNextLogicalStep(emptyPuzzle, state)
		expect(found?.technique).toBe('hidden_single')
		expect(found?.explanationData.unit).toBe(unit)
		expect(found?.placements[0]?.digit).toBe(7)
	})

	it('finds a cage single from the target sum', () => {
		const puzzle: LogicalPuzzle = { board: [0, 5, ...Array(79).fill(0)], cages: [{ id: 'c1', sum: 12, cells: [0, 1] }] }
		const state = fullState()
		state.values[1] = 5
		state.candidates[0] = FULL_CANDIDATE_MASK
		const found = findNextLogicalStep(puzzle, state)
		expect(found?.technique).toBe('cage_single')
		expect(found?.placements).toEqual([{ cell: 0, digit: 7 }])
	})

	it('uses cage combinations and reports candidate eliminations', () => {
		const puzzle: LogicalPuzzle = { board: Array(81).fill(0), cages: [{ id: 'c1', sum: 3, cells: [0, 1] }] }
		const found = findNextLogicalStep(puzzle, fullState())
		expect(getCageCombinations(2, 3)).toEqual([[1, 2]])
		expect(found?.technique).toBe('cage_combination')
		expect(found?.eliminations.length).toBeGreaterThan(0)
	})

	it.each([[2, 3], [2, 10], [3, 17]] as const)('matches independent cage permutation oracle for size=%i sum=%i', (size, sum) => {
		const cells = Array.from({ length: size }, (_, index) => index)
		const puzzle: LogicalPuzzle = { board: Array(81).fill(0), cages: [{ id: 'oracle', sum, cells }] }
		const state = initializeLogicalState(puzzle)
		const expected = new Map<number, Set<number>>(cells.map((cell) => [cell, new Set<number>()]))
		const combinations = getCageCombinations(size, sum)
		for (const combination of combinations) {
			const visit = (index: number, remaining: number[], selected: number[]): void => {
				if (index === cells.length) {
					for (let i = 0; i < cells.length; i += 1) expected.get(cells[i]!)!.add(selected[i]!)
					return
				}
				for (const digit of remaining) visit(index + 1, remaining.filter((candidate) => candidate !== digit), [...selected, digit])
			}
			visit(0, combination, [])
		}
		for (const cell of cells) expect(maskToDigits(state.candidates[cell]!)).toEqual([...expected.get(cell)!].sort((a, b) => a - b))
	})

	it('finds a mathematically valid locked candidate', () => {
		const state = fullState()
		for (let cell = 2; cell < 9; cell += 1) state.candidates[cell] = state.candidates[cell]! & ~(1 << 1)
		state.candidates[0] = (1 << 1) | (1 << 2)
		state.candidates[1] = (1 << 1) | (1 << 2) | (1 << 3)
		state.candidates[9] = (1 << 1) | (1 << 4)
		const found = findNextLogicalStep(emptyPuzzle, state)
		expect(found?.technique).toBe('locked_candidate')
		expect(found?.eliminations).toContainEqual({ cell: 9, digit: 1 })
	})

	it('uses Rule of 45 to eliminate unsupported pair digits', () => {
		const state = fullState()
		for (let cell = 2; cell < 9; cell += 1) state.values[cell] = cell - 1
		for (let cell = 9; cell < 21; cell += 1) state.candidates[cell] = FULL_CANDIDATE_MASK & ~(1 << 1) & ~(1 << 8) & ~(1 << 9)
		state.candidates[0] = (1 << 1) | (1 << 8) | (1 << 9)
		state.candidates[1] = (1 << 1) | (1 << 8) | (1 << 9)
		const found = findNextLogicalStep(emptyPuzzle, state)
		expect(found?.technique).toBe('rule_of_45')
		expect(found?.eliminations).toContainEqual({ cell: 0, digit: 1 })
	})

	it('uses cage intersection only for digits forced by every cage combination', () => {
		const puzzle: LogicalPuzzle = { board: Array(81).fill(0), cages: [{ id: 'c1', sum: 3, cells: [0, 1] }] }
		const state = fullState()
		state.candidates[0] = (1 << 1) | (1 << 2)
		state.candidates[1] = (1 << 1) | (1 << 2)
		const found = findNextLogicalStep(puzzle, state)
		expect(found?.technique).toBe('cage_intersection')
		expect(found?.eliminations).toContainEqual({ cell: 2, digit: 1 })
	})

	it('keeps ordinary cage elimination distinct from cage intersection', () => {
		const puzzle: LogicalPuzzle = { board: Array(81).fill(0), cages: [{ id: 'c1', sum: 10, cells: [0, 1] }] }
		expect(findNextLogicalStep(puzzle, fullState())?.technique).toBe('cage_candidate_elimination')
	})

	it('stalls honestly instead of invoking search', () => {
		const result = solveLogically(emptyPuzzle)
		expect(result.solved).toBe(false)
		expect(result.stalled).toBe(true)
		expect(result.steps).toEqual([])
	})

	it('is deterministic, non-mutating, and grades a logically solved classic puzzle', () => {
		const puzzle: LogicalPuzzle = { board: CLASSIC_PUZZLE, cages: [] }
		const before = puzzle.board.slice()
		const first = gradeDifficulty(puzzle)
		const second = gradeDifficulty(puzzle)
		expect(first).toEqual(second)
		expect(puzzle.board).toEqual(before)
		expect(first.solvedLogically).toBe(true)
		expect(initializeLogicalState(puzzle).values).toEqual(before)
	})

	it('rejects invalid and duplicate step operations', () => {
		const state = fullState()
		expect(() => applyLogicalStep(state, { technique: 'naked_single', placements: [], eliminations: [{ cell: 81, digit: 1 }], relatedCells: [], explanationData: {}, difficultyWeight: 1 })).toThrow('Invalid elimination cell')
		expect(() => applyLogicalStep(state, { technique: 'naked_single', placements: [], eliminations: [{ cell: 0, digit: 1 }, { cell: 0, digit: 1 }], relatedCells: [], explanationData: {}, difficultyWeight: 1 })).toThrow('absent candidate')
	})
})
