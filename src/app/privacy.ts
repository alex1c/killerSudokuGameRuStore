/**
 * Privacy / developer constants — no invented analytics or store URLs.
 */

export const DEVELOPER_NAME = 'ForestMusic'
export const DEVELOPER_WEBSITE = 'https://forest-music.ru'

/**
 * Placeholder slot for a published privacy-policy URL.
 * Leave null until an official policy page exists — do not invent one.
 */
export const PRIVACY_POLICY_URL: string | null = null

/** Honest local-first notes shown on the About screen. */
export const PRIVACY_NOTES: readonly string[] = [
	'Сейчас игровые данные хранятся локально на устройстве.',
	'Резервная копия создаётся только по вашему действию и сохраняется вами.',
	'Реклама и аналитика появятся только после отдельной интеграции — сейчас ничего не отправляется.',
]
