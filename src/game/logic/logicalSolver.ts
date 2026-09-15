import { isValidSudoku } from '../sudoku/validation'
import { indexToPosition } from '../sudoku/types'
import { getCageCombinations } from '../killer/combinations'
import { cageForcedDigits, cloneLogicalState, initializeLogicalState, recomputeCageCandidateMask, unitCells } from './candidates'
import {
	countMaskBits,
	digitMask,
	maskToDigits,
	type LogicalPuzzle,
	type LogicalState,
	type LogicalStep,
	type TechniqueId,
} from './types'

const WEIGHTS: Record<TechniqueId, number> = {
	naked_single: 1,
	hidden_single: 2,
	cage_single: 2,
	cage_combination: 3,
	cage_candidate_elimination: 3,
	locked_candidate: 4,
	rule_of_45: 5,
	cage_intersection: 6,
	innie_outie: 8,
}

function step(
	technique: TechniqueId,
	placements: LogicalStep['placements'],
	eliminations: LogicalStep['eliminations'],
	relatedCells: number[],
	explanationData: Record<string, unknown>,
	cageIds?: string[],
): LogicalStep {
	return { technique, placements, eliminations, relatedCells, explanationData, cageIds, difficultyWeight: WEIGHTS[technique] }
}

function eachUnit(callback: (kind: 'row' | 'column' | 'box', unit: number, cells: number[]) => LogicalStep | null): LogicalStep | null {
	for (const kind of ['row', 'column', 'box'] as const) {
		for (let unit = 0; unit < 9; unit += 1) {
			const result = callback(kind, unit, unitCells(kind, unit))
			if (result) return result
		}
	}
	return null
}

function findNakedSingle(state: LogicalState): LogicalStep | null {
	for (let cell = 0; cell < 81; cell += 1) {
		if (state.values[cell] !== 0 || countMaskBits(state.candidates[cell]!) !== 1) continue
		const digit = maskToDigits(state.candidates[cell]!)[0]!
		return step('naked_single', [{ cell, digit }], [], [cell], { cell, digit })
	}
	return null
}

function findHiddenSingle(state: LogicalState): LogicalStep | null {
	return eachUnit((kind, unit, cells) => {
		for (let digit = 1; digit <= 9; digit += 1) {
			const possible = cells.filter((cell) => state.values[cell] === 0 && (state.candidates[cell]! & digitMask(digit as never)) !== 0)
			if (possible.length === 1) {
				const cell = possible[0]!
				return step('hidden_single', [{ cell, digit: digit as never }], [], [cell, ...cells], { digit, unit: kind, unitIndex: unit })
			}
		}
		return null
	})
}

function findCageSingle(puzzle: LogicalPuzzle, state: LogicalState): LogicalStep | null {
	for (const cage of puzzle.cages) {
		const empty = cage.cells.filter((cell) => state.values[cell] === 0)
		if (empty.length !== 1) continue
		const knownSum = cage.cells.reduce((sum, cell) => sum + (state.values[cell] ?? 0), 0)
		const remaining = cage.sum - knownSum
		if (remaining < 1 || remaining > 9) continue
		const cell = empty[0]!
		return step('cage_single', [{ cell, digit: remaining as never }], [], cage.cells.slice(), { targetSum: cage.sum, knownSum, remaining, cageId: cage.id }, [cage.id])
	}
	return null
}

function findCageStep(puzzle: LogicalPuzzle, state: LogicalState): LogicalStep | null {
	for (const cage of puzzle.cages) {
		const possible = recomputeCageCandidateMask(state, cage)
		const known = cage.cells.filter((cell) => state.values[cell] !== 0)
		const knownDigits = new Set(known.map((cell) => state.values[cell] as never))
		const remainingSum = cage.sum - known.reduce((sum, cell) => sum + (state.values[cell] ?? 0), 0)
		const combinationCount = getCageCombinations(cage.cells.length - known.length, remainingSum, knownDigits).length
		const eliminations: LogicalStep['eliminations'] = []
		for (let i = 0; i < cage.cells.length; i += 1) {
			const cell = cage.cells[i]!
			if (state.values[cell] !== 0 || possible[i] === 0) continue
			for (const digit of maskToDigits(state.candidates[cell]! & ~possible[i]!)) eliminations.push({ cell, digit })
		}
		if (eliminations.length === 0) continue
		return step(combinationCount === 1 ? 'cage_combination' : 'cage_candidate_elimination', [], eliminations, cage.cells.slice(), { cageId: cage.id, allowedMasks: possible, combinationCount })
	}
	return null
}

