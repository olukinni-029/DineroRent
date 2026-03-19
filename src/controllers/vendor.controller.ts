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
import { uploadFiles } from '../utils/file_handler/multer';
import emitter from '../utils/common/eventEmitter';
import fs from 'fs';
import { ValidationError, NotFoundError, ConflictError } from '../utils/customError';

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
      "verify-vendor"
    );
    emitter.emit("onboarding::one", { email: payload.email, otp: otp.toString() });
    // Generate token
    const tokenPayload = {
      id: vendor._id,
      email: vendor.email,
      role: "vendor",
    };

    const token = generateToken(tokenPayload, process.env.JWT_SECRET || 'defaultSecret', '24h');

    successResponse(res, { vendor, token }, 'Vendor registered successfully');
  }),

  // verify Vendor OTP
  verifyVendorOtp: asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp } = req.body ;
    const existingOtp = await OtpService.findLatestOtpByPurpose("verify-vendor", phone);
    if (!existingOtp) {
      return errorResponse(res, 'OTP not found or expired', 400);
    }
    if (!existingOtp.otp) return errorResponse(res, 'Invalid OTP', 400);
    const isOtpValid = await OtpService.verifyOtpHash(otp, existingOtp.otp as string);
    if (!isOtpValid) {
      return errorResponse(res, 'Invalid OTP', 400);
    }
    // OTP is valid, proceed with verification
    await OtpService.deleteOtpByPhone(phone, "verify-vendor");
    successResponse(res, {}, 'OTP verified successfully');
  }),
  
  // vendor login
  loginVendor: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const vendor = await VendorService.getVendorByEmail(email);
    if (!vendor) {
      return errorResponse(res, 'Vendor not found', 404);
    }
    if (!vendor.password) return errorResponse(res, "Invalid email or password", 401);
    const isPasswordMatch = await compare(password, vendor.password as string);
    if (!isPasswordMatch) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    const tokenPayload = {
      id: vendor._id,
      email: vendor.email,
      role: "vendor",
    };

    const token = generateToken(tokenPayload, process.env.JWT_SECRET || 'defaultSecret', '1h');

    successResponse(res, { vendor, token }, 'Vendor logged in successfully');
  }),

  // Submit KYC
