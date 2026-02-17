import TransactionModel, { ITransaction } from "../models/Transaction.model";
import UserModel, { IUser } from "../models/User.model";
import VendorModel from "../models/Vendor.model";
import { initiatePaystackTransfer,createPaystackTransferRecipient,fetchPaystackBankList, initiatePaystackPayment, TX, initiatePaystackRefund } from "../utils/payment";
import { CustomError, NotFoundError, ValidationError } from "../utils/customError";
import { BookingService } from "./booking.service";
import mongoose from "mongoose";

export const processPayment = async (
  amount: number,
  userId: string,
  bookingId?: string
) => {
  try {
    const user = await UserModel.findById(userId) as IUser | null;
    if (!user) throw new NotFoundError('User not found');

    const reference = TX();

    // Initiate Paystack payment
    const paymentResponse = await initiatePaystackPayment({
      amount,
      email: user.email!,
      reference,
      callback_url: "https://dinero-rent-pifk.vercel.app",
      metadata: {
        userId: (user._id as mongoose.Types.ObjectId).toString(),
        purpose: "booking_payment",
        bookingId,
      },
    });

    // If bookingId is provided, fetch booking to get createdBy info
   let createdById: mongoose.Types.ObjectId | null = null;

    if (bookingId) {
      const booking = await BookingService.getBookingById(bookingId);
      if (!booking) throw new NotFoundError('Booking not found');
      createdById = booking.createdBy?._id || null;
    }
    // Check if Paystack response is valid (has authorization_url)
    const response = paymentResponse as any;
    if (!response || !response.data?.authorization_url) {
      await TransactionModel.create({
        userId: user._id,
        createdBy: createdById,
        amount,
        currency: "NGN",
        reference,
        status: 'failed',
        type: 'booking',
        paymentMethod: response?.data?.channel|| 'paystack',
        description: `Payment for booking ${bookingId || ''}`,
        transactionLink: '',
        metadata: { bookingId },
      });
      throw new CustomError(`Payment initiation failed: ${response?.message || 'Invalid Paystack response'}`);
    }

    const paymentMethod =
  Array.isArray(response.data?.channel) 
    ? response.data.channel.join(', ') 
    : 'paystack';

    // Create transaction record
    const transaction = await TransactionModel.create({
      userId: user._id,
      amount,
      createdBy: createdById,
      currency: "NGN",
      reference,
      status: 'pending',
      type: 'booking',
      paymentMethod,
      description: `Payment for booking ${bookingId || ''}`,
      transactionLink: response.data.authorization_url,
      metadata: { bookingId },
    }) as ITransaction;

    return {
      success: true,
      transactionId: (transaction._id as mongoose.Types.ObjectId).toString(),
      paymentLink: response.data.authorization_url,
      transaction,
    };
  } catch (error: any) {
    console.error('Payment processing error:', error);
    return { success: false, error: error.message };
  }
};

let cachedBanks: Array<{ name: string; code: string }> | null = null;

const getCachedBanks = async (): Promise<Array<{ name: string; code: string }>> => {
  if (cachedBanks !== null) {
    return cachedBanks;
  }
  
  const banksResponse: any = await fetchPaystackBankList();
  if (!banksResponse?.data?.status || !banksResponse?.data?.data) {
    throw new CustomError('Unable to fetch Paystack bank list');
  }
  
  const banks = banksResponse.data.data as Array<{ name: string; code: string }>;
  cachedBanks = banks;
  return banks;
};

export const createPaystackRecipient = async (vendor: any): Promise<string> => {
  if (!vendor?.bankDetails?.accountNumber || !vendor?.bankDetails?.bankName) {
    throw new ValidationError('Vendor bank details are incomplete');
  }

  try {
    // Step 1: Fetch Paystack bank list (cache for efficiency)
    const banks = await getCachedBanks();

    const bank = banks.find(
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
    ) as any;

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
    ) as any;
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
    ) as any;

    if (!response.data.status) {
      return { success: false, error: response.data.message };
    }

    return { success: true, data: response.data.data };
  } catch (error: any) {
    console.error('[Refund] Paystack refund failed:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};
