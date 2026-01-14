import dotenv from 'dotenv';
dotenv.config();

import Vendor from '../models/Vendor.model';
import { restClientWithHeaders } from '../utils/common/restclient';
import logger from '../utils/logger';
import { normalizeValidationResult, ValidationResult } from '../utils/helpers';

const baseUrl = 'https://api.dojah.io';
const DOJAH_APP_ID = process.env.DOJAH_APP_ID!;
const DOJAH_SECRET_KEY = process.env.DOJAH_SECRET_KEY!;

if (!DOJAH_APP_ID || !DOJAH_SECRET_KEY) {
  throw new Error('DOJAH_APP_ID and DOJAH_SECRET_KEY environment variables are required');
}

interface DojahResponse {
  success: boolean;
  data?: any;
  message?: string;
  raw?: any;
}

/**
 * Generic Dojah HTTP Caller with retry mechanism
 */
const callDojah = async (
  endpoint: string,
  payload: Record<string, any>,
  method: 'GET' | 'POST' = 'GET',
  maxRetries = 3
): Promise<DojahResponse> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await restClientWithHeaders(
        method,
        `${baseUrl}${endpoint}`,
        payload,
        {
          AppId: DOJAH_APP_ID,
          Authorization: DOJAH_SECRET_KEY,
          'Content-Type': 'application/json',
        }
      );

      console.log('✅ Dojah raw response:', endpoint, JSON.stringify(response, null, 2));

      // ✅ Treat as success if response has an 'entity' or expected data
      const isSuccess =
        response &&
        (response.success === true ||
          response.entity ||
          response.result ||
          response.status === 'success');

      if (!isSuccess) {
        lastError = response;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Retrying Dojah call [${endpoint}] in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else break;
      }

      // ✅ Normalize return for consistency
      return {
        success: true,
        data: response,
        message: response.message || 'OK',
      };
    } catch (err: any) {
      lastError = err;
      console.error(`⚠️ Dojah API call failed [${endpoint}] - Attempt ${attempt + 1}:`, err.message);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const statusCode = lastError?.response?.status;
  const message =
    lastError?.response?.message ||
    lastError?.response?.error ||
    (statusCode === 404
      ? `Dojah: Resource not found at ${endpoint}`
      : `Dojah API error (${endpoint}): ${lastError?.message || 'Unknown error'}`);

  return {
    success: false,
    message,
    raw: lastError?.response || lastError,
  };
};


/**
 * Dojah API Validators and Lookups
 */
const lookupNIN = (nin: string) => callDojah('/api/v1/kyc/nin', { nin });
const validateBVN = (bvn: string) => callDojah('/api/v1/kyc/bvn/full', { bvn });
const lookupPhone = (phone: string) =>
  callDojah('/api/v1/kyc/phone_number/basic', { phone_number: phone });
const validateCAC = async (cacUrl: string) => {
  const response = await callDojah('/api/v1/document/analysis/business_document', { input_type: 'url', input_value: cacUrl }, 'POST');

  if (!response.success) {
    return { valid: false, reason: response.message || 'CAC validation failed' };
  }

  // Check if the document is identified as a CAC certificate
  const entity = response.data?.entity;
  if (!entity) {
    return { valid: false, reason: 'No entity data returned from CAC validation' };
  }

  const documentType = entity.document_type;
  const result = entity.result;

  // Check if the result status is success
  const isSuccess = result?.status === 'success';

  // Assuming Dojah returns 'Business Registration Certificate' or similar for valid CAC documents
  const isCAC = documentType && (documentType.toLowerCase().includes('business') || documentType.toLowerCase().includes('registration') || documentType.toLowerCase().includes('certificate'));

  if (isSuccess && isCAC) {
    return { valid: true, lookupData: entity };
  } else {
    return {
      valid: false,
      reason: `Document not recognized as a valid CAC certificate (detected: ${documentType || 'unknown'}, status: ${result?.status || 'unknown'})`,
      lookupData: entity
    };
  }
};



/**
 * Normalize string for comparison (trim, lowercase, remove extra spaces)
 */
