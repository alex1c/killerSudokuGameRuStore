import { getCageCombinations } from '../../../src/game/killer/combinations'

describe('getCageCombinations', () => {
	it('returns known pair combinations', () => {
		expect(getCageCombinations(2, 3)).toEqual([[1, 2]])
		expect(getCageCombinations(2, 17)).toEqual([[8, 9]])
	})

	it('returns known triple combinations', () => {
		expect(getCageCombinations(3, 6)).toEqual([[1, 2, 3]])
		expect(getCageCombinations(3, 24)).toEqual([[7, 8, 9]])
	})

	it('handles impossible / boundary sums', () => {
		expect(getCageCombinations(2, 2)).toEqual([])
		expect(getCageCombinations(2, 18)).toEqual([])
		expect(getCageCombinations(3, 5)).toEqual([])
		expect(getCageCombinations(3, 25)).toEqual([])
	})

	it('rejects invalid cell counts', () => {
		expect(getCageCombinations(0, 1)).toEqual([])
		expect(getCageCombinations(10, 45)).toEqual([])
		expect(getCageCombinations(-1, 10)).toEqual([])
	})

	it('supports exclusions', () => {
		expect(getCageCombinations(2, 10, [1])).toEqual([
			[2, 8],
			[3, 7],
			[4, 6],
		])
		expect(getCageCombinations(2, 3, [1])).toEqual([])
		expect(getCageCombinations(3, 6, [2])).toEqual([])
	})

	it('does not emit ordered duplicates', () => {
		const combos = getCageCombinations(3, 15)
		const serialized = combos.map((combo) => combo.join(','))
		expect(new Set(serialized).size).toBe(serialized.length)
		for (const combo of combos) {
			expect([...combo].sort((a, b) => a - b)).toEqual(combo)
		}
	})
})
