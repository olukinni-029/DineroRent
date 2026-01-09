export interface ValidationResult {
  valid: boolean;
  reason?: string;
  lookupData?: any;
}
// Utility helpers

export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * ✅ Normalize any validation response into a consistent shape
 */
export const normalizeValidationResult = (r: unknown): ValidationResult => {
  if (!r) return { valid: false, reason: 'Validation not performed', lookupData: undefined };

  const res = r as Record<string, any>;

  if (typeof res.valid === 'boolean')
    return { valid: res.valid, reason: res.reason, lookupData: res.lookupData };

  if (typeof res.success === 'boolean')
    return {
      valid: res.success,
      reason: res.message || (res.success ? undefined : 'Validation failed'),
      lookupData: res.data || undefined,
    };

  if (typeof r === 'boolean')
    return { valid: r, reason: r ? undefined : 'Validation failed', lookupData: undefined };

  return { valid: false, reason: 'Unexpected result format', lookupData: undefined };
};
