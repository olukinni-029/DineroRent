import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

export interface FlutterwavePaymentData {
  amount: number;
  tx_ref: string;
  currency: string;
  redirect_url: string;
  customer: {
    email: string;
    phone_number: string;
    name: string;
  };
  customizations: {
    title: string;
    logo: string;
  };
  configuration: {
    session_duration: number;
  };
  max_retry_attempt: number;
  payment_options: string;
  meta: {
    userId: string;
    purpose: string;
    bookingId?: string;
  };
}

export const initiateFlutterwavePayment = async (data: FlutterwavePaymentData) => {
  try {
    const response = await axios.post(`${FLUTTERWAVE_BASE_URL}/payments`, data, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Flutterwave payment initiation error:', error);
    throw new Error('Failed to initiate payment');
  }
};

export const verifyFlutterwavePayment = async (transactionId: string) => {
  try {
    const response = await axios.get(`${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Flutterwave payment verification error:', error);
    throw new Error('Failed to verify payment');
  }
};

export const TX = (prefix: string = 'TX') => `${prefix}-${uuidv4()}`;
export const WALLET = (prefix: string = 'WALLET') => `${prefix}-${uuidv4()}`;
