import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler";
import { compare, hash } from "../utils/hashes/hasher";
import { generateToken } from "../utils/hashes/jwthandler";
import { successResponse, errorResponse } from "../utils/response";
import { UserService } from "../services/user.service";
import { ListingService } from "../services/listing.service";
import { BookingService } from "../services/booking.service";
import { OtpService } from "../services/otp.service";
import emitter from "../utils/common/eventEmitter";
import { verifyPaystackPayment } from "../utils/payment";
import TransactionModel from "../models/Transaction.model";
import UserModel from "../models/User.model";
import VendorModel from "../models/Vendor.model";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../utils/customError";

export const userController = {
  // Register new user (no OTP)
  registerUser: asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;

    // Check if email or phone already exists
    const existingEmail = await UserService.getUserByEmail(payload.email);
    if (existingEmail) return errorResponse(res, "Email already exists", 400);

    const existingPhone = await UserService.getUserByPhone(payload.phone);
    if (existingPhone)
      return errorResponse(res, "Phone number already exists", 400);

    // Create user
    const user = await UserService.createUser({ ...payload });

    // Generate token
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const token = generateToken(
      tokenPayload,
      process.env.JWT_SECRET || "defaultSecret",
      "24h",
    );

    return successResponse(
      res,
      { user, token },
      "User registered successfully",
    );
  }),

  // Login user
  loginUser: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await UserService.getUserByEmail(email);
    if (!user) return errorResponse(res, "Invalid credentials", 401);

    const isPasswordMatch = await compare(password, user.password);
    if (!isPasswordMatch) return errorResponse(res, "Invalid credentials", 401);

    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const token = generateToken(
      tokenPayload,
      process.env.JWT_SECRET || "defaultSecret",
      "24h",
    );

    return successResponse(res, { user, token }, "Login successful");
  }),

  // Get user profile
  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const user = await UserService.getUserById(userId);
    if (!user) return errorResponse(res, "User not found", 404);

    return successResponse(res, { user }, "Profile retrieved successfully");
  }),

  // Update user profile
  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const updateData = req.body;

    const updatedUser = await UserService.updateUser(userId, updateData);
    if (!updatedUser) return errorResponse(res, "User not found", 404);

    return successResponse(
      res,
      { user: updatedUser },
      "Profile updated successfully",
    );
  }),

  /**
   * Get all active listings (for users)
   * Supports filters by type, location, price range, and verification status
   */
  getAllListings: asyncHandler(async (req: Request, res: Response) => {
    const { type, location, minPrice, maxPrice, verifiedOnly, page, limit } =
      req.query;

    const filters: any = {};

    if (type) filters.type = type;
    if (location) {
      filters.location = location.toString();
    }
    if (minPrice || maxPrice) {
      filters.pricePerDay = {};
      if (minPrice) filters.pricePerDay.$gte = Number(minPrice);
      if (maxPrice) filters.pricePerDay.$lte = Number(maxPrice);
    }

    // Filter by verified vendors only if requested
    if (verifiedOnly === "true") {
      const vendors = await VendorModel.find({ kycStatus: "approved" }).select(
        "_id",
      );
      const allowedIds = vendors.map((v) => v._id);
      if (allowedIds.length > 0) {
        filters.createdBy = { $in: allowedIds };
      }
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const result = await ListingService.getAllListings(
      filters,
      pageNum,
      limitNum,
    );
    return successResponse(res, result, "Listings retrieved successfully");
  }),

  /**
   * Get a single listing (for users)
   */
  getListingById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const listing = await ListingService.getListingById(id);
    if (!listing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing }, "Listing retrieved successfully");
  }),

  /**
   * Create a booking
   */
  createBooking: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { startDate, endDate } = req.body;

    const { listingId } = req.params;

    try {
      const booking = await BookingService.createBooking({
        userId,
        listingId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      return successResponse(res, { booking }, "Booking created successfully");
    } catch (error: any) {
      if (error.message === "Listing not available for selected dates") {
        return errorResponse(res, error.message, 400);
      }
      throw error; // Re-throw other errors to be handled by asyncHandler
    }
  }),

  /**
   * Process payment for booking
   */
  processBookingPayment: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { bookingId } = req.params;

    // Find the booking using the service
    const booking = await BookingService.getBookingById(bookingId);

    if (!booking) {
      return errorResponse(res, "Booking not found", 404);
    }

    // Verify user owns the booking
    // Handle both populated and unpopulated userId
    const bookingUserId = booking.userId?._id
      ? booking.userId._id.toString()
      : booking.userId.toString();

    if (bookingUserId !== userId) {
      return errorResponse(res, "You don't have access to this booking", 403);
    }

    // Initiate payment
    const paymentData = await BookingService.initiateBookingPayment(
      bookingId,
      userId,
    );

    return successResponse(
      res,
      {
        paymentLink: paymentData.paymentLink,
        reference: paymentData.reference,
        transactionId: paymentData.transactionId,
      },
      "Payment initiated. Please complete payment at the provided link",
    );
  }),

  /**
   * Check-in to booking
   */
  checkInBooking: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { bookingId } = req.params;

    const booking = await BookingService.checkInBooking(bookingId, userId);
    // release payment to vendor
    await BookingService.releasePayment(bookingId);

    return successResponse(res, { booking }, "Check-in successful");
  }),

  /**
   * Get user bookings
   */
  getUserBookings: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const bookings = await BookingService.getUserBookings(userId);

    if (!bookings || bookings.length === 0) {
      return errorResponse(res, "No bookings found for this user", 404);
    }

    return successResponse(
      res,
      { bookings },
      "Bookings retrieved successfully",
    );
  }),

  /**
   * Get single booking details
   */
  getBookingById: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { bookingId } = req.params;

    // Validate bookingId
    if (!bookingId) {
      return errorResponse(res, "Booking ID is required", 400);
    }

    // Fetch booking
    const booking = await BookingService.getBookingById(bookingId);
    if (!booking) {
      return errorResponse(res, "Booking not found", 404);
    }

    // Authorization: Check if the booking belongs to the current user
   const ownerId =
    typeof booking.userId === 'object'
      ? booking.userId._id
      : booking.userId;

  if (!ownerId?.equals(userId)) {
    return errorResponse(
      res,
      'You are not authorized to view this booking',
      403
    );
  }

    // Success
    return successResponse(res, { booking }, "Booking retrieved successfully");
  }),

  /**
   * Cancel booking (user-initiated)
   */
  cancelBooking: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await BookingService.cancelBooking(
      bookingId,
      userId,
      reason,
    );

    return successResponse(res, { booking }, "Booking cancelled successfully");
  }),

  /**
   * Add or update review for a listing
   */
  addReview: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (rating < 1 || rating > 5)
      return errorResponse(res, "Rating must be between 1 and 5", 400);

    const listing = await ListingService.addReview(id, userId, rating, comment);
    if (!listing) return errorResponse(res, "Listing not found", 404);

    return successResponse(res, { listing }, "Review added successfully");
  }),

  verifyPayment: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { reference } = req.params;

    // Find transaction
    const transaction = await TransactionModel.findOne({ reference });
    if (!transaction) return errorResponse(res, "Transaction not found", 404);
    if (transaction.userId.toString() !== userId) {
      return errorResponse(res, "Unauthorized", 403);
    }

    // Verify with Paystack
    const verification = (await verifyPaystackPayment(reference)) as any;

    if (
      verification.status === true &&
      verification.data.status === "success"
    ) {
      const bookingId = transaction.metadata.bookingId;
      const booking = await BookingService.completeBookingPayment(
        reference,
        bookingId,
      );

      return successResponse(res, { booking }, "Payment verified successfully");
    }

    return errorResponse(res, "Payment not completed", 400);
  }),

  /**
   * Forgot Password - Send OTP to email
   */
  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await UserService.getUserByEmail(email);
    if (!user) return errorResponse(res, "User not found", 404);

    // Generate OTP
    const otp = await OtpService.issueOtp(email, "reset-password");

    // Emit event to send email
    emitter.emit("forgot_password", { email, otp });

    return successResponse(res, {}, "Password reset OTP sent to your email");
  }),

  /**
   * Reset Password - Verify OTP and update password
   */
  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;

    const user = await UserService.getUserByEmail(email);
    if (!user) return errorResponse(res, "User not found", 404);

    // Find OTP
    const existingOtp = await OtpService.findOneOtpEmailAndPurpose(
      email,
      "reset-password",
    );
    if (!existingOtp)
      return errorResponse(res, "OTP not found or expired", 400);

    // Verify OTP
    const isOtpValid = await OtpService.verifyOtpHash(otp, existingOtp.otp);
    if (!isOtpValid) return errorResponse(res, "Invalid OTP", 400);

    // Hash new password
    const hashedPassword = await hash(newPassword);

    // Update user password
    await UserService.updateUser(user._id.toString(), {
      password: hashedPassword,
    });

    // Delete OTP
    await OtpService.deleteOtpByEmail(email, "reset-password");

    return successResponse(res, {}, "Password reset successfully");
  }),
};
