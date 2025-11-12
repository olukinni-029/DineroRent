import Vendor from '../models/Vendor.model';
import { ninVerification } from '../utils/common/NinVerification'; 

export const verifyKYC = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    return { verified: false, reason: 'Vendor not found' };
  }

  let ninValid = true;
  let cacValid = true;
  let ownershipValid = true;
  let failedReason = '';

  try {
    // 1️⃣ Validate NIN via YouVerify API
    if (vendor.nin) {
      const ninResult = await ninVerification(vendor.nin);
      if (!ninResult?.success && !ninResult?.data?.id) {
        ninValid = false;
        failedReason = ninResult?.message || 'Invalid NIN';
      }
    }

    // 2️⃣ Validate CAC certificate (placeholder)
    if (vendor.cacCertificate) {
      cacValid = await validateCAC(vendor.cacCertificate);
      if (!cacValid) failedReason = 'Invalid CAC Certificate';
    }

    // 3️⃣ Validate ownership proof (manual)
    if (vendor.ownershipProof) {
      ownershipValid = await validateOwnership(vendor.ownershipProof);
      if (!ownershipValid) failedReason = 'Invalid Ownership Proof';
    }

    // 4️⃣ Combine results
    const verified = ninValid && ownershipValid;
    return {
      verified,
      ninVerified: ninValid,
      cacVerified: cacValid,
      ownershipVerified: ownershipValid,
      reason: verified ? 'All checks passed' : failedReason,
    };
  } catch (error: any) {
    console.error('KYC verification error:', error);
    return {
      verified: false,
      reason: error.message || 'KYC verification failed',
    };
  }
};

// Placeholder for CAC and ownership verification
const validateCAC = async (cac: string): Promise<boolean> => {
  // Future: integrate CAC verification API
  return !!cac;
};

const validateOwnership = async (ownership: string): Promise<boolean> => {
  // Manual verification — mark pending for admin review
  return !!ownership;
};
