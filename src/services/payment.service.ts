import TransactionModel from "../models/Transaction.model";
import UserModel from "../models/User.model";
import VendorModel from "../models/Vendor.model";
import { restClientWithHeaders } from "../utils/common/restclient";
import { initiatePaystackPayment, TX } from "../utils/payment";

const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || '';

export const processPayment = async (
  amount: number,
  userId: string,
  bookingId?: string
) => {
  try {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');

    const reference = TX();

    // Initiate Paystack payment
    const paymentResponse = await initiatePaystackPayment({
      amount,
      email: user.email!,
      reference,
      callback_url: "https://sociafyapp.vercel.app/dashboard",
      metadata: {
        userId: user._id.toString(),
        purpose: "booking_payment",
        bookingId,
      },
    });

    if (paymentResponse.status !== true) {
      await TransactionModel.create({
        userId: user._id,
        amount,
        currency: "NGN",
        reference,
        status: 'failed',
        type: 'booking',
        description: `Payment for booking ${bookingId || ''}`,
        transactionLink: '',
        metadata: { bookingId },
      });
      throw new Error('Payment initiation failed');
    }

    // Create transaction record
    const transaction = await TransactionModel.create({
      userId: user._id,
      amount,
      currency: "NGN",
      reference,
      status: 'pending',
      type: 'booking',
      description: `Payment for booking ${bookingId || ''}`,
      transactionLink: paymentResponse.data.authorization_url,
      metadata: { bookingId },
    });

    return {
      success: true,
      transactionId: transaction._id.toString(),
      paymentLink: paymentResponse.data.authorization_url,
      transaction,
    };
  } catch (error: any) {
    console.error('Payment processing error:', error);
    return { success: false, error: error.message };
  }
};

let cachedBanks: Array<{ name: string; code: string }> | null = null;

export const createPaystackRecipient = async (vendor: any): Promise<string> => {
  if (!vendor?.bankDetails?.accountNumber || !vendor?.bankDetails?.bankName) {
    throw new Error('Vendor bank details are incomplete');
  }

  try {
    // Step 1: Fetch Paystack bank list (cache for efficiency)
    if (!cachedBanks) {
      const banksResponse = await restClientWithHeaders(
        'GET',
        `${PAYSTACK_BASE_URL}/bank`,
        undefined,
        { Authorization: `Bearer ${PAYSTACK_SECRET}` }
      );

      if (!banksResponse?.data?.status || !banksResponse?.data?.data) {
        throw new Error('Unable to fetch Paystack bank list');
      }

      cachedBanks = banksResponse.data.data;
    }

    const bank = cachedBanks.find(
      (b) => b.name.toLowerCase() === vendor.bankDetails.bankName.toLowerCase()
    );

    if (!bank) {
      throw new Error(`Bank not supported by Paystack: ${vendor.bankDetails.bankName}`);
    }

    // Step 2: Create Paystack transfer recipient
    const recipientResponse = await restClientWithHeaders(
      'POST',
      `${PAYSTACK_BASE_URL}/transferrecipient`,
      {
        type: 'nuban',
        name: vendor.fullLegalName || `${vendor.firstName} ${vendor.lastName}`,
        account_number: vendor.bankDetails.accountNumber,
        bank_code: bank.code,
        currency: 'NGN',
      },
      {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      }
    );

    if (!recipientResponse?.data?.status) {
      throw new Error(recipientResponse.data?.message || 'Failed to create Paystack recipient');
    }

    const recipientCode = recipientResponse.data.data.recipient_code;

    // Step 3: Persist recipient code to vendor record
    if (vendor._id) {
      await VendorModel.findByIdAndUpdate(vendor._id, {
        paystackRecipientCode: recipientCode,
      });
    }

    return recipientCode;
  } catch (error: any) {
    console.error('Error creating Paystack recipient:', error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || error.message || 'Paystack recipient creation failed'
    );
  }
};

export const processTransfer = async (
  amount: number,
  recipientCode: string,
  reason: string
) => {
  try {
    const transferResponse = await restClientWithHeaders(
      'POST',
      `${PAYSTACK_BASE_URL}/transfer`,
      {
        source: 'balance',
        amount,
        recipient: recipientCode,
        reason,
      },
      {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      }
    );
    if (!transferResponse?.data?.status) {
      throw new Error(transferResponse.data?.message || 'Transfer initiation failed');
    }
    return { success: true, transfer: transferResponse.data.data };
  } catch (error: any) {
    console.error('Transfer processing error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};