import mongoose from 'mongoose';
import BookingModel, { IBooking } from '../models/Booking.model';
import ListingModel from '../models/Listing.model';
import { processPayment } from './payment.service';
import emitter from '../utils/common/eventEmitter';
import TransactionModel from '../models/Transaction.model';
import { verifyPaystackPayment } from '../utils/payment';

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
  public static async checkAvailability(listingId: string, startDate: Date, endDate: Date): Promise<boolean> {
    const listing = await ListingModel.findById(listingId);
    if (!listing) return false;

    // Check if dates conflict with existing availability restrictions
    const conflicts = listing.availability?.some((block: any) => {
      const blockStart = new Date(block.startDate);
      const blockEnd = new Date(block.endDate);
      return (startDate <= blockEnd && endDate >= blockStart);
    });

    return !conflicts;
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
    const listing = await ListingModel.findById(listingId).populate('createdBy');
    if (!listing) throw new Error('Listing not found');

    // Check availability
    const isAvailable = await this.checkAvailability(listingId, startDate, endDate);
    if (!isAvailable) throw new Error('Listing not available for selected dates');

    // Calculate duration and cost
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const costBreakdown = this.calculateTotalCost(listing.pricePerDay, days);

    // Create booking
    const booking = await BookingModel.create({
      userId,
      createdBy: listing.createdBy,
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
  paymentMethod: string, 
  userId: string
): Promise<{paymentLink: string; reference: string; transactionId: string}> {
  const booking = await BookingModel.findById(bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.userId.toString() !== userId) throw new Error('Unauthorized');
  if (booking.status !== 'pending') throw new Error('Booking cannot be paid for');
  if (booking.paymentStatus === 'escrowed' || booking.paymentStatus === 'paid') {
    throw new Error('Booking already paid');
  }

  // Initiate payment
  const paymentResult = await processPayment(
    booking.totalAmount, 
    paymentMethod, 
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
      createdBy: booking.createdBy,
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
      await booking.save();

      // Process refund
      if (booking.paymentStatus === 'escrowed') {
        // TODO: Implement refund logic
        booking.paymentStatus = 'pending'; // Reset for refund
        await booking.save();
      }

      // Emit cancellation event
      emitter.emit('booking:auto:cancelled', {
        bookingId: booking._id,
        userId: booking.userId,
        createdBy: booking.createdBy,
        reason: 'Vendor did not respond within 24 hours'
      });
    }
  }

  // Check-in verification
  public static async checkInBooking(bookingId: string, userId: string): Promise<IBooking> {
    const booking = await BookingModel.findOne({ _id: bookingId, userId });
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'confirmed') throw new Error('Booking cannot be checked in');

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
      createdBy: booking.createdBy,
      checkInDate: new Date()
    });

    return booking;
  }

  // Release payment to vendor after successful check-in
  public static async releasePayment(bookingId: string): Promise<IBooking> {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'completed' || booking.paymentStatus !== 'escrowed') {
      throw new Error('Payment cannot be released');
    }

    // Calculate vendor payout (total - platform commission)
    const costBreakdown = this.calculateTotalCost(
      booking.totalAmount / Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24)),
      Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const vendorPayout = costBreakdown.baseAmount;

    // TODO: Process vendor payout via payment gateway
    booking.paymentStatus = 'released';
    await booking.save();

    // Emit payment release event
    emitter.emit('booking:payment:released', {
      bookingId: booking._id,
      createdBy: booking.createdBy,
      amount: vendorPayout,
      platformCommission: costBreakdown.platformCommission + costBreakdown.serviceCharge
    });

    return booking;
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
  public static async getBookingById(bookingId: string, userId?: string): Promise<IBooking | null> {
    const query: any = { _id: bookingId };
    if (userId) query.$or = [{ userId }, { vendorId: userId }];

    return BookingModel.findOne(query)
      .populate('listingId', 'title images location type pricePerDay')
      .populate('userId', 'firstName lastName email phone')
      .populate('vendorId', 'firstName lastName businessName email phone');
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
      createdBy: booking.createdBy,
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
    booking.paymentStatus = 'refunded';
    await booking.save();

    // Emit booking cancelled event
    emitter.emit('booking:cancelled', {
      bookingId: booking._id,
      userId: booking.userId,
      createdBy: booking.createdBy,
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
    createdBy: booking.createdBy,
    reference,
    amount: booking.totalAmount
  });

  return booking;
}
}
