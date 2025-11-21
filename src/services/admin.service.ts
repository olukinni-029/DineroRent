import mongoose from 'mongoose';
import UserModel, { IUser } from '../models/User.model';
import { VendorService } from './vendor.service';
import { ListingService } from './listing.service';
import { BookingService } from './booking.service';
import TransactionModel from '../models/Transaction.model';
import ListingModel from '../models/Listing.model';
import BookingModel from '../models/Booking.model';

export class AdminService {
  // User Management
  public static async getAllUsers(filters: any = {}) {
    const query: any = {};

    if (filters.role) query.role = filters.role;
    if (filters.deactivated !== undefined) query.deactivated = filters.deactivated;
    if (filters.suspended !== undefined) query.suspended = filters.suspended;

    return UserModel.find(query).select('-password').sort({ createdAt: -1 });
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
    return VendorService.getAllVendors().then(vendors =>
      vendors.filter(vendor => vendor.kycStatus === 'pending')
    );
  }

  public static async getAllVendors(): Promise<any[]>{
    return VendorService.getAllVendors();
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

  // Finance Admin Operations
  public static async getAllTransactions(filters: any = {}) {
    const query: any = {};

    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    return TransactionModel.find(query).populate('userId', 'firstName lastName email').sort({ createdAt: -1 });
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
    // This would integrate with a payout service like Flutterwave payouts
    // For now, just return a placeholder
    return { success: true, message: `Payout of ${amount} processed for vendor ${vendorId}` };
  }

  // Support Admin Operations
  public static async getAllBookings(filters: any = {}) {
    return BookingService.getAllBookings(filters);
  }

  public static async getBookingById(id: string) {
    return BookingService.getBookingById(id);
  }

  public static async updateBookingStatus(id: string, status: string, reason?: string) {
    return BookingService.updateBookingStatus(id, status, reason);
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
