import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

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

    const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, payload, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
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
    const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Paystack payment verification error:', error);
    throw new Error('Failed to verify payment');
  }
};

/**
 * Helper functions to generate unique references
 */
export const TX = (prefix: string = 'TX') => `${prefix}-${uuidv4()}`;
export const WALLET = (prefix: string = 'WALLET') => `${prefix}-${uuidv4()}`;
