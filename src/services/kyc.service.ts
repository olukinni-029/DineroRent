import dotenv from 'dotenv';
dotenv.config();
import Vendor from '../models/Vendor.model';
import { restClientWithHeaders } from '../utils/common/restclient';
import logger from '../utils/logger';

const baseUrl = 'https://api.dojah.io';
const DOJAH_APP_ID = process.env.DOJAH_APP_ID!;
const DOJAH_SECRET_KEY = process.env.DOJAH_SECRET_KEY!;

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
        'GET',
        `${baseUrl}${endpoint}`,
        payload,
        {
          AppId: DOJAH_APP_ID,
          Authorization: DOJAH_SECRET_KEY,
          'Content-Type': 'application/json',
        }
      );
      return { success: true, data: response.data };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const message =
    lastError?.response?.data?.message ||
    lastError?.response?.data?.error ||
    lastError?.message ||
    'Unknown error occurred';

  return { success: false, message, raw: lastError?.response?.data };
};

/**
 * Dojah API Validators
 */
const validateNIN = (nin: string) => callDojah('/api/v1/kyc/nin', { nin });
const validateBVN = (bvn: string) => callDojah('/api/v1/kyc/bvn/full', { bvn });
const validatePhone = (phone: string) =>
  callDojah('/api/v1/kyc/phone_number/basic', { phone_number: phone });
const validateCAC = (cac: string) =>
  callDojah('/api/v1/document/analysis/business_document', { rc_number: cac });

/**
 * Local Validators
 */
const validateOwnership = async (ownership: string): Promise<boolean> => !!ownership;
const validateImages = async (images: string[]): Promise<boolean> =>
  images.every(img => !!img && typeof img === 'string');

/**
 * Enhanced bank validation using BVN when available.
 */
const validateBankDetails = async (bank: any): Promise<boolean> => {
  if (!bank) return false;
  const hasAccount = !!bank.accountNumber;
  const hasBankName = !!bank.bankName;

  if (bank.bvn) {
    const bvnRes = await validateBVN(bank.bvn);
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
      if (normalize(returnedAccount) !== normalize(bank.accountNumber)) return false;
    }

    return true;
  }

  return hasAccount && hasBankName;
};

/**
 * ✅ MAIN KYC Verification Handler (new version)
 */
export const verifyKYC = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) return { verified: false, reason: 'Vendor not found' };

  const failedReasons: string[] = [];

  // Core info validation
  const fullLegalNameValid =
    vendor.fullLegalName?.trim() &&
    vendor.fullLegalName.trim().length >= 2 &&
    vendor.fullLegalName.trim().length <= 100;
  if (!fullLegalNameValid)
    failedReasons.push('Full legal name must be between 2 and 100 characters');

  let ninValid = false;
  let cacValid = true;
  let phoneValid = true;
  let ownershipValid = true;
  let idCardValid = true;
  let businessNameValid = true;
  let addressValid = true;
  let imagesValid = true;
  let bankDetailsValid = true;
  let bioValid = true;

  try {
    // === 1. NIN (Required) ===
    if (!vendor.nin) {
      failedReasons.push('NIN is required');
    } else {
      const ninRes = await validateNIN(vendor.nin);
      ninValid = !!ninRes.success;
      if (!ninValid) failedReasons.push(ninRes.message || 'Invalid NIN');
    }

    // === 2. Extract verification images (new model) ===
    const imagesData = vendor.verificationImages || {};

    // ID Card (required)
    if (!imagesData.idCard) {
      idCardValid = false;
      failedReasons.push('Government-issued ID image is required');
    } else {
      idCardValid = await validateImages([imagesData.idCard]);
      if (!idCardValid) failedReasons.push('Invalid or missing ID image');
    }

    // Ownership proof (required)
    if (!imagesData.ownershipProof) {
      ownershipValid = false;
      failedReasons.push('Ownership proof is required');
    } else {
      ownershipValid = await validateOwnership(imagesData.ownershipProof);
      if (!ownershipValid) failedReasons.push('Invalid ownership proof');
    }

    // CAC Certificate (optional)
    if (imagesData.cacCertificate) {
      const cacRes = await validateCAC(imagesData.cacCertificate);
      cacValid = !!cacRes.success;
      if (!cacValid) failedReasons.push(cacRes.message || 'Invalid CAC certificate');
    }

    // === 3. Optional Phone ===
    if (vendor.phone) {
      const phoneRes = await validatePhone(vendor.phone);
      phoneValid = !!phoneRes.success;
      if (!phoneValid) failedReasons.push(phoneRes.message || 'Invalid phone number');
    }

    // === 4. Optional Business Name ===
    if (vendor.businessName && vendor.businessName.trim().length < 2) {
      businessNameValid = false;
      failedReasons.push('Business name must be at least 2 characters');
    }

    // === 5. Optional General Images ===
    if (vendor.images?.length > 0) {
      imagesValid = await validateImages(vendor.images);
      if (!imagesValid) failedReasons.push('Invalid property/vehicle images');
    }

    // === 6. Address (Required) ===
    addressValid =
      vendor.address?.trim() &&
      vendor.address.trim().length >= 5 &&
      vendor.address.trim().length <= 500;
    if (!addressValid)
      failedReasons.push('Address must be between 5 and 500 characters');

    // === 7. Optional Bank Details (BVN preferred) ===
    if (vendor.bankDetails) {
      bankDetailsValid = await validateBankDetails(vendor.bankDetails);
      if (!bankDetailsValid) failedReasons.push('Invalid bank details');
    }

    // === 8. Optional Bio ===
    if (vendor.bio && vendor.bio.trim().length < 10) {
      bioValid = false;
      failedReasons.push('Bio must be at least 10 characters if provided');
    }

    // === 9. Final Verification Decision ===
    const verified =
      !!fullLegalNameValid &&
      !!ninValid &&
      !!idCardValid &&
      !!ownershipValid &&
      !!addressValid;

    return {
      verified,
      fullLegalNameVerified: !!fullLegalNameValid,
      ninVerified: !!ninValid,
      idCardVerified: !!idCardValid,
      ownershipVerified: !!ownershipValid,
      cacVerified: !!cacValid,
      phoneVerified: !!phoneValid,
      businessNameVerified: !!businessNameValid,
      imagesVerified: !!imagesValid,
      addressVerified: !!addressValid,
      bankDetailsVerified: !!bankDetailsValid,
      bioVerified: !!bioValid,
      reason: verified
        ? 'All required KYC checks passed'
        : failedReasons.join('; '),
    };
  } catch (error: any) {
    logger.error('KYC verification error:', {
      vendorId,
      error: error.message,
      stack: error.stack,
    });
    return {
      verified: false,
      reason: error.message || 'KYC verification failure',
    };
  }
};
