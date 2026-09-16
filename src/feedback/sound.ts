/**
 * Sound feedback hooks — architectural only until short assets are bundled.
 * Toggle is respected; playback is a no-op so we avoid heavy native audio work.
 */

export type SoundKind = 'input' | 'error' | 'completion'

/**
 * Play a UI sound when enabled. Currently a safe no-op (no audio assets /
 * expo-av wiring). Keeps call sites ready for a future asset-backed player.
 */
export async function playSound(
	enabled: boolean,
	_kind: SoundKind,
): Promise<void> {
	if (!enabled) {
		return
	}
	// Intentionally empty: no bundled short SFX in this release block.
}
