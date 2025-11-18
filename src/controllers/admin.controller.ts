import { Request, Response } from 'express';
import asyncHandler from '../utils/async_handler';
import { errorResponse, successResponse } from '../utils/response';
import { VendorService } from '../services/vendor.service';
import { ListingService } from '../services/listing.service';
import { BookingService } from '../services/booking.service';

export const adminController = {
  // Approve Vendor
  approveVendor: asyncHandler(async (req: Request, res: Response) => {
    const { vendorId } = req.params;
    const vendor = await VendorService.approveVendor(vendorId);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    successResponse(res, { vendor }, 'Vendor approved successfully');
  }),

  // Reject Vendor
  rejectVendor: asyncHandler(async (req: Request, res: Response) => {
    const { vendorId } = req.params;
    const { reason } = req.body;
    const vendor = await VendorService.rejectVendor(vendorId, reason);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    successResponse(res, { vendor }, 'Vendor rejected');
  }),

  // Approve or Reject Listing
  approveListing: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { approve } = req.body; // true or false

    const listing = await ListingService.approveListing(id, approve);
    if (!listing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing }, approve ? "Listing approved" : "Listing rejected");
  }),

  // Get all listings (admin view - includes unapproved)
  getAllListings: asyncHandler(async (req: Request, res: Response) => {
    const { type, location, minPrice, maxPrice, isApproved, isActive } = req.query;

    const filters: any = {};

    if (type) filters.type = type;
    if (location) filters.location = location;
    if (minPrice) filters.minPrice = Number(minPrice);
    if (maxPrice) filters.maxPrice = Number(maxPrice);
    if (isApproved !== undefined) filters.isApproved = isApproved === 'true';
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const listings = await ListingService.getAllListingsAdmin(filters);
    return successResponse(res, { listings }, "Listings retrieved successfully");
  }),

  // Get single listing by ID (admin view)
  getListingById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const listing = await ListingService.getListingById(id);
    if (!listing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing }, "Listing retrieved successfully");
  }),

  // Update any listing (admin)
  updateListing: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;

    const updatedListing = await ListingService.adminUpdateListing(id, updateData);
    if (!updatedListing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing: updatedListing }, "Listing updated successfully");
  }),

  // Delete any listing (admin)
  deleteListing: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const deletedListing = await ListingService.adminDeleteListing(id);
    if (!deletedListing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing: deletedListing }, "Listing deleted successfully");
  }),

  // Update availability for any listing (admin)
  updateAvailability: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { availability } = req.body;

    const updatedListing = await ListingService.adminUpdateAvailability(id, availability);
    if (!updatedListing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing: updatedListing }, "Availability updated successfully");
  }),

  // Create new listing (admin)
  createListing: asyncHandler(async (req: Request, res: Response) => {
    const listingData = req.body;

    const newListing = await ListingService.createListing(listingData);
    return successResponse(res, { listing: newListing }, "Listing created successfully");
  }),

  /**
   * Get all bookings (admin)
   */
  getAllBookings: asyncHandler(async (req: Request, res: Response) => {
    const { status, userId, vendorId } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    if (vendorId) filters.vendorId = vendorId;

    const bookings = await BookingService.getAllBookings(filters);
    return successResponse(res, { bookings }, "Bookings retrieved successfully");
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
    const { status, reason } = req.body;

    const booking = await BookingService.updateBookingStatus(id, status, reason);
    if (!booking) return errorResponse(res, "Booking not found", 404);

    return successResponse(res, { booking }, "Booking status updated successfully");
  }),
};