submitKYC: asyncHandler(async (req: Request, res: Response) => {
  const vendorId = (req as any).user.id;
  const kycData = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  // check if the vendor already submited kyc and is approved
  const existingVendor = await VendorService.getVendorById(vendorId);
  if (existingVendor?.adminApproveVerification === 'approved') {
    return errorResponse(res, 'KYC already approved. No further submissions allowed.', 400);
  }

  // Upload and map files
  const uploadedImages: Record<string, string> = {};

  if (files && Object.keys(files).length > 0) {
    for (const [fieldName, fileArray] of Object.entries(files)) {
      const filePaths = fileArray.map((file) => file.path);
      const urls = await uploadFiles(filePaths);
      uploadedImages[fieldName] = urls[0];
      filePaths.forEach((fp) => fs.existsSync(fp) && fs.unlinkSync(fp));
    }
  }

  const updatedKycData = {
    ...kycData,
    verificationImages: {
      idCard: uploadedImages.idCard,
      cacCertificate: uploadedImages.cacCertificate,
      ownershipProof: uploadedImages.ownershipProof,
    },
  };

  const result = await VendorService.submitKYC(vendorId, updatedKycData);

  if (result.success === false) {
    return errorResponse(res, result.messages?.join(', ') || 'KYC submission failed', 400);
  }

  // Return only messages related to the submitted KYC fields
  return successResponse(res, { messages: result.messages || [] }, 'KYC submission processed');
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

    const checkKyc = await VendorService.getVendorById(vendorId);
        if (checkKyc?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot create listing.", 403);
        }

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

      const vendor = await VendorService.getVendorById(vendorId);
        if (vendor?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot update listing.", 403);
        }

      //check if the listing belongs to the vendor
      const checkListing = await ListingService.getListingById(id);
      if (!checkListing) {
        return errorResponse(res, "Listing not found", 404);
      }
      if (checkListing.createdBy.toString() !== vendorId) {
        return errorResponse(res, "You can only update listings you created", 403);
      }
  
      const listing = await ListingService.updateAvailability(id, availability);
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

        const vendor = await VendorService.getVendorById(vendorId);
        if (vendor?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot update listing.", 403);
        }

        const checkListing = await ListingService.getListingById(id);
      if (!checkListing) {
        return errorResponse(res, "Listing not found", 404);
      }
      if (checkListing.createdBy.toString() !== vendorId) {
        return errorResponse(res, "You can only update listings you created", 403);
      }
    
        const updatedListing = await ListingService.updateListing(id,updateData);
        if (!updatedListing) return errorResponse(res, "Listing couldnt be updated", 404);
    
        return successResponse(res, { updatedListing }, "Listing updated successfully");
      }),
    
      /**
       * Delete listing (Vendor only)
       */
      deleteListing: asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const vendorId = (req as any).user.id;

        const vendor = await VendorService.getVendorById(vendorId);
        if (vendor?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot create listing.", 403);
        }
    
        const deleted = await ListingService.getListingById(id);
        if (!deleted) return errorResponse(res, "Listing not found", 404);
        if (deleted.createdBy.toString() !== vendorId) {
        return errorResponse(res, "You can only delete listings you created", 403);
      }
    
        return successResponse(res, {}, "Listing deleted successfully");
      }),

     /**
        * Create a new listing (Vendor only)
        */
       createListing: asyncHandler(async (req: Request, res: Response) => {
         const vendorId = (req as any).user.id; // vendor authenticated via token
         const payload = req.body;

         // attach vendor ID to payload
         payload.createdBy = vendorId;

        //  Before creating, check if vendor has been approved via by admin for KYC
        const vendor = await VendorService.getVendorById(vendorId);
        if (vendor?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot create listing.", 403);
        }

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

    const vendor = await VendorService.getVendorById(vendorId);
        if (vendor?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot confirm booking.", 403);
        }

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

    const vendor = await VendorService.getVendorById(vendorId);
        if (vendor?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot reject booking.", 403);
        }

    const booking = await BookingService.rejectBooking(bookingId, vendorId, reason);

    return successResponse(res, { booking }, "Booking rejected");
  }),

  /**
   * Get vendor bookings
   */
  getVendorBookings: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = (req as any).user.id;
    const { status } = req.query;

    const vendor = await VendorService.getVendorById(vendorId);
        if (vendor?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot create listing.", 403);
        }

    const bookings = await BookingService.getVendorBookings(vendorId, status as string);

    return successResponse(res, { bookings }, "Bookings retrieved successfully");
  }),

  /**
   * Get single booking details (Vendor)
   */
  getBookingById: asyncHandler(async (req: Request, res: Response) => {
    const vendorId = (req as any).user.id;
    const { bookingId } = req.params;

const vendor = await VendorService.getVendorById(vendorId);
        if (vendor?.adminApproveVerification !== 'approved') {
          return errorResponse(res, "Vendor KYC not approved. Cannot create listing.", 403);
        }

    const booking = await BookingService.getBookingById(bookingId);
    if (!booking) return errorResponse(res, "Booking not found", 404);

    return successResponse(res, { booking }, "Booking retrieved successfully");
  }),

  /**
   * Forgot Password - Send OTP to email
   */
  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const vendor = await VendorService.getVendorByEmail(email);
    if (!vendor) return errorResponse(res, "Vendor not found", 404);

    // Generate OTP
    if (!vendor.phone) return errorResponse(res, "Vendor phone not found", 400);
    const otp = await OtpService.issueOtp(vendor.phone as string, "reset-password");

    // Emit event to send email
    emitter.emit("forgot_password", { email, otp });

    return successResponse(res, {}, "Password reset OTP sent to your email");
  }),

  /**
   * Reset Password - Verify OTP and update password
   */
  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;

    const vendor = await VendorService.getVendorByEmail(email);
    if (!vendor) return errorResponse(res, "Vendor not found", 404);

    // Find OTP
    const existingOtp = await OtpService.findOneOtpEmailAndPurpose(email, "reset-password");
    if (!existingOtp) return errorResponse(res, "OTP not found or expired", 400);

    // Verify OTP
    if (!existingOtp.otp) return errorResponse(res, "Invalid OTP", 400);
    const isOtpValid = await OtpService.verifyOtpHash(otp, existingOtp.otp as string);
    if (!isOtpValid) return errorResponse(res, "Invalid OTP", 400);

    // Hash new password
    const hashedPassword = await hash(newPassword);

    // Update vendor password
    await VendorService.updateVendor((vendor._id as any).toString(), { password: hashedPassword });

    // Delete OTP
    await OtpService.deleteOtpByEmail(email, "reset-password");

    return successResponse(res, {}, "Password reset successfully");
  }),
};
