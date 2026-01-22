import { restClientWithHeaders } from "../utils/common/restclient";
import { v4 as uuidv4 } from 'uuid';

const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
  throw new Error('PAYSTACK_SECRET_KEY environment variable is not set');
}

export interface PaystackPaymentData {
  amount: number; // amount in Naira (will be converted to kobo)
  email: string;
  reference?: string;
  currency?: string;
  callback_url?: string;
  metadata?: {
  userId: string;
  purpose: string;
  bookingId?: string;
  paymentMethod?: string;
};
}

/**
 * Initiates a Paystack payment
 */
export const initiatePaystackPayment = async (data: PaystackPaymentData) => {
  try {
    const payload = {
      amount: data.amount * 100, // Paystack expects amount in kobo
      email: data.email,
      reference: data.reference || TX(),
      currency: data.currency || 'NGN',
      callback_url: data.callback_url,
      metadata: data.metadata,
    };

    const response = await restClientWithHeaders('POST',`${PAYSTACK_BASE_URL}/transaction/initialize`, payload, {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
    });
    return response.data;
  } catch (error) {
    console.error('Paystack payment initiation error:', error);
    throw new Error('Failed to initiate payment');
  }
};

/**
 * Verifies a Paystack payment
 */
export const verifyPaystackPayment = async (reference: string) => {
  try {
    const response = await restClientWithHeaders('GET',`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
    });

    return response.data;
  } catch (error) {
    console.error('Paystack payment verification error:', error);
    throw new Error('Failed to verify payment');
  }
};

export const fetchPaystackBankList = async () => {
  try {
    const response = await restClientWithHeaders(
      'GET',
      `${PAYSTACK_BASE_URL}/bank`,
      {},
      {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching Paystack bank list:', error);
    throw new Error('Failed to fetch bank list');
  }
};

export const createPaystackTransferRecipient = async (
  name: string,
  accountNumber: string,
  bankCode: string,
) => {
  try {
    const payload = {
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    };
    const response = await restClientWithHeaders(
      'POST',
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      payload,
      {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    );
    return response.data;
  } catch (error) {
    console.error('Paystack transfer recipient creation error:', error);
    throw new Error('Failed to create transfer recipient');
  }
};

export const initiatePaystackTransfer = async (
  amount: number,
  recipientCode: string,
  reason: string
) => {
  try {
    const payload = {
      source: 'balance',
      amount,
      recipient: recipientCode,
      reason,
    };
    const response = await restClientWithHeaders(
      'POST',
      `${PAYSTACK_BASE_URL}/transfer`,
      payload,
      {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    );
    return response.data;
  }
  catch (error) {
    console.error('Paystack transfer initiation error:', error);
    throw new Error('Failed to initiate transfer');
  }
};

export const initiatePaystackRefund = async (
  amount: number,
  transactionReference: string,
  reason: string
) => {
  try {
    const payload = {
      amount,
      transaction: transactionReference,
      customer_note: reason,
    };
    const response = await restClientWithHeaders(
      'POST',
      `${PAYSTACK_BASE_URL}/refund`,
      payload,
      {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    );
    return response.data;
  } catch (error) {
    console.error('Paystack refund initiation error:', error);
    throw new Error('Failed to initiate refund');
  }
};

/**
 * Helper functions to generate unique references
 */
export const TX = (prefix: string = 'TX') => `${prefix}-${uuidv4()}`;
export const WALLET = (prefix: string = 'WALLET') => `${prefix}-${uuidv4()}`;