function findLockedCandidate(state: LogicalState): LogicalStep | null {
	for (const sourceKind of ['row', 'column'] as const) {
		for (let source = 0; source < 9; source += 1) {
			const sourceCells = unitCells(sourceKind, source)
			for (let digit = 1; digit <= 9; digit += 1) {
				const possible = sourceCells.filter((cell) => state.values[cell] === 0 && (state.candidates[cell]! & digitMask(digit as never)) !== 0)
				if (possible.length < 2) continue
				const common = sourceKind === 'row' ? new Set(possible.map((cell) => Math.floor((cell % 9) / 3))) : new Set(possible.map((cell) => Math.floor(Math.floor(cell / 9) / 3)))
				if (common.size !== 1) continue
				const box = [...common][0]!
				const targetCells = unitCells('box', sourceKind === 'row' ? Math.floor(source / 3) * 3 + box : box * 3 + Math.floor(source / 3))
				const eliminations = targetCells.filter((cell) => !sourceCells.includes(cell) && state.values[cell] === 0 && (state.candidates[cell]! & digitMask(digit as never)) !== 0).map((cell) => ({ cell, digit: digit as never }))
				if (eliminations.length) return step('locked_candidate', [], eliminations, [...sourceCells, ...targetCells], { subtype: 'pointing', sourceUnit: sourceKind, sourceIndex: source, box, digit })
			}
		}
	}
	return null
}

function findRuleOf45(state: LogicalState): LogicalStep | null {
	return eachUnit((kind, unit, cells) => {
		const empty = cells.filter((cell) => state.values[cell] === 0)
		if (empty.length < 2 || empty.length > 4) return null
		const knownSum = cells.reduce((sum, cell) => sum + (state.values[cell] ?? 0), 0)
		const remaining = 45 - knownSum
		const supported = new Map<number, Set<number>>()
		const visit = (index: number, sum: number, used: Set<number>, selected: number[] = []): void => {
			if (index === empty.length) {
				if (sum === remaining) for (let i = 0; i < empty.length; i += 1) {
					if (!supported.has(empty[i]!)) supported.set(empty[i]!, new Set())
					supported.get(empty[i]!)!.add(selected[i]!)
				}
				return
			}
			const cell = empty[index]!
			for (const digit of maskToDigits(state.candidates[cell]!)) {
				if (used.has(digit) || sum + digit > remaining) continue
				const next = new Set(used)
				next.add(digit)
				visit(index + 1, sum + digit, next, [...selected, digit])
			}
		}
		visit(0, 0, new Set())
		const eliminations = empty.flatMap((cell) => maskToDigits(state.candidates[cell]!).filter((digit) => !(supported.get(cell)?.has(digit) ?? false)).map((digit) => ({ cell, digit })))
		if (!eliminations.length) return null
		return step('rule_of_45', [], eliminations, cells, { unit: kind, unitIndex: unit, total: 45, knownSum, remaining })
	})
}

function findCageIntersection(puzzle: LogicalPuzzle, state: LogicalState): LogicalStep | null {
	for (const cage of puzzle.cages) {
		for (const kind of ['row', 'column', 'box'] as const) {
			for (let unit = 0; unit < 9; unit += 1) {
				const cells = unitCells(kind, unit)
				if (!cage.cells.every((cell) => cells.includes(cell))) continue
				for (const digit of cageForcedDigits(state, cage)) {
					const eliminations = cells.filter((cell) => !cage.cells.includes(cell) && state.values[cell] === 0 && (state.candidates[cell]! & digitMask(digit)) !== 0).map((cell) => ({ cell, digit }))
					if (eliminations.length) return step('cage_intersection', [], eliminations, [...cage.cells, ...cells], { cageId: cage.id, unit: kind, unitIndex: unit, digit }, [cage.id])
				}
			}
			}
	}
	return null
}

