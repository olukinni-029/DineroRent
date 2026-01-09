interface ValidationResult {
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
export const normalizeValidationResult = (r: any): ValidationResult => {
  if (!r) return { valid: false, reason: 'Validation not performed', lookupData: undefined };

  if (typeof r.valid === 'boolean')
    return { valid: r.valid, reason: r.reason, lookupData: r.lookupData };

  if (typeof r.success === 'boolean')
    return {
      valid: r.success,
      reason: r.message || (r.success ? undefined : 'Validation failed'),
      lookupData: r.data || undefined,
    };

  if (typeof r === 'boolean')
    return { valid: r, reason: r ? undefined : 'Validation failed', lookupData: undefined };

  return { valid: false, reason: 'Unexpected result format', lookupData: undefined };
};
