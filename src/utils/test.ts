import dotenv from 'dotenv';
dotenv.config();
import { restClientWithHeaders } from "./common/restclient";
import logger from "./logger";

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
  maxRetries = 3
): Promise<DojahResponse> => {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await restClientWithHeaders('GET', `${baseUrl}${endpoint}`, payload, {
        AppId: DOJAH_APP_ID,
        Authorization: DOJAH_SECRET_KEY,
        'Content-Type': 'application/json',
      });
      return { success: true, data: response };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const statusCode = lastError?.response?.status;
  const message =
    lastError?.response?.data?.message ||
    lastError?.response?.data?.error ||
    (statusCode === 404
      ? `Dojah: Resource not found at ${endpoint}`
      : `Dojah API error (${endpoint}): ${lastError?.message || 'Unknown error'}`);


  return { success: false, message, raw: lastError?.response?.data };
};




const lookupPhoneNumber = async (bvn: string): Promise<DojahResponse> => {
  if (!bvn) {
    return { success: false, message: 'Phone number is required' };
  }

  try {
    // Use query parameters for GET request
    const endpoint = `/api/v1/kyc/bvn/advance?bvn=${encodeURIComponent(bvn)}`;
    const res = await callDojah(endpoint, {});

    // Handle Dojah service unavailable (424) gracefully
    if (!res.success && res.raw?.error === 'Service not Reachable') {
      logger.warn(`Dojah phone KYC service unavailable for ${bvn}`);
      return { success: false, message: 'Phone KYC service temporarily unavailable', raw: res.raw };
    }

    // If no entity returned
    if (res.success && !res.data?.entity) {
      return { success: false, message: 'No phone data returned from lookup', raw: res.data };
    }

    return res;
  } catch (err: any) {
    logger.error('Phone lookup error', { bvn, error: err.message, stack: err.stack });
    return { success: false, message: 'Phone lookup failed', raw: err };
  }
};

const runNinLookup = async () => {
const result = await lookupPhoneNumber('22330640183');
if (!result.success) {
  console.log('Phone lookup failed:', result.message);
} else {
  console.log('Phone lookup data:', result.data.entity);
}
};

// Uncomment to run test
runNinLookup();
