import {
	createSeededRandom,
	randomInt,
	shuffledCopy,
} from '../../src/utils/seededRandom'

describe('createSeededRandom', () => {
	it('is reproducible for the same seed', () => {
		const a = createSeededRandom(42)
		const b = createSeededRandom(42)
		const seqA = Array.from({ length: 20 }, () => a())
		const seqB = Array.from({ length: 20 }, () => b())
		expect(seqA).toEqual(seqB)
	})

	it('usually differs across seeds', () => {
		const a = createSeededRandom(1)
		const b = createSeededRandom(2)
		const seqA = Array.from({ length: 10 }, () => a())
		const seqB = Array.from({ length: 10 }, () => b())
		expect(seqA).not.toEqual(seqB)
	})

	it('randomInt stays inclusive', () => {
		const rng = createSeededRandom(7)
		for (let i = 0; i < 100; i += 1) {
			const value = randomInt(rng, 1, 9)
			expect(value).toBeGreaterThanOrEqual(1)
			expect(value).toBeLessThanOrEqual(9)
		}
	})

	it('shuffledCopy preserves elements', () => {
		const rng = createSeededRandom(99)
		const input = [1, 2, 3, 4, 5]
		const output = shuffledCopy(input, rng)
		expect(output.sort()).toEqual([1, 2, 3, 4, 5])
		expect(input).toEqual([1, 2, 3, 4, 5])
	})
})
