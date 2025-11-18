import { Request, Response } from 'express';
import asyncHandler from "../utils/async_handler";
import { compare, hash } from "../utils/hashes/hasher";
import { generateToken, verifyToken } from "../utils/hashes/jwthandler";
import {
  errorResponse,
  successResponse,
} from "../utils/response";
import { VendorService } from '../services/vendor.service';
import { OtpService } from '../services/otp.service';
import { ListingService } from '../services/listing.service';
import { BookingService } from '../services/booking.service';

export const vendorController = {
  // Vendor Registration
  registerVendor: asyncHandler(async (req: Request, res: Response) => {
    const  payload  = req.body;

    // Check if vendor already exists
    const existingVendor = await VendorService.getVendorByEmail(payload.email);
    if (existingVendor) {
      return errorResponse(res, 'Vendor with this email already exists', 400);
    }

    // check if phone already exists
    const existingPhoneVendor = await VendorService.getVendorByPhone(payload.phone);
    if (existingPhoneVendor) {
      return errorResponse(res, 'Vendor with this phone number already exists', 400);
    }

    // Hash password
    const hashedPassword = await hash(payload.password);

    // Create vendor
    const vendor = await VendorService.createVendor({
        ...payload,
        password: hashedPassword,
      });

    // send otp to phone and email
    const otp = await OtpService.issueOtp(
      payload.phone,
      "verify-vendor",
      payload.email
    );

    // Generate token
    const tokenPayload = {
      id: vendor._id,
      email: vendor.email,
      role: "vendor", 
    };

    const token = generateToken({tokenPayload}, process.env.JWT_SECRET || 'defaultSecret', '1h');

    successResponse(res, { vendor, token }, 'Vendor registered successfully');
  }),

  // verify Vendor OTP
  verifyVendorOtp: asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp } = req.body ;
    const existingOtp = await OtpService.findLatestOtpByPurpose("verify-vendor", phone);
    if (!existingOtp) {
    return errorResponse(res, 'OTP not found or expired', 400);
  }
    const isOtpValid = await OtpService.verifyOtpHash(otp, existingOtp.otp);
    if (!isOtpValid) {
      return errorResponse(res, 'Invalid OTP', 400);
    }
    // OTP is valid, proceed with verification
    await OtpService.deleteOtpByPhone(phone, "verify-vendor");
    successResponse(res, {}, 'OTP verified successfully');
  }),
  
  // vendor login
  loginVendor: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body ;

    const vendor = await VendorService.getVendorByEmail(email);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }
     const isPasswordMatch = await compare(password, vendor.password);
    if (!isPasswordMatch) {
      return errorResponse(res, "Invalid email or password", 401);
    }
    
    const tokenPayload = {
      id: vendor._id,
      email: vendor.email,
      role: "vendor", 
    };

    const token = generateToken({tokenPayload }, process
      .env.JWT_SECRET || 'defaultSecret', '1h');

    successResponse(res, { vendor, token }, 'Vendor logged in successfully');
  }),

  // Submit KYC
  submitKYC: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = (req as any).user.id; 
    const kycData = req.body;

    const vendor = await VendorService.submitKYC(vendorId, kycData);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    successResponse(res, { vendor }, 'KYC submitted successfully');
  }),

  // Get Vendor Profile
  getVendorProfile: asyncHandler(async (req: Request, res: Response) => {
     const vendorId = (req as any).user.id; 
    const vendor = await VendorService.getVendorById(vendorId);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    successResponse(res, { vendor }, 'Vendor profile retrieved successfully');
  }),

  // Update Vendor Profile
  updateVendorProfile: asyncHandler(async (req: Request, res: Response) => {
     const vendorId = (req as any).user.id; 
    const updateData = req.body;

    const vendor = await VendorService.updateVendor(vendorId, updateData);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }

    successResponse(res, { vendor }, 'Vendor profile updated successfully');
  }),


  /**
     * Add or update availability for a listing (Vendor)
     */
   updateAvailability: asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const vendorId = (req as any).user.id;
      const { availability } = req.body; // [{ startDate, endDate }]
  
      const listing = await ListingService.updateAvailability(id, vendorId, availability);
      if (!listing) return errorResponse(res, "Failed to update availability", 400);
  
      return successResponse(res, { listing }, "Availability updated successfully");
    }),

     /**
       * Update listing (Vendor only)
       */
      updateListing: asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const vendorId = (req as any).user.id;
        const updateData = req.body;
    
        const updatedListing = await ListingService.updateListing(id, vendorId, updateData);
        if (!updatedListing) return errorResponse(res, "Listing not found or not authorized", 404);
    
        return successResponse(res, { updatedListing }, "Listing updated successfully");
      }),
    
      /**
       * Delete listing (Vendor only)
       */
      deleteListing: asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const vendorId = (req as any).user.id;
    
        const deleted = await ListingService.deleteListing(id, vendorId);
        if (!deleted) return errorResponse(res, "Listing not found or not authorized", 404);
    
        return successResponse(res, {}, "Listing deleted successfully");
      }),

     /**
        * Create a new listing (Vendor only)
        */
       createListing: asyncHandler(async (req: Request, res: Response) => {
         const vendorId = (req as any).user.id; // vendor authenticated via token
         const payload = req.body;

         // attach vendor ID to payload
         payload.vendor = vendorId;

         const listing = await ListingService.createListing(payload);
         if (!listing) {
           return errorResponse(res, "Failed to create listing", 400);
         }

         return successResponse(res, { listing }, "Listing created successfully");
       }),

  /**
   * Confirm booking (Vendor only)
   */
  confirmBooking: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = (req as any).user.id;
    const { bookingId } = req.params;

    const booking = await BookingService.confirmBooking(bookingId, vendorId);

    return successResponse(res, { booking }, "Booking confirmed successfully");
  }),

  /**
   * Reject booking (Vendor only)
   */
  rejectBooking: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = (req as any).user.id;
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await BookingService.rejectBooking(bookingId, vendorId, reason);

    return successResponse(res, { booking }, "Booking rejected");
  }),

  /**
   * Get vendor bookings
   */
  getVendorBookings: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = (req as any).user.id;
    const { status } = req.query;

    const bookings = await BookingService.getVendorBookings(vendorId, status as string);

    return successResponse(res, { bookings }, "Bookings retrieved successfully");
  }),

  /**
   * Get single booking details (Vendor)
   */
  getBookingById: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = (req as any).user.id;
    const { bookingId } = req.params;

    const booking = await BookingService.getBookingById(bookingId, vendorId);
    if (!booking) return errorResponse(res, "Booking not found", 404);

    return successResponse(res, { booking }, "Booking retrieved successfully");
  }),
};
