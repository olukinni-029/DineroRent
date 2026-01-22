import mongoose from 'mongoose';
import BookingModel, { IBooking } from '../models/Booking.model';
import ListingModel from '../models/Listing.model';
import { createPaystackRecipient, processPayment, processTransfer, processRefund } from './payment.service';
import emitter from '../utils/common/eventEmitter';
import TransactionModel from '../models/Transaction.model';
import { verifyPaystackPayment } from '../utils/payment';
import { IVendor } from '../models/Vendor.model';

export class BookingService {
  // Calculate total cost including platform fees
  public static calculateTotalCost(pricePerDay: number, days: number): {
    baseAmount: number;
    platformCommission: number;
    serviceCharge: number;
    totalAmount: number;
  } {
    const baseAmount = pricePerDay * days;
    const platformCommission = baseAmount * 0.15; // 15% commission
    const serviceCharge = baseAmount * 0.05; // 5% service charge
    const totalAmount = baseAmount + platformCommission + serviceCharge;

    return {
      baseAmount,
      platformCommission,
      serviceCharge,
      totalAmount
    };
  }

  // Check availability for dates
  public static async checkAvailability(
  listingId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  const listing = await ListingModel.findById(listingId);
  if (!listing) return false;

  // ✅ Available only if requested period fits inside at least one availability window
  const isAvailable = listing.availability?.some((period: any) => {
    const availableStart = new Date(period.startDate);
    const availableEnd = new Date(period.endDate);

    // User's requested start & end must both be inside an available window
    return startDate >= availableStart && endDate <= availableEnd;
  });

  return !!isAvailable;
}


  // Create booking
  public static async createBooking(bookingData: {
    userId: string;
    listingId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<IBooking> {
    const { userId, listingId, startDate, endDate } = bookingData;

    // Get listing details
    const listing = await ListingModel.findById(listingId);

    if (!listing) throw new Error('Listing not found');
    if (!listing.createdBy) throw new Error('Listing does not have a vendor assigned. Please contact admin.');

    // Check availability
    const isAvailable = await this.checkAvailability(listingId, startDate, endDate);
    if (!isAvailable) throw new Error('Listing not available for selected dates');

    // Calculate duration and cost
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const costBreakdown = this.calculateTotalCost(listing.pricePerDay, days);

    // Create booking
    const booking = await BookingModel.create({
      userId,
      vendorId: listing.createdBy,
      listingId,
      startDate,
      endDate,
      totalAmount: costBreakdown.totalAmount,
      status: 'pending',
      paymentStatus: 'pending'
    });

    // Emit event for notifications
    emitter.emit('booking:created', {
      bookingId: booking._id,
      userId,
      createdBy: listing.createdBy,
      listingTitle: listing.title,
      startDate,
      endDate,
      totalAmount: costBreakdown.totalAmount
    });

    return booking;
  }

  // Process payment for booking
  public static async initiateBookingPayment(
  bookingId: string, 
  userId: string
): Promise<{paymentLink: string; reference: string; transactionId: string}> {
  // Validate bookingId format
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new Error('Invalid booking ID format');
  }

  const booking = await BookingModel.findById(bookingId);
  if (!booking) throw new Error(`Booking with ID ${bookingId} not found`);
  
  // Verify user owns the booking
  if (booking.userId.toString() !== userId) {
    throw new Error('Unauthorized: You do not own this booking');
  }
  
  // Check booking status - vendor must confirm first
  if (booking.status !== 'confirmed') {
    throw new Error('Vendor must confirm the booking before payment can be initiated');
  }
  
  if (booking.paymentStatus === 'escrowed' || booking.paymentStatus === 'paid') {
    throw new Error('Booking already paid');
  }

  // Initiate payment (payment method will be selected by user on Paystack checkout page)
  const paymentResult = await processPayment(
    booking.totalAmount, 
    userId, 
    bookingId
  );
  
  if (!paymentResult.success) {
    throw new Error(paymentResult.error || 'Payment initiation failed');
  }

  // Update booking to show payment initiated (not completed)
  booking.paymentStatus = 'pending';
  booking.transactionReference = paymentResult.transaction.reference;
  await booking.save();

  return {
    paymentLink: paymentResult.paymentLink,
    reference: paymentResult.transaction.reference,
    transactionId: paymentResult.transactionId
  };
}
  // Vendor confirms booking
  public static async confirmBooking(bookingId: string, vendorId: string): Promise<IBooking> {
    const booking = await BookingModel.findOne({ _id: bookingId, vendorId });
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'pending') throw new Error('Booking cannot be confirmed');

    booking.status = 'confirmed';
    await booking.save();

    // Emit confirmation event
    emitter.emit('booking:confirmed', {
      bookingId: booking._id,
      userId: booking.userId,
      vendorId: booking.vendorId,
      startDate: booking.startDate,
      endDate: booking.endDate
    });

    return booking;
  }

