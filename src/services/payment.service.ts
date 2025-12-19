import TransactionModel from "../models/Transaction.model";
import UserModel from "../models/User.model";
import { initiatePaystackPayment, TX } from "../utils/payment";

export const processPayment = async (
  amount: number,
  paymentMethod: string,
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
        paymentMethod,
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
        paymentMethod,
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
      paymentMethod,
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
