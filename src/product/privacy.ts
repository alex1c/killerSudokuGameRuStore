/**
 * Privacy / developer constants — honest after ads + analytics integration.
 */

export const DEVELOPER_NAME = 'ForestMusic'
export const DEVELOPER_WEBSITE = 'https://forest-music.ru'

/**
 * Published GitHub Pages privacy policy (docs/privacy.md → privacy.html).
 * https://alex1c.github.io/killerSudokuGameRuStore/privacy.html
 */
export const PRIVACY_POLICY_URL =
	'https://alex1c.github.io/killerSudokuGameRuStore/privacy.html'

/** Honest notes shown on the About screen (post AppMetrica / Yandex Ads). */
export const PRIVACY_NOTES: readonly string[] = [
	'Игровые данные (сохранения, статистика, обучение, Daily) хранятся локально на устройстве.',
	'Резервная копия создаётся только по вашему действию и сохраняется вами; реклама и аналитика в неё не входят.',
	'Приложение использует Яндекс AppMetrica (аналитика событий) и Яндекс Mobile Ads (реклама).',
	'Основная игра работает offline; сбой сети или рекламы не блокирует геймплей.',
]
