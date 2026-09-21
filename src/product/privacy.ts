/**
 * Privacy / developer constants — honest after ads + analytics integration.
 */

export const DEVELOPER_NAME = 'ForestMusic'
export const DEVELOPER_WEBSITE = 'https://forest-music.ru'

/**
 * Placeholder for a published privacy-policy URL.
 * Remains null until an official page exists — release blocker for store listing.
 */
export const PRIVACY_POLICY_URL: string | null = null

/** Honest notes shown on the About screen (post AppMetrica / Yandex Ads). */
export const PRIVACY_NOTES: readonly string[] = [
	'Игровые данные (сохранения, статистика, обучение, Daily) хранятся локально на устройстве.',
	'Резервная копия создаётся только по вашему действию и сохраняется вами; реклама и аналитика в неё не входят.',
	'Приложение использует Яндекс AppMetrica (аналитика событий) и Яндекс Mobile Ads (реклама).',
	'Основная игра работает offline; сбой сети или рекламы не блокирует геймплей.',
	'Отдельная страница политики конфиденциальности пока не опубликована (PRIVACY_POLICY_URL отсутствует).',
]
