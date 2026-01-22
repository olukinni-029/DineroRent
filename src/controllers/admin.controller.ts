import { Request, Response } from 'express';
import asyncHandler from '../utils/async_handler';
import { errorResponse, successResponse } from '../utils/response';
import { AdminService } from '../services/admin.service';
import { VendorService } from '../services/vendor.service';
import { ListingService } from '../services/listing.service';
import { BookingService } from '../services/booking.service';
import { ValidationError, NotFoundError, ConflictError } from '../utils/customError';

export const adminController = {
  // Approve Vendor
  approveVendor: asyncHandler(async (req: Request, res: Response) => {
    const { vendorId } = req.params;
    const vendor = await AdminService.approveVendor(vendorId);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    successResponse(res, { vendor }, 'Vendor approved successfully');
  }),

  // Reject Vendor
  rejectVendor: asyncHandler(async (req: Request, res: Response) => {
    const { vendorId } = req.params;
    const { reason } = req.body;
    const vendor = await AdminService.rejectVendor(vendorId, reason);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    successResponse(res, { vendor }, 'Vendor rejected');
  }),

  // Approve or Reject Listing
  approveListing: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const listing = await AdminService.approveListing(id, true);
    if (!listing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing }, "Listing approved");
  }),

  rejectListing: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const listing = await AdminService.rejectListing(id);
    if (!listing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing }, "Listing rejected");
  }),

  // Get all listings (admin view - includes unapproved)
  getAllListings: asyncHandler(async (req: Request, res: Response) => {
  const { type, location, minPrice, maxPrice, isApproved, isActive, page = '1', limit = '10' } = req.query;

  const filters: any = {};

  if (type) filters.type = type;
  if (location) filters.location = location;
  if (minPrice) filters.minPrice = Number(minPrice);
  if (maxPrice) filters.maxPrice = Number(maxPrice);
  if (isApproved !== undefined) filters.isApproved = isApproved === 'true';
  if (isActive !== undefined) filters.isActive = isActive === 'true';

  // Convert pagination params to numbers
  const pageNumber = Math.max(Number(page), 1);
  const limitNumber = Math.max(Number(limit), 1);

  // Fetch listings with pagination
  const { listings, total, totalPages, currentPage } =
    await ListingService.getAllListingsAdmin(filters, pageNumber, limitNumber);

  return successResponse(res, {
    listings,
    pagination: {
      total,
      totalPages,
      currentPage,
      limit: limitNumber,
    },
  }, "Listings retrieved successfully");
}),


  // Get single listing by ID (admin view)
  getListingById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const listing = await ListingService.getListingById(id);
    if (!listing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing }, "Listing retrieved successfully");
  }),

  // Update listing created by admin
  updateListing: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;
    const userId = (req as any).user.id;

    // Check if listing was created by this admin
    const listing = await ListingService.getListingById(id);
    if (!listing) return errorResponse(res, "Listing not found", 404);
    if (listing.createdBy !== userId) {
      return errorResponse(res, "You can only update listings you created", 403);
    }

    const updatedListing = await ListingService.adminUpdateListing(id, updateData);
    if (!updatedListing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing: updatedListing }, "Listing updated successfully");
  }),

  // Delete listing created by admin
  deleteListing: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Check if listing was created by this admin
    const listing = await ListingService.getListingById(id);
    if (!listing) return errorResponse(res, "Listing not found", 404);
    if (listing.createdBy !== userId) {
      return errorResponse(res, "You can only delete listings you created", 403);
    }

    const deletedListing = await ListingService.adminDeleteListing(id);
    if (!deletedListing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, {}, "Listing deleted successfully");
  }),

  // Update availability for listing created by admin
  updateAvailability: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { availability } = req.body;
    const userId = (req as any).user.id;

    // Check if listing was created by this admin
    const listing = await ListingService.getListingById(id);
    if (!listing) return errorResponse(res, "Listing not found", 404);
    if (listing.createdBy !== userId) {
      return errorResponse(res, "You can only update availability for listings you created", 403);
    }

    const updatedListing = await ListingService.adminUpdateAvailability(id, availability);
    if (!updatedListing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing: updatedListing }, "Availability updated successfully");
  }),

  // Create new listing (admin)
  createListing: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    if(!userId) return errorResponse(res, " Unauthorized", 401);
    const listingData = {
      ...req.body,
      createdBy: userId,
    };

    const newListing = await ListingService.createListing(listingData);
    return successResponse(res, { listing: newListing }, "Listing created successfully");
  }),

  /**
   * Get all bookings (admin)
   */
  getAllBookings: asyncHandler(async (req: Request, res: Response) => {
    const { status, userId, vendorId, page, limit } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    if (vendorId) filters.vendorId = vendorId;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const result = await AdminService.getAllBookings(filters, pageNum, limitNum);
    return successResponse(res, result, "Bookings retrieved successfully");
  }),

  /**
   * Get single booking by ID (admin)
   */
  getBookingById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const booking = await BookingService.getBookingById(id);
    if (!booking) return errorResponse(res, "Booking not found", 404);

    return successResponse(res, { booking }, "Booking retrieved successfully");
  }),

  /**
   * Update booking status (admin)
   */
  updateBookingStatus: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status} = req.body;

    const booking = await AdminService.updateBookingStatus(id, status);
    if (!booking) return errorResponse(res, "Booking not found", 404);

    return successResponse(res, { booking }, "Booking status updated successfully");
  }),

  // User Management (Super Admin)
  getAllUsers: asyncHandler(async (req: Request, res: Response) => {
    const {deactivated, suspended, page, limit } = req.query;
    const filters: any = {};

    if (deactivated !== undefined) filters.deactivated = deactivated === 'true';
    if (suspended !== undefined) filters.suspended = suspended === 'true';

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const result = await AdminService.getAllUsers(filters, pageNum, limitNum);
    return successResponse(res, result, "Users retrieved successfully");
  }),

  getUserById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await AdminService.getUserById(id);
    if (!user) return errorResponse(res, "User not found", 404);

    return successResponse(res, { user }, "User retrieved successfully");
  }),

  updateUserRole: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    const user = await AdminService.updateUserRole(id, role);
    if (!user) return errorResponse(res, "User not found", 404);

    return successResponse(res, { user }, "User role updated successfully");
  }),

  deactivateUser: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await AdminService.deactivateUser(id);
    if (!user) return errorResponse(res, "User not found", 404);

    return successResponse(res, { user }, "User deactivated successfully");
  }),

  activateUser: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await AdminService.activateUser(id);
    if (!user) return errorResponse(res, "User not found", 404);

    return successResponse(res, { user }, "User activated successfully");
  }),

  suspendUser: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await AdminService.suspendUser(id);
    if (!user) return errorResponse(res, "User not found", 404);

    return successResponse(res, { user }, "User suspended successfully");
  }),

  unsuspendUser: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await AdminService.unsuspendUser(id);
    if (!user) return errorResponse(res, "User not found", 404);

    return successResponse(res, { user }, "User unsuspended successfully");
  }),

  // Vendor Verification Admin Operations
  getPendingVendors: asyncHandler(async (req: Request, res: Response) => {
    const vendors = await AdminService.getPendingVendors();
    if (vendors.length === 0) {
      return errorResponse(res, "No pending vendors", 404);
    }
    return successResponse(res, { vendors }, "Pending vendors retrieved successfully");
  }),

  getAllVendors: asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await AdminService.getAllVendors(page, limit);
    return successResponse(res, result, "All vendors retrieved successfully");
  }),

  getVendorById: asyncHandler(async (req: Request, res: Response) => {
    const { vendorId } = req.params;
    const vendor = await AdminService.getVendorById(vendorId);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }
    return successResponse(res, { vendor }, "Vendor retrieved successfully");
  }),

  // Finance Admin Operations
  getAllTransactions: asyncHandler(async (req: Request, res: Response) => {
    const { status, type, startDate, endDate, page, limit } = req.query;
    const filters: any = {};

    if (status) filters.status = status;
    if (type) filters.type = type;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const result = await AdminService.getAllTransactions(filters, pageNum, limitNum);
    return successResponse(res, result, "Transactions retrieved successfully");
  }),

  getRevenueReport: asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const report = await AdminService.getRevenueReport(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    return successResponse(res, { report }, "Revenue report generated successfully");
  }),

  processPayout: asyncHandler(async (req: Request, res: Response) => {
    const { vendorId, amount } = req.body;
    const payout = await AdminService.processPayout(vendorId, amount);
    return successResponse(res, { payout }, "Payout processed successfully");
  }),

  // System Stats (Super Admin)
  getSystemStats: asyncHandler(async (req: Request, res: Response) => {
    const stats = await AdminService.getSystemStats();
    return successResponse(res, { stats }, "System statistics retrieved successfully");
  }),

  // Create Admin User (Super Admin)
  createAdminUser: asyncHandler(async (req: Request, res: Response) => {
    const userData = req.body;
    const adminUser = await AdminService.createAdminUser(userData);
    return successResponse(res, { user: adminUser }, "Admin user created successfully");
  }),

  // Get a transaction by ID
  getTransactionById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const transaction = await AdminService.getTransactionById(id);
    if (!transaction) return errorResponse(res, "Transaction not found", 404);
    return successResponse(res, { transaction }, "Transaction retrieved successfully");
  }),
};
