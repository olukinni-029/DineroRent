import dotenv from 'dotenv';
dotenv.config();
import Vendor from '../models/Vendor.model';
import { restClientWithHeaders } from '../utils/common/restclient';
import logger from '../utils/logger';

const baseUrl = 'https://api.dojah.io';
const DOJAH_APP_ID = process.env.DOJAH_APP_ID!;
const DOJAH_SECRET_KEY = process.env.DOJAH_SECRET_KEY!;

// Validate required environment variables
if (!DOJAH_APP_ID || !DOJAH_SECRET_KEY) {
  throw new Error('DOJAH_APP_ID and DOJAH_SECRET_KEY environment variables are required');
}

/**
 * Generic Dojah HTTP Caller with retry mechanism
 */
const callDojah = async (endpoint: string, payload: Record<string, any>, maxRetries = 3) => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await restClientWithHeaders(
        'POST',
        `${baseUrl}${endpoint}`,
        payload,
        {
          AppId: DOJAH_APP_ID,
          Authorization: DOJAH_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      );

      return { success: true, data: response.data };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        // Exponential backoff: wait 2^attempt seconds
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  let errorMessage = 'Unknown error occurred';
  if (lastError?.response?.data?.message) {
    errorMessage = lastError.response.data.message;
  } else if (lastError?.response?.data?.error) {
    errorMessage = lastError.response.data.error;
  } else if (lastError?.message) {
    errorMessage = lastError.message;
  } else if (typeof lastError === 'string') {
    errorMessage = lastError;
  }
  return {
    success: false,
    message: errorMessage,
    raw: lastError?.response?.data
  };
};

/**
 * Dojah API: Validators
 */
const validateNIN = (nin: string) =>
  callDojah('/api/v1/kyc/nin/advance', { nin });

const validateBVN = (bvn: string) =>
  callDojah('/api/v1/kyc/bvn/advance', { bvn });

const validatePhone = (phone: string) =>
  callDojah('/api/v1/kyc/phone_number/basic', { phone_number: phone });

const validateCAC = (cac: string) =>
  callDojah('/api/v1/kyc/cac/advance', { rc_number: cac });

/**
 * Local Validators
 */
const validateOwnership = async (ownership: string): Promise<boolean> =>
  !!ownership; // why: required proof

const validateImages = async (images: string[]): Promise<boolean> =>
  images.every((img) => !!img); // why: must contain valid URL strings

/**
 * Enhanced bank validation using BVN when available.
 *
 * Behavior:
 * - If bank.bvn present -> call Dojah BVN advance
 *   - If Dojah returns success => consider bank valid
 *   - If Dojah includes an account number, and vendor provided accountNumber -> ensure they match
 * - If bank.bvn absent -> fallback to minimal checks (accountNumber & bankName)
 */
const validateBankDetails = async (bank: any): Promise<boolean> => {
  if (!bank) return false;

  // minimal presence checks
  const hasAccount = !!bank.accountNumber;
  const hasBankName = !!bank.bankName;

  // if BVN is provided, prefer BVN verification
  if (bank.bvn) {
    const bvnRes = await validateBVN(bank.bvn);
    if (!bvnRes.success) return false;

    // try to extract account number from various possible response shapes
    const extractAccountNumber = (data: any): string | undefined => {
      if (!data) return undefined;
      // common possible paths: data.account_number, data.data.account_number, data.data.accountNumber
      return (
        data.account_number ||
        data.accountNumber ||
        data.data?.account_number ||
        data.data?.accountNumber ||
        data?.data?.response?.account_number // defensive
      );
    };

    const returnedAccount = extractAccountNumber(bvnRes.data);
    // if vendor provided accountNumber, and dojah returned one, ensure match
    if (returnedAccount && typeof returnedAccount === 'string' && returnedAccount.trim().length > 0 && hasAccount) {
      // normalize numeric strings (strip non-digits)
      const normalize = (s: any) =>
        String(s).replace(/\D/g, '').replace(/^0+/, '');
      if (normalize(returnedAccount) !== normalize(bank.accountNumber)) {
        return false;
      }
    }

    // If Dojah success and either matched or no account to compare, accept bank details
    return true;
  }

  // fallback: require at least account number and bank name
  return hasAccount && hasBankName;
};

