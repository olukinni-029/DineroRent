import axios from 'axios';

const UVERIF_NIN_API_URL = 'https://api.youverify.co/v2/api/identity/ng/nin';
const UVERIF_API_TOKEN = process.env.YOUVERIFY_API_KEY || "your_default_api_key";

interface NinVerificationPayload {
  id: string; // NIN
  isSubjectConsent: boolean;
  validation?: {
    data?: {
      lastName?: string;
      firstName?: string;
      dateOfBirth?: string;
      mobile?:string;
    };
    selfie?: {
      image?: string; // Base64 encoded image
    };
  };
  metadata?: Record<string, any>;
}

export const ninVerification = async (nin: string) => {
  try {
    const payload: NinVerificationPayload = {
      id: nin,
      isSubjectConsent: true,
    };

    const response = await axios.post(
      UVERIF_NIN_API_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          token: UVERIF_API_TOKEN,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error verifying NIN:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'NIN verification failed',
      status: error.response?.status || 500,
      error: error.response?.data || error.message,
    };
  }
};