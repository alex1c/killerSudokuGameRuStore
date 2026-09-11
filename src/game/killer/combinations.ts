/**
 * Pure cage-combination helpers for Killer Sudoku.
 * Digits are unique within a cage; order does not create duplicates.
 *
 * Internally precomputes all digit subsets so solvers can prune fast.
 */

import { ALL_DIGITS, type Digit } from '../sudoku/types'

/** Max cage sum is 45 (1+...+9). */
const MAX_SUM = 45

/**
 * Indexed lookup: size (1..9) → sum (0..45) → list of digit bitmasks.
 */
const COMBOS_BY_SIZE_SUM: number[][][] = Array.from(
	{ length: 10 },
	() => Array.from({ length: MAX_SUM + 1 }, () => [] as number[]),
)

for (let mask = 0; mask < 1 << 10; mask += 1) {
	// Only bits 1..9 are digits; ignore bit 0.
	if ((mask & 1) !== 0) {
		continue
	}
	let size = 0
	let sum = 0
	for (let d = 1; d <= 9; d += 1) {
		if ((mask & (1 << d)) !== 0) {
			size += 1
			sum += d
		}
	}
	if (size === 0 || size > 9 || sum > MAX_SUM) {
		continue
	}
	COMBOS_BY_SIZE_SUM[size]![sum]!.push(mask)
}

/** Normalize excluded digits into a bitmask (bits 1..9). */
export function digitsToMask(
	excludedDigits?: ReadonlySet<Digit> | readonly Digit[],
): number {
	if (!excludedDigits) {
		return 0
	}
	let mask = 0
	for (const digit of excludedDigits) {
		if (digit >= 1 && digit <= 9) {
			mask |= 1 << digit
		}
	}
	return mask
}

/**
 * Minimum / maximum possible sums for `cellCount` distinct digits 1–9.
 */
export function cageSumBounds(cellCount: number): {
	min: number
	max: number
} {
	if (cellCount < 1 || cellCount > 9) {
		return { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
	}
	let min = 0
	let max = 0
	for (let i = 0; i < cellCount; i += 1) {
		min += ALL_DIGITS[i]!
		max += ALL_DIGITS[9 - 1 - i]!
	}
	return { min, max }
}

/**
 * Fast existence check using precomputed subset masks.
 */
export function hasCageCombinationMask(
	cellCount: number,
	targetSum: number,
	excludedMask: number = 0,
): boolean {
	if (
		!Number.isInteger(cellCount) ||
		cellCount < 1 ||
		cellCount > 9 ||
		!Number.isInteger(targetSum) ||
		targetSum < 0 ||
		targetSum > MAX_SUM
	) {
		return false
	}
	const list = COMBOS_BY_SIZE_SUM[cellCount]![targetSum]!
	for (const mask of list) {
		if ((mask & excludedMask) === 0) {
			return true
		}
	}
	return false
}

/**
 * Return all ascending digit combinations of length `cellCount`
 * that sum to `targetSum`, optionally excluding some digits.
 */
export function getCageCombinations(
	cellCount: number,
	targetSum: number,
	excludedDigits?: ReadonlySet<Digit> | readonly Digit[],
): Digit[][] {
	if (
		!Number.isInteger(cellCount) ||
		cellCount < 1 ||
		cellCount > 9 ||
		!Number.isInteger(targetSum) ||
		targetSum < 0 ||
		targetSum > MAX_SUM
	) {
		return []
	}

	const excludedMask = digitsToMask(excludedDigits)
	const list = COMBOS_BY_SIZE_SUM[cellCount]![targetSum]!
	const results: Digit[][] = []

	for (const mask of list) {
		if ((mask & excludedMask) !== 0) {
			continue
		}
		const combo: Digit[] = []
		for (let d = 1; d <= 9; d += 1) {
			if ((mask & (1 << d)) !== 0) {
				combo.push(d as Digit)
			}
		}
		results.push(combo)
	}

	// Stable ascending order by digits for deterministic API output.
	results.sort((left, right) => {
		for (let i = 0; i < left.length; i += 1) {
			const diff = left[i]! - right[i]!
			if (diff !== 0) {
				return diff
			}
		}
		return 0
	})
	return results
}

/**
 * True when at least one combination exists for the given constraints.
 */
export function hasCageCombination(
	cellCount: number,
	targetSum: number,
	excludedDigits?: ReadonlySet<Digit> | readonly Digit[],
): boolean {
	return hasCageCombinationMask(
		cellCount,
		targetSum,
		digitsToMask(excludedDigits),
	)
}