  // Auto-cancel booking if vendor doesn't respond within 24 hours
  public static async autoCancelExpiredBookings(): Promise<void> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expiredBookings = await BookingModel.find({
      status: 'pending',
      createdAt: { $lt: twentyFourHoursAgo }
    });

    for (const booking of expiredBookings) {
      booking.status = 'cancelled';
      // Note: No automatic refund for auto-cancellation due to vendor inaction within 24 hours
      // This is a policy decision - user agreed to booking terms, vendor failed to respond in time
      await booking.save();

      // Emit cancellation event
      emitter.emit('booking:auto:cancelled', {
        bookingId: booking._id,
        userId: booking.userId,
        vendorId: booking.vendorId,
        reason: 'Vendor did not respond within 24 hours'
      });
    }
  }

  // Check-in verification
  public static async checkInBooking(bookingId: string, userId: string): Promise<IBooking> {
    const booking = await BookingModel.findOne({ _id: bookingId, userId });
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'confirmed') throw new Error('Booking cannot be checked in');

    // Check if payment has been successfully made before allowing check-in
    const successfulPaymentStatuses = ['paid', 'escrowed'];
    if (!successfulPaymentStatuses.includes(booking.paymentStatus)) {
      throw new Error('Payment must be completed before check-in');
    }

    // Check if check-in date matches
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(booking.startDate);
    startDate.setHours(0, 0, 0, 0);

    if (today.getTime() !== startDate.getTime()) {
      throw new Error('Check-in not allowed for this date');
    }

    booking.status = 'completed';
    await booking.save();

    // Emit check-in event
    emitter.emit('booking:checked:in', {
      bookingId: booking._id,
      userId: booking.userId,
      vendorId: booking.vendorId,
      checkInDate: new Date()
    });

    return booking;
  }

  // Release payment to vendor after successful check-in
 public static async releasePayment(
  bookingId: string
): Promise<any> {
  const booking = await BookingModel.findById(bookingId)
    .populate<{ vendorId: IVendor }>('vendorId')
    .lean<IBooking & { vendorId: IVendor }>();
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'completed' || booking.paymentStatus !== 'escrowed') {
      throw new Error('Payment cannot be released');
    }
    // Fetch the vendorId from the booking
    const vendor = booking.vendorId;
    if (!vendor) throw new Error('Vendor not associated with this booking');

    if (!vendor.bankDetails?.accountNumber || !vendor.bankDetails?.bankName) {
      throw new Error('Vendor bank details are incomplete');
    }

    // Get or create vendor Paystack recipient
    let recipientCode = vendor.paystackRecipientCode;
    if (!recipientCode) {
      recipientCode = await createPaystackRecipient(vendor);
    } 

    // Calculate vendor payout (total - platform commission)
    const costBreakdown = this.calculateTotalCost(
      booking.totalAmount / Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)),
      Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const vendorPayout = costBreakdown.baseAmount;

    // Process vendor payout via payment gateway
    const payoutVendor = await processTransfer(
      vendorPayout,
      recipientCode,
      `Payout for booking ${booking._id}`
    );
    if (!payoutVendor.success) {
      throw new Error(payoutVendor.error || 'Vendor payout failed');
    }

    // Create transaction record for payout
    await TransactionModel.create({
      userId: booking.vendorId,
      vendorId: booking.vendorId,
      bookingId: booking._id,
      amount: vendorPayout,
      currency: 'NGN',
      reference: `TX-${booking.transactionReference}`,
      status: 'pending', // Will be updated by webhook to 'completed'
      type: 'payout',
      description: `Payout for booking ${booking._id}`,
      metadata: { transferReference: booking.transactionReference },
    });

    // Update booking payment status
    await BookingModel.findByIdAndUpdate(bookingId, { paymentStatus: 'transfer_pending' });

    // Emit payment release event
    emitter.emit('booking:payment:initiated', {
      bookingId: booking._id,
      vendorId: booking.vendorId,
      amount: vendorPayout,
      platformCommission: costBreakdown.platformCommission + costBreakdown.serviceCharge
    });

    return { ...booking, paymentStatus: 'transfer_pending' };
  }

  // Get user bookings
  public static async getUserBookings(userId: string): Promise<IBooking[]> {
    return BookingModel.find({ userId })
      .populate('listingId', 'title images location type')
      .populate('vendorId', 'firstName lastName businessName')
      .sort({ createdAt: -1 });
  }

  // Get vendor bookings
  public static async getVendorBookings(vendorId: string, status?: string): Promise<IBooking[]> {
    const filters: any = { vendorId };
    if (status) filters.status = status;

    return BookingModel.find(filters)
      .populate('listingId', 'title images location type')
      .populate('userId', 'firstName lastName email phone')
      .sort({ createdAt: -1 });
  }

  // Get single booking
  public static async getBookingById(bookingId: string): Promise<IBooking | null> {
  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return null;
  }

  const booking = await BookingModel.findById(bookingId)
    .populate({
      path: 'listingId',
      select: 'title images location type pricePerDay',
      strictPopulate: false // Don't fail if reference doesn't exist
    })
    .populate({
      path: 'userId',
      select: 'firstName lastName email phone',
      strictPopulate: false
    })
    .populate({
      path: 'vendorId',
      select: 'firstName lastName businessName email phone',
      strictPopulate: false
    });

  return booking;
}

  // Vendor rejects booking
  public static async rejectBooking(bookingId: string, vendorId: string, reason?: string): Promise<IBooking> {
    const booking = await BookingModel.findOne({
      _id: bookingId,
      vendorId,
      status: 'pending'
    });

    if (!booking) throw new Error('Booking not found or not pending');

    booking.status = 'cancelled';
    booking.cancellationReason = reason || 'Vendor rejected booking';
    booking.paymentStatus = 'refunded';
    await booking.save();

    // Emit booking rejected event
    emitter.emit('booking:rejected', {
      bookingId: booking._id,
      userId: booking.userId,
      vendorId: booking.vendorId,
      reason: booking.cancellationReason
    });

    return booking;
  }

  // Cancel booking (user-initiated)
  public static async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<IBooking> {
    const booking = await BookingModel.findOne({
      _id: bookingId,
      userId,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (!booking) throw new Error('Booking not found or cannot be cancelled');

    booking.status = 'cancelled';
    booking.cancellationReason = reason || 'User cancelled booking';

    // Process refund if payment was made
    if (booking.paymentStatus === 'escrowed' && booking.transactionReference) {
      const refundResult = await processRefund({
        amount: booking.totalAmount,
        reference: booking.transactionReference,
        reason: reason || 'User cancelled booking'
      });

      if (refundResult.success) {
        booking.paymentStatus = 'refunded';
        console.log(`Refund processed for booking ${bookingId}`);
      } else {
        console.error(`Refund failed for booking ${bookingId}:`, refundResult.error);
        // Still mark as refunded for now, but log the error
        booking.paymentStatus = 'refunded';
      }
    } else {
      booking.paymentStatus = 'cancelled_no_payment';
    }

    await booking.save();

    // Emit booking cancelled event
    emitter.emit('booking:cancelled', {
      bookingId: booking._id,
      userId: booking.userId,
      vendorId: booking.vendorId,
      reason: booking.cancellationReason
    });

    return booking;
  }

  // Get all bookings (admin)
  public static async getAllBookings(filters: any = {}, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      BookingModel.find(filters)
        .populate('listingId', 'title images location type')
        .populate('userId', 'firstName lastName email phone')
        .populate('vendorId', 'firstName lastName businessName email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BookingModel.countDocuments(filters)
    ]);
    const pages = Math.ceil(total / limit);
    return { bookings, total, page, pages };
  }

  // Update booking status (admin)
  public static async updateBookingStatus(bookingId: string, status: string, reason?: string): Promise<IBooking> {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found');

    booking.status = status as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'disputed';
    if (reason) booking.cancellationReason = reason;
    await booking.save();

    return booking;
  }

  // Called by webhook controller on payment success and by user controller for payment verification
  public static async completeBookingPayment(
  reference: string,
  bookingId: string
): Promise<IBooking> {
  // Verify payment with Paystack
  const verification = await verifyPaystackPayment(reference);
  
  if (verification.status !== true || verification.data.status !== 'success') {
    throw new Error('Payment verification failed');
  }

  const booking = await BookingModel.findById(bookingId);
  if (!booking) throw new Error('Booking not found');

  // Prevent double processing
  if (booking.paymentStatus === 'escrowed') {
    console.log(`Booking ${bookingId} already marked as escrowed`);
    return booking;
  }

  // Update transaction
  await TransactionModel.findOneAndUpdate(
    { reference },
    { 
      status: 'completed',
      paystackReference: verification.data.reference,
      completedAt: new Date()
    }
  );

  // Update booking - NOW we mark as escrowed
  booking.paymentStatus = 'escrowed';
  booking.status = 'confirmed';
  booking.transactionReference = reference;
  await booking.save();

  // NOW emit the completion event
  emitter.emit('booking:payment:completed', {
    bookingId: booking._id,
    userId: booking.userId,
    vendorId: booking.vendorId,
    reference,
    amount: booking.totalAmount
  });

  return booking;
}
}
