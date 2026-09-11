/**
 * Pure timer unit tests.
 */

import {
	formatElapsed,
	getElapsedMs,
	pauseTimer,
	resumeTimer,
} from '../../src/gameplay/timer'

describe('timer pure helpers', () => {
	it('handles active → background → active without counting background', () => {
		const start = 10_000
		let acc = 0
		let running: number | null = null

		;({ accumulatedMs: acc, runningSince: running } = resumeTimer(
			acc,
			running,
			start,
		))
		;({ accumulatedMs: acc, runningSince: running } = pauseTimer(
			acc,
			running,
			start + 3_000,
		))
		expect(acc).toBe(3_000)
		expect(running).toBeNull()

		;({ accumulatedMs: acc, runningSince: running } = resumeTimer(
			acc,
			running,
			start + 50_000,
		))
		expect(getElapsedMs(acc, running, start + 52_000)).toBe(5_000)
	})

	it('formats hour boundaries', () => {
		expect(formatElapsed(59 * 60_000 + 59_000)).toBe('59:59')
		expect(formatElapsed(60 * 60_000)).toBe('1:00:00')
	})
})
