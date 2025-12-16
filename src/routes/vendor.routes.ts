import { Router } from 'express';
import { vendorController } from '../controllers/vendor.controller';
import { authMiddleware, authorizeRoles } from '../middlewares/auth.middleware';
import { validate, schemas } from '../utils/validator';
import {upload} from "../utils/file_handler/multer";

const router = Router();

// Public routes
router.post('/register', validate(schemas.registerVendor), vendorController.registerVendor);
router.post('/verify-otp', validate(schemas.verifyVendorOtp), vendorController.verifyVendorOtp);
router.post('/login', validate(schemas.loginVendor), vendorController.loginVendor);

// Protected routes (require authentication)
router.use(authMiddleware); // Apply auth to all below routes

// Vendor-specific routes (require 'vendor' role)
router.use(authorizeRoles('vendor'));
router.post('/kyc', validate(schemas.submitKYC),upload.fields([
    { name: 'idCard', maxCount: 1 },
    { name: 'cacCertificate', maxCount: 1 },
    { name: 'ownershipProof', maxCount: 1 },
  ]), vendorController.submitKYC);
router.get('/profile', vendorController.getVendorProfile);
router.put('/profile', validate(schemas.updateVendorProfile), vendorController.updateVendorProfile);

// Listing management routes (Vendor only)
router.post('/listings', validate(schemas.createListing), vendorController.createListing);
router.put('/listings/:id', validate(schemas.updateListing), vendorController.updateListing);
router.delete('/listings/:id', vendorController.deleteListing);
router.put('/listings/:id/availability', validate(schemas.updateAvailability), vendorController.updateAvailability);

// Booking management routes (Vendor only)
router.post('/bookings/:bookingId/confirm', vendorController.confirmBooking);
router.post('/bookings/:bookingId/reject', vendorController.rejectBooking);
router.get('/bookings', vendorController.getVendorBookings);
router.get('/bookings/:bookingId', vendorController.getBookingById);

export default router;
