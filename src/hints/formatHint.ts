/**
 * Russian UI formatter for LogicalStep — engine stays language-free.
 */

import type { LogicalStep, TechniqueId } from '../game/logic'
import type { FormattedHint, HintLevel } from './hintTypes'

const UNIT_RU: Record<string, string> = {
	row: 'строке',
	column: 'столбце',
	box: 'блоке 3×3',
}

function unitPhrase(data: Record<string, unknown>): string {
	const kind = typeof data.unit === 'string' ? data.unit : 'row'
	const index =
		typeof data.unitIndex === 'number' ? data.unitIndex + 1 : undefined
	const where = UNIT_RU[kind] ?? 'области'
	if (index === undefined) {
		return where
	}
	return `${where} ${index}`
}

function cageSumLabel(data: Record<string, unknown>): string {
	if (typeof data.targetSum === 'number') {
		return String(data.targetSum)
	}
	if (typeof data.sum === 'number') {
		return String(data.sum)
	}
	return '…'
}

function techniqueTitle(technique: TechniqueId): string {
	switch (technique) {
		case 'naked_single':
			return 'Единственный кандидат'
		case 'hidden_single':
			return 'Скрытая единственность'
		case 'cage_single':
			return 'Единственная клетка области'
		case 'cage_combination':
			return 'Комбинации области'
		case 'cage_candidate_elimination':
			return 'Исключение по области'
		case 'locked_candidate':
			return 'Заблокированный кандидат'
		case 'rule_of_45':
			return 'Правило 45'
		case 'cage_intersection':
			return 'Пересечение области'
		case 'innie_outie':
			return 'Внутри и снаружи блока'
		default:
			return 'Логический шаг'
	}
}

function level1(step: LogicalStep): { title: string; body: string } {
	const data = step.explanationData
	const sum = cageSumLabel(data)
	switch (step.technique) {
		case 'naked_single':
		case 'hidden_single':
			return {
				title: 'Намёк',
				body: `Посмотрите на ${unitPhrase(data)}.`,
			}
		case 'cage_single':
		case 'cage_combination':
		case 'cage_candidate_elimination':
		case 'cage_intersection':
		case 'innie_outie':
			return {
				title: 'Намёк',
				body: `Посмотрите на область с суммой ${sum}.`,
			}
		case 'locked_candidate':
			return {
				title: 'Намёк',
				body: `Обратите внимание на ${unitPhrase(data)}.`,
			}
		case 'rule_of_45':
			return {
				title: 'Намёк',
				body: 'Используйте сумму цифр 1–9 в блоке (правило 45).',
			}
		default:
			return {
				title: 'Намёк',
				body: 'Обратите внимание на выделенные клетки.',
			}
	}
}

function level2(step: LogicalStep): { title: string; body: string } {
	const data = step.explanationData
	const sum = cageSumLabel(data)
	const digit = data.digit
	switch (step.technique) {
		case 'naked_single':
			return {
				title: 'Объяснение',
				body: 'В этой клетке остался только один возможный вариант.',
			}
		case 'hidden_single':
			return {
				title: 'Объяснение',
				body: `Цифра ${digit ?? '?'} может стоять только в одной клетке этой ${unitPhrase(data)}.`,
			}
		case 'cage_single': {
			const remaining =
				typeof data.remaining === 'number' ? data.remaining : '?'
			return {
				title: 'Объяснение',
				body: `В области с суммой ${sum} осталась одна пустая клетка — в ней должно быть ${remaining}.`,
			}
		}
		case 'cage_combination':
			return {
				title: 'Объяснение',
				body: `Для области с суммой ${sum} возможны только определённые комбинации цифр.`,
			}
		case 'cage_candidate_elimination':
			return {
				title: 'Объяснение',
				body:
					typeof digit === 'number'
						? `Цифра ${digit} здесь невозможна, потому что не входит ни в одну допустимую комбинацию области ${sum}.`
						: `Некоторые цифры здесь невозможны, потому что не входят ни в одну допустимую комбинацию области ${sum}.`,
			}
		case 'locked_candidate':
			return {
				title: 'Объяснение',
				body: `Цифра ${digit ?? '?'} в ${unitPhrase(data)} встречается только на одной линии — её можно исключить в остальных клетках этой линии.`,
			}
		case 'rule_of_45':
			return {
				title: 'Объяснение',
				body: 'Сумма цифр 1–9 равна 45. По известным клеткам блока можно найти недостающую сумму.',
			}
		case 'cage_intersection':
			return {
				title: 'Объяснение',
				body: `Область ${sum} пересекается с рядом или столбцом — это сужает возможные цифры.`,
			}
		case 'innie_outie':
			return {
				title: 'Объяснение',
				body: 'Часть области выходит за границы блока — сравните суммы клеток внутри блока и снаружи.',
			}
		default:
			return {
				title: 'Объяснение',
				body: techniqueTitle(step.technique),
			}
	}
}

function level3(step: LogicalStep): { title: string; body: string } {
	const placement = step.placements[0]
	const elim = step.eliminations[0]
	if (placement) {
		return {
			title: 'Вывод',
			body: `В клетке можно поставить ${placement.digit}.`,
		}
	}
	if (elim) {
		const count = step.eliminations.length
		return {
			title: 'Вывод',
			body:
				count === 1
					? `Можно исключить кандидата ${elim.digit}.`
					: `Можно исключить ${count} кандидатов.`,
		}
	}
	return {
		title: 'Вывод',
		body: 'Этот логический шаг уточняет позицию.',
	}
}

function level4(step: LogicalStep): { title: string; body: string } {
	if (step.placements.length > 0) {
		const p = step.placements[0]!
		return {
			title: 'Ход',
			body: `Поставить ${p.digit} в выбранную клетку.`,
		}
	}
	return {
		title: 'Ход',
		body: 'Исключения показаны подсветкой — заметки не меняются автоматически.',
	}
}

/**
 * Format a LogicalStep for the requested hint level (1–4).
 */
export function formatHint(
	step: LogicalStep,
	level: HintLevel,
): FormattedHint {
	const copy =
		level === 1
			? level1(step)
			: level === 2
				? level2(step)
				: level === 3
					? level3(step)
					: level4(step)

	const targetCells = [
		...step.placements.map((p) => p.cell),
		...step.eliminations.map((e) => e.cell),
	]
	const highlightCells = Array.from(
		new Set([...step.relatedCells, ...targetCells]),
	)

	return {
		technique: step.technique,
		level,
		title: copy.title,
		body: copy.body,
		highlightCells,
		targetCells: Array.from(new Set(targetCells)),
		eliminationHints: step.eliminations.slice(),
		canAdvance: level < 4,
		canApply: level === 4 && step.placements.length > 0,
		stalled: false,
	}
}

export function formatStalledHint(): FormattedHint {
	return {
		technique: 'naked_single',
		level: 1,
		title: 'Подсказка',
		body: 'Для этой позиции подробная логическая подсказка пока недоступна.',
		highlightCells: [],
		targetCells: [],
		eliminationHints: [],
		canAdvance: false,
		canApply: false,
		stalled: true,
	}
}

export function techniqueLabel(technique: TechniqueId): string {
	return techniqueTitle(technique)
}