const normalizeString = (str: string | undefined): string => {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Check if names match (allows partial matches for compound names)
 */
const namesMatch = (name1: string | undefined, name2: string | undefined): boolean => {
  const n1 = normalizeString(name1);
  const n2 = normalizeString(name2);
  
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  
  // Check if one is contained in the other (for compound names)
  return n1.includes(n2) || n2.includes(n1);
};

/**
 * Validate NIN by looking up info and comparing with vendor data
 */
const validateNINWithLookup = async (
  nin: string,
  vendorFullName: string,
  vendorPhone?: string
): Promise<{ valid: boolean; reason?: string; lookupData?: any }> => {
  try {
  const ninRes = await lookupNIN(nin);
  
  if (!ninRes.success) {
    return {
      valid: false,
      reason: ninRes.message || 'NIN lookup failed',
    };
  }

  const entity = ninRes.data?.entity;
  if (!entity) {
    return {
      valid: false,
      reason: 'No NIN data returned from lookup',
      lookupData: ninRes.data,
    };
  }

  // Extract names from NIN lookup response
  const firstName = entity.first_name || '';
  const middleName = entity.middle_name || '';
  const lastName = entity.last_name || '';
  
  // Construct full name from lookup
  const lookupFullName = [firstName, middleName, lastName]
    .filter(Boolean)
    .join(' ');

  // Compare names
  const vendorNameParts = normalizeString(vendorFullName).split(' ');
  const lookupNameParts = normalizeString(lookupFullName).split(' ');

  let nameMatchCount = 0;
  for (const vendorPart of vendorNameParts) {
    for (const lookupPart of lookupNameParts) {
      if (vendorPart === lookupPart && vendorPart.length > 1) {
        nameMatchCount++;
        break;
      }
    }
  }

  const nameMatches = nameMatchCount >= 2 || namesMatch(vendorFullName, lookupFullName);

  if (!nameMatches) {
    return {
      valid: false,
      reason: `NIN registered to "${lookupFullName}" does not match vendor name "${vendorFullName}"`,
      lookupData: entity,
    };
  }

  // Optional: Validate phone if both vendor phone and NIN phone are available
  if (vendorPhone && entity.phone_number) {
    const normalizePhone = (phone: string) => phone.replace(/\D/g, '').replace(/^234/, '0').replace(/^0+/, '');
    const ninPhone = normalizePhone(entity.phone_number);
    const vPhone = normalizePhone(vendorPhone);
    
    if (ninPhone && vPhone && ninPhone !== vPhone) {
      return {
        valid: false,
        reason: `Phone number on NIN (${entity.phone_number}) does not match vendor phone (${vendorPhone})`,
        lookupData: entity,
      };
    }
  }

  return {
    valid: true,
    lookupData: entity,
  };
  } catch (err: any) {
    console.error('NIN validation error:', err?.message || err);
    return { valid: false, reason: 'NIN lookup failed due to an error' };
  }
};

/**
 * Validate phone number by looking up info and comparing with vendor data
 */
const validatePhoneWithLookup = async (
  phone: string,
  vendorFullName: string
): Promise<{ valid: boolean; reason?: string; lookupData?: any }> => {
  try {
  const phoneRes = await lookupPhone(phone);
  
  if (!phoneRes.success) {
    return {
      valid: false,
      reason: phoneRes.message || 'Phone lookup failed',
    };
  }

  const entity = phoneRes.data?.entity;
  if (!entity) {
    return {
      valid: false,
      reason: 'No phone data returned from lookup',
      lookupData: phoneRes.data,
    };
  }

  // Extract names from lookup response
  const firstName = entity.first_name || '';
  const middleName = entity.middle_name || '';
  const lastName = entity.last_name || '';
  
  // Construct full name from lookup
  const lookupFullName = [firstName, middleName, lastName]
    .filter(Boolean)
    .join(' ');

  // Split vendor full name into parts for comparison
  const vendorNameParts = normalizeString(vendorFullName).split(' ');
  const lookupNameParts = normalizeString(lookupFullName).split(' ');

  // Check if at least 2 name parts match (to account for middle names, etc.)
  let matchCount = 0;
  for (const vendorPart of vendorNameParts) {
    for (const lookupPart of lookupNameParts) {
      if (vendorPart === lookupPart && vendorPart.length > 1) {
        matchCount++;
        break;
      }
    }
  }

  const isValid = matchCount >= 2 || namesMatch(vendorFullName, lookupFullName);

  if (!isValid) {
    return {
      valid: false,
      reason: `Phone number registered to "${lookupFullName}" does not match vendor name "${vendorFullName}"`,
      lookupData: entity,
    };
  }

  return {
    valid: true,
    lookupData: entity,
  };
   } catch (err: any) {
    console.error('Phone validation error:', err?.message || err);
    return { valid: false, reason: 'Phone lookup failed due to an error' };
  }
};

/**
 * Enhanced bank validation using BVN when available.
 */
const validateBankDetails = async (bankDetails: any): Promise<boolean> => {
  if (!bankDetails) return false;

  const hasAccount = !!bankDetails.accountNumber;
  const hasBankName = !!bankDetails.bankName;

  if (bankDetails.bvn) {
    try {
      const bvnRes = await validateBVN(bankDetails.bvn);

      if (!bvnRes.success) return false;

      const extractAccountNumber = (data: any): string | undefined =>
        data?.account_number ||
        data?.accountNumber ||
        data?.data?.account_number ||
        data?.data?.accountNumber ||
        data?.data?.response?.account_number;

      const returnedAccount = extractAccountNumber(bvnRes.data);
      if (returnedAccount && hasAccount) {
        const normalize = (s: any) => String(s).replace(/\D/g, '').replace(/^0+/, '');
        if (normalize(returnedAccount) !== normalize(bankDetails.accountNumber)) return false;
      }

      return true;
    } catch (err) {
      console.error('BVN validation failed:', err?.message || err);
      return false; // <- safe fallback
    }
  }

  return hasAccount && hasBankName;
};


/**
 * ✅ MAIN KYC Verification Handler
 */
export const verifyKYC = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) return { verified: false, reason: 'Vendor not found' };

  try {
    // 1️⃣ Run all verifications independently
    // Skip re-running external checks for fields already verified
    const checks = {
      nin: vendor.nin
        ? vendor.kycProgress?.nin?.status === 'verified'
          ? Promise.resolve({ valid: true, reason: vendor.kycProgress?.nin?.reason })
          : validateNINWithLookup(vendor.nin, vendor.fullLegalName || '', vendor.phone)
        : null,
      phone: vendor.phone
        ? vendor.kycProgress?.phone?.status === 'verified'
          ? Promise.resolve({ valid: true, reason: vendor.kycProgress?.phone?.reason })
          : validatePhoneWithLookup(vendor.phone, vendor.fullLegalName || '')
        : null,
      cac: vendor.verificationImages?.cacCertificate
        ? vendor.kycProgress?.cac?.status === 'verified'
          ? Promise.resolve({ valid: true, reason: vendor.kycProgress?.cac?.reason })
          : validateCAC(vendor.verificationImages.cacCertificate)
        : null,
      bank: vendor.bankDetails
        ? vendor.kycProgress?.bank?.status === 'verified'
          ? Promise.resolve({ valid: true, reason: vendor.kycProgress?.bank?.reason })
          : validateBankDetails(vendor.bankDetails)
        : null,
    };

    const results = await Promise.allSettled(Object.values(checks));

    const normalizedResults: ValidationResult[] = results.map((r) =>
      r.status === 'fulfilled'
        ? normalizeValidationResult(r.value)
        : ({
            valid: false,
            reason: (r.reason as Error)?.message || 'Validation error',
            lookupData: undefined,
          } as ValidationResult)
    );

    const [ninRes, phoneRes, cacRes, bankRes] = normalizedResults;

    const progress = {
      nin: {
        status: ninRes.valid ? 'verified' : 'failed',
        reason: ninRes.reason,
      },
      phone: {
        status: phoneRes.valid ? 'verified' : 'failed',
        reason: phoneRes.reason,
      },
      cac: {
        status: cacRes.valid ? 'verified' : 'failed',
        reason: cacRes.reason,
      },
      bank: {
        status: bankRes.valid ? 'verified' : 'failed',
        reason: bankRes.reason,
      },
    };

    // 2️⃣ Compute overall status
    const allVerified = Object.values(progress).every((p) => p.status === 'verified');
    const anyFailed = Object.values(progress).some((p) => p.status === 'failed');

    const overallStatus = allVerified
      ? 'verified'
      : anyFailed
      ? 'partially_verified'
      : 'in_progress';

    // 3️⃣ Persist progress
    await Vendor.findByIdAndUpdate(vendorId, {
      kycStatus: overallStatus,
      kycProgress: progress,
    });

    logger.info('KYC verification completed', {
      vendorId,
      overallStatus,
      progress,
    });

    // 4️⃣ Return the result
    return {
      verified: allVerified,
      overallStatus,
      progress,
    };
  } catch (error: any) {
    logger.error('KYC verification error', {
      vendorId,
      message: error.message,
      stack: error.stack,
    });
    return {
      verified: false,
      reason: error.message || 'KYC verification failure',
    };
  }
};

