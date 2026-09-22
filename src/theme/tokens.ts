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
	cageBorder: '#46664F',
	boardCageBorder: '#6A816D',
	sumText: '#8A5A18',
	selected: '#B7E4C7',
	related: '#E9F5EE',
	sameNumber: '#D8F3DC',
	conflict: '#F8D7DA',
	conflictText: '#9B2226',
	keypadBackground: '#FFFFFF',
	keypadBorder: '#D6D1C7',
	keypadDimmed: '#A8A29A',
	toolbarBackground: '#FFFDF8',
	toolbarActive: '#95D5B2',
	overlayScrim: 'rgba(27, 67, 50, 0.45)',
	overlayCard: '#FFFDF8',
	headerText: '#1B4332',
	solvedBanner: '#2D6A4F',
	noteText: '#66766D',
} as const

export const spacing = {
	screenPadding: 16,
	boardMaxWidth: 420,
	keypadGap: 6,
	headerGap: 8,
	toolbarGap: 8,
} as const

export const typography = {
	titleSize: 20,
	timerSize: 16,
	digitSizeRatio: 0.46,
	sumSizeRatio: 0.26,
	noteSizeRatio: 0.22,
	keypadDigitSize: 20,
	toolbarLabelSize: 11,
} as const

export const borders = {
	gridThin: 1,
	gridThick: 2.5,
	cageInset: 2,
	outer: 3,
} as const