/**
 * MAIN KYC Verification Handler
 */
export const verifyKYC = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) return { verified: false, reason: 'Vendor not found' };

  let failedReasons: string[] = [];

  const fullLegalNameValid = vendor.fullLegalName?.trim() && vendor.fullLegalName.trim().length >= 2 && vendor.fullLegalName.trim().length <= 100;
  if (!fullLegalNameValid) failedReasons.push('Full legal name must be between 2 and 100 characters');

  let ninValid = false;
  let cacValid = true;
  let phoneValid = true;
  let ownershipValid = true;
  let businessNameValid = true;
  let addressValid = true;
  let imagesValid = true;
  let bankDetailsValid = true;
  let bioValid = true;

  try {
    // NIN — REQUIRED
    if (!vendor.nin) {
      ninValid = false;
      failedReasons.push('NIN is required');
    } else {
      const ninRes = await validateNIN(vendor.nin);
      ninValid = !!ninRes.success;
      if (!ninValid) failedReasons.push(ninRes.message || 'Invalid NIN');
    }

    // CAC — OPTIONAL
    if (vendor.cacCertificate) {
      const cacRes = await validateCAC(vendor.cacCertificate);
      cacValid = !!cacRes.success;
      if (!cacValid) failedReasons.push(cacRes.message || 'Invalid CAC Certificate');
    }

    // Phone — OPTIONAL
    if (vendor.phone) {
      const phoneRes = await validatePhone(vendor.phone);
      phoneValid = !!phoneRes.success;
      if (!phoneValid) failedReasons.push(phoneRes.message || 'Invalid phone number');
    }

    // Ownership — REQUIRED
    ownershipValid = await validateOwnership(vendor.ownershipProof);
    if (!ownershipValid) failedReasons.push('Ownership proof is required');

    // Business name — optional but validate length
    if (vendor.businessName && vendor.businessName.trim().length < 2) {
      businessNameValid = false;
      failedReasons.push('Business name must be at least 2 characters');
    }

    // Images — optional
    if (vendor.images?.length > 0) {
      imagesValid = await validateImages(vendor.images);
      if (!imagesValid) failedReasons.push('Invalid property/vehicle images');
    }

    // Address — REQUIRED
    addressValid = vendor.address?.trim() && vendor.address.trim().length >= 5 && vendor.address.trim().length <= 500;
    if (!addressValid) failedReasons.push('Address must be between 5 and 500 characters');

    // Bank — optional but now uses BVN if provided
    if (vendor.bankDetails) {
      bankDetailsValid = await validateBankDetails(vendor.bankDetails);
      if (!bankDetailsValid) failedReasons.push('Invalid bank details');
    }

    // Bio — optional
    if (vendor.bio && vendor.bio.trim().length < 10) {
      bioValid = false;
      failedReasons.push('Bio must be at least 10 characters if provided');
    }

    const verified =
      fullLegalNameValid &&
      ninValid &&
      ownershipValid &&
      addressValid;

    return {
      verified,
      fullLegalNameVerified: fullLegalNameValid,
      ninVerified: ninValid,
      phoneVerified: phoneValid,
      businessNameVerified: businessNameValid,
      cacVerified: cacValid,
      ownershipVerified: ownershipValid,
      imagesVerified: imagesValid,
      addressVerified: addressValid,
      bankDetailsVerified: bankDetailsValid,
      bioVerified: bioValid,
      reason: verified ? 'All required checks passed' : failedReasons.join('; ')
    };
  } catch (error: any) {
    logger.error('KYC verification error:', { vendorId, error: error.message, stack: error.stack });
    return {
      verified: false,
      reason: error.message || 'KYC verification failure'
    };
  }
};
