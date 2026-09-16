/**
 * Learning / tutorial progress schema (product block).
 * Pure types — persistence lives in src/storage/learningProgress.ts.
 */

/**
 * Versioned learning progress document.
 * Lesson and interactive ids are opaque strings owned by the learning content.
 */
export interface LearningProgressV1 {
	schemaVersion: 1
	viewedLessonIds: string[]
	completedInteractiveIds: string[]
}
