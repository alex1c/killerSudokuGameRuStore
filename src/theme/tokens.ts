/**
 * Light-theme design tokens for Phase 2 gameplay UI.
 * Keep colors centralized — do not scatter hex values across components.
 */

export const colors = {
	background: '#F4F1EA',
	boardBackground: '#FFFDF8',
	primaryText: '#1B4332',
	secondaryText: '#52796F',
	givenText: '#0B1F17',
	playerText: '#1D6A5C',
	gridThin: '#C9C2B4',
	gridThick: '#3D3A34',
	cageBorder: '#6B705C',
	selected: '#B7E4C7',
	related: '#E9F5EE',
	sameNumber: '#D8F3DC',
	conflict: '#F8D7DA',
	conflictText: '#9B2226',
	keypadBackground: '#FFFFFF',
	keypadBorder: '#D6D1C7',
	headerText: '#1B4332',
	solvedBanner: '#2D6A4F',
} as const

export const spacing = {
	screenPadding: 16,
	boardMaxWidth: 420,
	keypadGap: 8,
	headerGap: 12,
} as const

export const typography = {
	titleSize: 22,
	timerSize: 16,
	digitSizeRatio: 0.48,
	sumSizeRatio: 0.22,
	keypadDigitSize: 22,
} as const

export const borders = {
	gridThin: 1,
	gridThick: 2.5,
	cageInset: 2,
	outer: 3,
} as const
