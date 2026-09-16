/**
 * Backup file export / import using Expo FileSystem + Sharing + DocumentPicker.
 */

import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { serializeBackup, type BackupV1 } from './index'

export type BackupExportResult =
	| { ok: true }
	| { ok: false; reason: string; cancelled?: boolean }

export type BackupImportPickResult =
	| { ok: true; raw: string }
	| { ok: false; reason: string; cancelled?: boolean }

/**
 * Write backup JSON to cache and open the system share sheet.
 */
export async function exportBackupToShare(
	backup: BackupV1,
): Promise<BackupExportResult> {
	try {
		const base =
			FileSystem.cacheDirectory ?? FileSystem.documentDirectory
		if (!base) {
			return { ok: false, reason: 'no-cache-directory' }
		}
		const stamp = new Date().toISOString().replace(/[:.]/g, '-')
		const uri = `${base}killer-sudoku-backup-${stamp}.json`
		const payload = serializeBackup(backup)
		await FileSystem.writeAsStringAsync(uri, payload, {
			encoding: FileSystem.EncodingType.UTF8,
		})
		const canShare = await Sharing.isAvailableAsync()
		if (!canShare) {
			return { ok: false, reason: 'sharing-unavailable' }
		}
		await Sharing.shareAsync(uri, {
			mimeType: 'application/json',
			dialogTitle: 'Резервная копия Киллер Судоку',
		})
		return { ok: true }
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * Let the user pick a JSON backup file and return its contents.
 */
export async function pickBackupJsonFile(): Promise<BackupImportPickResult> {
	try {
		const result = await DocumentPicker.getDocumentAsync({
			type: ['application/json', 'text/json', 'text/plain', '*/*'],
			copyToCacheDirectory: true,
			multiple: false,
		})
		if (result.canceled || !result.assets?.[0]) {
			return { ok: false, reason: 'cancelled', cancelled: true }
		}
		const uri = result.assets[0].uri
		const raw = await FileSystem.readAsStringAsync(uri, {
			encoding: FileSystem.EncodingType.UTF8,
		})
		return { ok: true, raw }
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : String(error),
		}
	}
}
