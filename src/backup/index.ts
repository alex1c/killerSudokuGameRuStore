/**
 * Backup domain barrel — build, validate, apply (pool-free).
 */

export {
	BACKUP_VERSION,
	BACKUP_APP_ID,
	BACKUP_DATA_KEYS,
	BACKUP_FORBIDDEN_POOL_KEYS,
} from './types'
export type {
	BackupV1,
	BackupDataV1,
	BackupParts,
	BackupDataKey,
} from './types'

export { buildBackup, serializeBackup } from './buildBackup'

export { validateBackup, isBackupPoolFree } from './validateBackup'
export type { ValidateBackupResult } from './validateBackup'

export {
	applyBackupValidated,
	applyBackupAtomic,
} from './applyBackup'
export type { BackupApplyRepos, ApplyBackupResult } from './applyBackup'

export {
	exportBackupToShare,
	pickBackupJsonFile,
} from './backupIo'
export type {
	BackupExportResult,
	BackupImportPickResult,
} from './backupIo'
