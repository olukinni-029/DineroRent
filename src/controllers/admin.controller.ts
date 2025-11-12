import { Request, Response } from 'express';
import asyncHandler from '../utils/async_handler';
import { errorResponse, successResponse } from '../utils/response';
import { VendorService } from '../services/vendor.service';
import { ListingService } from '../services/listing.service';

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
};
