import { initiateFlutterwavePayment, TX } from '../utils/flutterwave';
import TransactionModel from '../models/Transaction.model';
import UserModel from '../models/User.model';

export const processPayment = async (amount: number, paymentMethod: string, userId: string, bookingId?: string) => {
  try {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');

    const tx_ref = TX();

    // Flutterwave payment
    const paymentResponse = await initiateFlutterwavePayment({
      amount,
      tx_ref,
      currency: "NGN",
      redirect_url: "https://sociafyapp.vercel.app/dashboard",
      customer: {
        email: user.email!,
        phone_number: user.phoneNumber ?? "08000806011",
        name: `${user.firstName} ${user.lastName}`.trim(),
      },
      customizations: {
        title: `Payment for Booking`,
        logo: "https://res.cloudinary.com/drsimple/image/upload/v1758650594/sociafy_png_dppvsq.png",
      },
      configuration: {
        session_duration: 30,
      },
      max_retry_attempt: 3,
      payment_options: paymentMethod === 'card' ? 'card' : paymentMethod === 'bank' ? 'banktransfer' : 'ussd',
      meta: {
        userId: user._id.toString(),
        purpose: "booking_payment",
        bookingId,
      },
    });

    if (paymentResponse.status !== "success") {
      throw new Error('Payment initiation failed');
    }

    // Create transaction record
    const transaction = await TransactionModel.create({
      userId: user._id,
      amount,
      currency: "NGN",
      reference: tx_ref,
      status: 'pending',
      type: 'booking',
      paymentMethod,
      description: `Payment for booking ${bookingId || ''}`,
      transactionLink: paymentResponse.data.link,
      metadata: { bookingId },
    });

    return {
      success: true,
      transactionId: transaction._id.toString(),
      paymentLink: paymentResponse.data.link,
      transaction
    };
  } catch (error) {
    console.error('Payment processing error:', error);
    return { success: false, error: error.message };
  }
};
