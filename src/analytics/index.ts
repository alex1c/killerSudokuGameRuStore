/**
 * Analytics event names — prepared for AppMetrica (SDK not connected).
 * Do not send events until a real API key is configured.
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
} as const

export type AnalyticsEventName =
	(typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export interface AnalyticsClient {
	track(event: AnalyticsEventName, params?: Record<string, unknown>): void
}

/** No-op client until AppMetrica (or another SDK) is wired with a real key. */
export const noopAnalytics: AnalyticsClient = {
	track() {
		// Intentionally empty.
	},
}

let activeClient: AnalyticsClient = noopAnalytics

export function setAnalyticsClient(client: AnalyticsClient): void {
	activeClient = client
}

export function trackAnalytics(
	event: AnalyticsEventName,
	params?: Record<string, unknown>,
): void {
	activeClient.track(event, params)
}
