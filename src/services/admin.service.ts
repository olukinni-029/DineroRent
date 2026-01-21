import mongoose from 'mongoose';
import UserModel, { IUser } from '../models/User.model';
import { VendorService } from './vendor.service';
import { ListingService } from './listing.service';
import { BookingService } from './booking.service';
import TransactionModel from '../models/Transaction.model';
import ListingModel from '../models/Listing.model';
import BookingModel from '../models/Booking.model';
import VendorModel from '../models/Vendor.model';
import { createPaystackRecipient, processTransfer } from './payment.service';

export class AdminService {
  // User Management
  public static async getAllUsers(filters: any = {}, page: number = 1, limit: number = 10) {
    const query: any = {};

    query.role = 'user';
    if (filters.deactivated !== undefined) query.deactivated = filters.deactivated;
    if (filters.suspended !== undefined) query.suspended = filters.suspended;

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      UserModel.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserModel.countDocuments(query)
    ]);
    const pages = Math.ceil(total / limit);
    return { users, total, page, pages };
  }

  public static async getUserById(id: string) {
    const objId = new mongoose.Types.ObjectId(id);
    return UserModel.findOne({ _id: objId }).select('-password');
  }

  public static async updateUserRole(id: string, role: string) {
    const validRoles = ['user', 'super_admin', 'vendor_verification_admin', 'finance_admin', 'support_admin'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role specified');
    }

    return UserModel.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
  }

  public static async deactivateUser(id: string) {
    return UserModel.findByIdAndUpdate(id, { deactivated: true }, { new: true }).select('-password');
  }

  public static async activateUser(id: string) {
    return UserModel.findByIdAndUpdate(id, { deactivated: false }, { new: true }).select('-password');
  }

  public static async suspendUser(id: string) {
    return UserModel.findByIdAndUpdate(id, { suspended: true }, { new: true }).select('-password');
  }

  public static async unsuspendUser(id: string) {
    return UserModel.findByIdAndUpdate(id, { suspended: false }, { new: true }).select('-password');
  }

  // Vendor Verification Admin Operations
  public static async getPendingVendors(): Promise<any[]> {
    const result = await VendorService.getAllVendors();
    return result.vendors.filter(vendor => vendor.kycStatus === 'pending');
  }

  public static async getAllVendors(page: number = 1, limit: number = 10){
    return VendorService.getAllVendors(page, limit);
  }

  public static async getVendorById(vendorId: string) {
    return VendorService.getVendorById(vendorId);
  }

  public static async approveVendor(vendorId: string) {
    return VendorService.approveVendor(vendorId);
  }

  public static async rejectVendor(vendorId: string, reason: string) {
    return VendorService.rejectVendor(vendorId, reason);
  }

  public static async getPendingListings() {
    return ListingService.getAllListingsAdmin({ isApproved: false });
  }

  public static async approveListing(listingId: string, approve: boolean) {
    return ListingService.approveListing(listingId, approve);
  }

  public static async rejectListing(listingId: string) {
    return ListingService.rejectListing(listingId);
  }

  // Finance Admin Operations
  public static async getAllTransactions(filters: any = {}, page: number = 1, limit: number = 10) {
    const query: any = {};

    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      TransactionModel.find(query).populate('userId', 'firstName lastName email').sort({ createdAt: -1 }).skip(skip).limit(limit),
      TransactionModel.countDocuments(query)
    ]);
    const pages = Math.ceil(total / limit);
    return { transactions, total, page, pages };
  }

  public static async getTransactionById(id: string) {
    return TransactionModel.findById(id).populate('userId', 'firstName lastName email');
  }

  public static async getRevenueReport(startDate?: Date, endDate?: Date) {
    const matchStage: any = { status: 'completed' };
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const revenue = await TransactionModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          averageTransaction: { $avg: '$amount' }
        }
      }
    ]);

    return revenue[0] || { totalRevenue: 0, transactionCount: 0, averageTransaction: 0 };
  }

 public static async processPayout(vendorId: string, amount: number) {
  const vendor = await VendorModel.findById(vendorId);
  if (!vendor) throw new Error('Vendor not found');

  if (!vendor.bankDetails?.accountNumber || !vendor.bankDetails?.bankName) {
    throw new Error('Vendor bank details are incomplete');
  }

  // Get or create vendor Paystack recipient
  let recipientCode = vendor.paystackRecipientCode;
  if (!recipientCode) {
    recipientCode = await createPaystackRecipient(vendor);
  }

  // Process payout via payment gateway
  const payoutResult = await processTransfer(
    amount,
    recipientCode,
    `Admin payout for vendor ${vendorId}`
  );

  if (!payoutResult.success) {
    throw new Error(payoutResult.error || 'Payout failed');
  }

  // Create transaction record for payout
  await TransactionModel.create({
    vendorId: vendor._id,
    amount,
    currency: 'NGN',
    reference: `TX-${Date.now()}`,
    status: 'pending', // Will be updated by webhook to 'completed'
    type: 'payout',
    description: `Admin payout for vendor ${vendorId}`,
    metadata: { transferReference: payoutResult.transfer.reference },
  });

  return { success: true, message: `Payout of ${amount} processed for vendor ${vendorId}`, transfer: payoutResult.transfer };
}


  // Support Admin Operations
  public static async getAllBookings(filters: any = {}, page: number = 1, limit: number = 10) {
    return BookingService.getAllBookings(filters, page, limit);
  }

  public static async getBookingById(id: string) {
    return BookingService.getBookingById(id);
  }

  public static async updateBookingStatus(id: string, status: string) {

    return BookingService.updateBookingStatus(id, status);
  }

  // Super Admin Operations (all permissions)
  public static async getSystemStats() {
    const [userCount, listingCount, bookingCount, transactionCount] = await Promise.all([
      UserModel.countDocuments(),
      ListingModel.countDocuments(),
      BookingModel.countDocuments(),
      TransactionModel.countDocuments()
    ]);

    return {
      users: userCount,
      vendors: 0, // Placeholder - would need to implement vendor count
      listings: listingCount,
      bookings: bookingCount,
      transactions: transactionCount
    };
  }

  public static async createAdminUser(userData: Partial<IUser>) {
    userData.role = userData.role || 'support_admin';
    return UserModel.create(userData);
  }
}
