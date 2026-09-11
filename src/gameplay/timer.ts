/**
 * Pure timer helpers — no setInterval drift, no RN imports.
 */

/**
 * Elapsed playtime in milliseconds at wall-clock `now`.
 */
export function getElapsedMs(
	accumulatedMs: number,
	runningSince: number | null,
	now: number,
): number {
	if (runningSince === null) {
		return Math.max(0, accumulatedMs)
	}
	return Math.max(0, accumulatedMs + (now - runningSince))
}

/**
 * Pause a running timer segment into accumulated milliseconds.
 */
export function pauseTimer(
	accumulatedMs: number,
	runningSince: number | null,
	now: number,
): { accumulatedMs: number; runningSince: null } {
	return {
		accumulatedMs: getElapsedMs(accumulatedMs, runningSince, now),
		runningSince: null,
	}
}

/**
 * Resume a paused timer from wall-clock `now`.
 */
export function resumeTimer(
	accumulatedMs: number,
	runningSince: number | null,
	now: number,
): { accumulatedMs: number; runningSince: number } {
	if (runningSince !== null) {
		return { accumulatedMs, runningSince }
	}
	return {
		accumulatedMs: Math.max(0, accumulatedMs),
		runningSince: now,
	}
}

/**
 * Format elapsed milliseconds as m:ss / h:mm:ss style strings.
 * Examples: 00:00, 05:37, 42:18, 1:03:27
 */
export function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	const ss = String(seconds).padStart(2, '0')

	if (hours > 0) {
		const mm = String(minutes).padStart(2, '0')
		return `${hours}:${mm}:${ss}`
	}

	const mm = String(minutes).padStart(2, '0')
	return `${mm}:${ss}`
}
