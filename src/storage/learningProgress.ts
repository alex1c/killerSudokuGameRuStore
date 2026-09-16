/**
 * Learning / tutorial progress persistence (product block).
 * Versioned JSON under killerSudoku.learning.v1 — separate from active game.
 */

import type { LearningProgressV1 } from '../learning/types'

export const LEARNING_PROGRESS_SCHEMA_VERSION = 1 as const
export const LEARNING_PROGRESS_STORAGE_KEY = 'killerSudoku.learning.v1'

export type { LearningProgressV1 }

export type LoadLearningProgressResult =
	| { ok: true; progress: LearningProgressV1 }
	| { ok: false; reason: string }

/** Fresh empty learning progress (also corrupt-recovery fallback). */
export function createEmptyLearningProgress(): LearningProgressV1 {
	return {
		schemaVersion: LEARNING_PROGRESS_SCHEMA_VERSION,
		viewedLessonIds: [],
		completedInteractiveIds: [],
	}
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((item) => typeof item === 'string')
	)
}

/**
 * Parse learning progress JSON. Empty/missing → empty progress.
 * Corrupt / wrong-version payloads return ok:false (repository clears + empty).
 */
export function parseLearningProgress(
	raw: string | null,
): LoadLearningProgressResult {
	if (raw === null || raw.trim() === '') {
		return { ok: true, progress: createEmptyLearningProgress() }
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		return { ok: false, reason: 'invalid-json' }
	}
	if (parsed === null || typeof parsed !== 'object') {
		return { ok: false, reason: 'not-object' }
	}
	const doc = parsed as Partial<LearningProgressV1>
	if (doc.schemaVersion !== LEARNING_PROGRESS_SCHEMA_VERSION) {
		return { ok: false, reason: 'schema-version' }
	}
	if (
		!isStringArray(doc.viewedLessonIds) ||
		!isStringArray(doc.completedInteractiveIds)
	) {
		return { ok: false, reason: 'shape' }
	}
	return {
		ok: true,
		progress: {
			schemaVersion: LEARNING_PROGRESS_SCHEMA_VERSION,
			viewedLessonIds: doc.viewedLessonIds.slice(),
			completedInteractiveIds: doc.completedInteractiveIds.slice(),
		},
	}
}

export function serializeLearningProgress(
	progress: LearningProgressV1,
): string {
	return JSON.stringify(progress)
}

/** Pure: mark a lesson as viewed (idempotent). */
export function markLessonViewed(
	progress: LearningProgressV1,
	lessonId: string,
): LearningProgressV1 {
	if (progress.viewedLessonIds.includes(lessonId)) {
		return progress
	}
	return {
		...progress,
		viewedLessonIds: [...progress.viewedLessonIds, lessonId],
	}
}

/** Pure: mark an interactive lesson completed (idempotent). */
export function markLessonInteractiveComplete(
	progress: LearningProgressV1,
	lessonId: string,
): LearningProgressV1 {
	if (progress.completedInteractiveIds.includes(lessonId)) {
		return progress
	}
	return {
		...progress,
		completedInteractiveIds: [
			...progress.completedInteractiveIds,
			lessonId,
		],
	}
}
