import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler";
import { compare } from "../utils/hashes/hasher";
import { generateToken } from "../utils/hashes/jwthandler";
import { successResponse, errorResponse } from "../utils/response";
import { UserService } from "../services/user.service";
import { ListingService } from "../services/listing.service";
import { BookingService } from "../services/booking.service";
import { verifyPaystackPayment } from "../utils/payment";
import TransactionModel from "../models/Transaction.model";
import UserModel from "../models/User.model";
import VendorModel from "../models/Vendor.model";

export const userController = {
  // Register new user (no OTP)
  registerUser: asyncHandler(async (req: Request, res: Response) => {
    const { payload } = req.body;

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
      "1h"
    );

    return successResponse(
      res,
      { user, token },
      "User registered successfully"
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
      "1h"
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
      "Profile updated successfully"
    );
  }),

  /**
   * Get all active listings (for users)
   * Supports filters by type, location, price range, and verification status
   */
  getAllListings: asyncHandler(async (req: Request, res: Response) => {
    const { type, location, minPrice, maxPrice, verifiedOnly, page, limit } = req.query;

    const filters: any = {};

    if (type) filters.type = type;
    if (location)
      filters.location = { $regex: new RegExp(location.toString(), "i") };
    if (minPrice || maxPrice) {
      filters.pricePerDay = {};
      if (minPrice) filters.pricePerDay.$gte = Number(minPrice);
      if (maxPrice) filters.pricePerDay.$lte = Number(maxPrice);
    }
    const vendorFilter: any = {};
    if (verifiedOnly === "true") vendorFilter.kycStatus = "approved";

    const vendors = await VendorModel.find(vendorFilter).select("_id");
    const admins = await UserModel.find().select("_id");

    const allowedIds = [
      ...vendors.map((v) => v._id),
      ...admins.map((a) => a._id),
    ];

    // ✅ Filter listings created by either
    filters.createdBy = { $in: allowedIds };

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const result = await ListingService.getAllListings(filters, pageNum, limitNum);
    return successResponse(
      res,
      result,
      "Listings retrieved successfully"
    );
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

    const booking = await BookingService.createBooking({
      userId,
      listingId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    return successResponse(res, { booking }, "Booking created successfully");
  }),

  /**
   * Process payment for booking
   */
  processBookingPayment: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { bookingId, paymentMethod } = req.body;

    // Verify booking belongs to user
    const booking = await BookingService.getBookingById(bookingId, userId);
    if (!booking) return errorResponse(res, "Booking not found", 404);

    // Initiate payment (don't complete it yet)
    const paymentData = await BookingService.initiateBookingPayment(
      bookingId,
      paymentMethod,
      userId
    );

    return successResponse(
      res,
      {
        paymentLink: paymentData.paymentLink,
        reference: paymentData.reference,
        transactionId: paymentData.transactionId,
      },
      "Payment initiated. Please complete payment at the provided link"
    );
  }),

  /**
   * Check-in to booking
   */
  checkInBooking: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { bookingId } = req.params;

    const booking = await BookingService.checkInBooking(bookingId, userId);

    return successResponse(res, { booking }, "Check-in successful");
  }),

  /**
   * Get user bookings
   */
  getUserBookings: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const bookings = await BookingService.getUserBookings(userId);

    return successResponse(
      res,
      { bookings },
      "Bookings retrieved successfully"
    );
  }),

  /**
   * Get single booking details
   */
  getBookingById: asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { bookingId } = req.params;

    const booking = await BookingService.getBookingById(bookingId, userId);
    if (!booking) return errorResponse(res, "Booking not found", 404);

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
      reason
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
    const verification = await verifyPaystackPayment(reference);

    if (
      verification.status === true &&
      verification.data.status === "success"
    ) {
      const bookingId = transaction.metadata.bookingId;
      const booking = await BookingService.completeBookingPayment(
        reference,
        bookingId
      );

      return successResponse(res, { booking }, "Payment verified successfully");
    }

    return errorResponse(res, "Payment not completed", 400);
  }),
};
