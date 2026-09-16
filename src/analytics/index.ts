/**
 * Analytics event catalog + fire-and-forget wrapper.
 * UI talks only to this module — never to AppMetrica directly.
 */

export const ANALYTICS_EVENTS = {
	game_started: 'game_started',
	game_completed: 'game_completed',
	difficulty_selected: 'difficulty_selected',
	hint_opened: 'hint_opened',
	hint_revealed: 'hint_revealed',
	daily_started: 'daily_started',
	daily_completed: 'daily_completed',
	lesson_completed: 'lesson_completed',
	backup_created: 'backup_created',
	backup_restored: 'backup_restored',
	onboarding_completed: 'onboarding_completed',
	new_game_requested: 'new_game_requested',
	continue_game: 'continue_game',
} as const

export type AnalyticsEventName =
	(typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export type GameStartSource =
	| 'new_game'
	| 'daily'
	| 'replay'
	| 'continue'

/** Keys that must never leave the device via analytics. */
export const ANALYTICS_FORBIDDEN_PARAM_KEYS = [
	'solution',
	'notes',
	'values',
	'board',
	'backup',
	'raw',
	'seed',
] as const

export interface AnalyticsClient {
	track(event: AnalyticsEventName, params?: Record<string, unknown>): void
}

/** No-op client used before SDK init / in tests. */
export const noopAnalytics: AnalyticsClient = {
	track() {
		// Intentionally empty.
	},
}

let activeClient: AnalyticsClient = noopAnalytics

export function setAnalyticsClient(client: AnalyticsClient): void {
	activeClient = client
}

export function getAnalyticsClient(): AnalyticsClient {
	return activeClient
}

/**
 * Strip forbidden / oversized payloads before send.
 * Never includes puzzle solution, notes, board, or backup bodies.
 */
export function sanitizeAnalyticsParams(
	params?: Record<string, unknown>,
): Record<string, unknown> | undefined {
	if (!params) {
		return undefined
	}
	const out: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(params)) {
		if (
			(ANALYTICS_FORBIDDEN_PARAM_KEYS as readonly string[]).includes(key)
		) {
			continue
		}
		if (value === undefined) {
			continue
		}
		// Keep params JSON-friendly and small.
		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			out[key] = value
		} else if (value === null) {
			out[key] = null
		}
	}
	return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Fire-and-forget analytics. Never throws to callers.
 */
export function trackAnalytics(
	event: AnalyticsEventName,
	params?: Record<string, unknown>,
): void {
	try {
		activeClient.track(event, sanitizeAnalyticsParams(params))
	} catch {
		// Analytics must never crash gameplay.
	}
}
