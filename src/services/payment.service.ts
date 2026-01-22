import TransactionModel from "../models/Transaction.model";
import UserModel from "../models/User.model";
import VendorModel from "../models/Vendor.model";
import { initiatePaystackTransfer,createPaystackTransferRecipient,fetchPaystackBankList, initiatePaystackPayment, TX, initiatePaystackRefund } from "../utils/payment";
import { CustomError, NotFoundError, ValidationError } from "../utils/customError";

export const processPayment = async (
  amount: number,
  userId: string,
  bookingId?: string
) => {
  try {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError('User not found');

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
      throw new CustomError('Payment initiation failed');
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
    throw new ValidationError('Vendor bank details are incomplete');
  }

  try {
    // Step 1: Fetch Paystack bank list (cache for efficiency)
    if (!cachedBanks) {
      const banksResponse = await fetchPaystackBankList();

      if (!banksResponse?.data?.status || !banksResponse?.data?.data) {
        throw new CustomError('Unable to fetch Paystack bank list');
      }

      cachedBanks = banksResponse.data.data;
    }

    const bank = cachedBanks.find(
      (b) => b.name.toLowerCase() === vendor.bankDetails.bankName.toLowerCase()
    );

    if (!bank) {
      throw new ValidationError(`Bank not supported by Paystack: ${vendor.bankDetails.bankName}`);
    }

    // Step 2: Create Paystack transfer recipient
    const recipientResponse = await createPaystackTransferRecipient(
      vendor.businessName || vendor.fullLegalName || 'Vendor',
      vendor.bankDetails.accountNumber,
      bank.code
    );

    if (!recipientResponse?.data?.status) {
      throw new CustomError(recipientResponse.data?.message || 'Failed to create Paystack recipient');
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
    throw new CustomError(
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
    const transferResponse = await initiatePaystackTransfer(
      amount,
      recipientCode,
      reason
    );
    if (!transferResponse?.data?.status) {
      throw new CustomError(transferResponse.data?.message || 'Transfer initiation failed');
    }
    return { success: true, transfer: transferResponse.data.data };
  } catch (error: any) {
    console.error('Transfer processing error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

export const processRefund = async ({
  amount,
  reference,
  reason,
}: {
  amount: number;
  reference: string;
  reason: string;
}) => {
  try {
    const response = await initiatePaystackRefund(
      amount,
      reference,
      reason
    );

    if (!response.data.status) {
      return { success: false, error: response.data.message };
    }

    return { success: true, data: response.data.data };
  } catch (error: any) {
    console.error('[Refund] Paystack refund failed:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};