function findInnieOutie(puzzle: LogicalPuzzle, state: LogicalState): LogicalStep | null {
	for (const kind of ['row', 'column', 'box'] as const) {
		for (let unit = 0; unit < 9; unit += 1) {
			const cells = unitCells(kind, unit)
			const crossing = puzzle.cages.filter((cage) => cage.cells.some((cell) => cells.includes(cell)) && !cage.cells.every((cell) => cells.includes(cell)))
			if (crossing.length !== 1) continue
			const cage = crossing[0]!
			const inside = cage.cells.filter((cell) => cells.includes(cell))
			const outside = cage.cells.filter((cell) => !cells.includes(cell))
			if (inside.length !== 1 || outside.some((cell) => state.values[cell] === 0) || state.values[inside[0]!] !== 0) continue
			const containedSum = puzzle.cages.filter((candidate) => candidate.cells.every((cell) => cells.includes(cell))).reduce((sum, candidate) => sum + candidate.sum, 0)
			const remaining = 45 - containedSum
			const outsideSum = cage.sum - cage.cells.filter((cell) => !cells.includes(cell)).reduce((sum, cell) => sum + (state.values[cell] ?? 0), 0)
			const digit = remaining - outsideSum
			if (digit >= 1 && digit <= 9) return step('innie_outie', [{ cell: inside[0]!, digit: digit as never }], [], [...cells, ...cage.cells], { unit: kind, unitIndex: unit, cageId: cage.id, remaining, outsideSum }, [cage.id])
		}
	}
	return null
}

export function findNextLogicalStep(puzzle: LogicalPuzzle, state: LogicalState): LogicalStep | null {
	return findNakedSingle(state) ?? findHiddenSingle(state) ?? findCageSingle(puzzle, state) ?? findCageStep(puzzle, state) ?? findLockedCandidate(state) ?? findRuleOf45(state) ?? findCageIntersection(puzzle, state) ?? findInnieOutie(puzzle, state)
}

export function applyLogicalStep(state: LogicalState, logicalStep: LogicalStep): LogicalState {
	const next = cloneLogicalState(state)
	for (const elimination of logicalStep.eliminations) {
		if (!Number.isInteger(elimination.cell) || elimination.cell < 0 || elimination.cell >= 81) throw new Error('Invalid elimination cell')
		if (elimination.digit < 1 || elimination.digit > 9) throw new Error('Invalid elimination digit')
		if (next.values[elimination.cell] !== 0) throw new Error('Cannot eliminate a candidate from a filled cell')
		if ((next.candidates[elimination.cell]! & digitMask(elimination.digit)) === 0) throw new Error('Cannot eliminate an absent candidate')
		next.candidates[elimination.cell] = (next.candidates[elimination.cell]! & ~digitMask(elimination.digit))
		if (next.candidates[elimination.cell] === 0) throw new Error(`Candidate set became empty at cell ${elimination.cell}`)
	}
	for (const placement of logicalStep.placements) {
		if (!Number.isInteger(placement.cell) || placement.cell < 0 || placement.cell >= 81) throw new Error('Invalid placement cell')
		if (placement.digit < 1 || placement.digit > 9) throw new Error('Invalid placement digit')
		if (next.values[placement.cell] !== 0) throw new Error('Cannot place into a filled cell')
		if ((next.candidates[placement.cell]! & digitMask(placement.digit)) === 0) throw new Error(`Placement is not a candidate: ${logicalStep.technique} cell=${placement.cell} digit=${placement.digit}`)
		next.values[placement.cell] = placement.digit
		next.candidates[placement.cell] = digitMask(placement.digit)
		for (const cell of Array.from({ length: 81 }, (_, index) => index)) {
				if (cell !== placement.cell && next.values[cell] === 0 && (sameUnit(cell, placement.cell))) next.candidates[cell] = next.candidates[cell]! & ~digitMask(placement.digit)
		}
	}
	if (!isValidSudoku(next.values)) throw new Error('Logical step produced an invalid Sudoku state')
	for (let cell = 0; cell < 81; cell += 1) {
		if (next.values[cell] === 0 && next.candidates[cell] === 0) throw new Error(`Candidate set became empty at cell ${cell}`)
	}
	return next
}

function sameUnit(a: number, b: number): boolean {
	const pa = indexToPosition(a)
	const pb = indexToPosition(b)
	return pa.row === pb.row || pa.col === pb.col || (Math.floor(pa.row / 3) === Math.floor(pb.row / 3) && Math.floor(pa.col / 3) === Math.floor(pb.col / 3))
}

export function solveLogically(puzzle: LogicalPuzzle): import('./types').LogicalSolveResult {
	let state = initializeLogicalState(puzzle)
	const steps: LogicalStep[] = []
	for (let guard = 0; guard < 1000; guard += 1) {
		if (state.values.every((value) => value !== 0)) return { solved: true, steps, finalState: state, stalled: false }
		const next = findNextLogicalStep(puzzle, state)
		if (!next) return { solved: false, steps, finalState: state, stalled: true }
		state = applyLogicalStep(state, next)
		steps.push(next)
	}
	return { solved: false, steps, finalState: state, stalled: true }
}

export { WEIGHTS }
