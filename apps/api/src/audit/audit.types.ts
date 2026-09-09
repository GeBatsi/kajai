export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface WriteAuditLogParams {
  tableName: string;
  recordId?: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
  userId?: string;
}