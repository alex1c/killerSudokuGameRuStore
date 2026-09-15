/**
 * Phase 4 QA harness unit tests (MemoryStorageAdapter — no AsyncStorage).
 */

import {
	MemoryStorageAdapter,
	PHASE4_QA_STORAGE_KEY,
	ACTIVE_GAME_STORAGE_KEY,
} from '../../src/storage'
import {
	runPhase4PersistenceQa,
	runPhase4Qa,
} from '../../src/dev/phase4Qa'

describe('Phase 4 QA harness', () => {
	it('PASS with a healthy memory adapter', async () => {
		const adapter = new MemoryStorageAdapter()
		const result = await runPhase4Qa({
			adapter,
			storageKey: PHASE4_QA_STORAGE_KEY,
			includeGenerator: false,
		})
		expect(result.passed).toBe(true)
		expect(result.checks.length).toBeGreaterThan(5)
		expect(result.checks.every((c) => c.passed)).toBe(true)
		// Must never write the production Continue key.
		expect(await adapter.getItem(ACTIVE_GAME_STORAGE_KEY)).toBeNull()
	})

	it('FAIL when storage cannot persist', async () => {
		// Writes appear to succeed but never store — roundtrip must fail.
		const broken = {
			async getItem(_key: string): Promise<string | null> {
				return null
			},
			async setItem(_key: string, _value: string): Promise<void> {
				return
			},
			async removeItem(_key: string): Promise<void> {
				return
			},
		}
		const result = await runPhase4PersistenceQa({
			adapter: broken,
			storageKey: PHASE4_QA_STORAGE_KEY,
		})
		expect(result.passed).toBe(false)
		expect(result.checks.some((c) => !c.passed)).toBe(true)
	})

	it('summary includes expected persistence check names', async () => {
		const result = await runPhase4PersistenceQa({
			adapter: new MemoryStorageAdapter(),
			storageKey: PHASE4_QA_STORAGE_KEY,
		})
		const names = result.checks.map((c) => c.name)
		expect(names).toEqual(
			expect.arrayContaining([
				'roundtrip #1',
				'roundtrip #2',
				'latest wins',
				'timer background',
				'killed gap',
				'duplicate accumulation',
				'replacement Cancel',
				'replacement Confirm',
				'completion cleanup',
				'corrupt smoke',
			]),
		)
	})
})
