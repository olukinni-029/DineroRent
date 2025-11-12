import { Router } from 'express';
import { vendorController } from '../controllers/vendor.controller';
import { authMiddleware, authorizeRoles } from '../middlewares/auth.middleware';
import { validate, schemas } from '../utils/validator';

const router = Router();

// Public routes
router.post('/register', validate(schemas.registerVendor), vendorController.registerVendor);
router.post('/verify-otp', validate(schemas.verifyVendorOtp), vendorController.verifyVendorOtp);
router.post('/login', validate(schemas.loginVendor), vendorController.loginVendor);

// Protected routes (require authentication)
router.use(authMiddleware); // Apply auth to all below routes

// Vendor-specific routes (require 'vendor' role)
router.use(authorizeRoles('vendor'));
router.post('/kyc', validate(schemas.submitKYC), vendorController.submitKYC);
router.get('/profile', vendorController.getVendorProfile);
router.put('/profile', validate(schemas.updateVendorProfile), vendorController.updateVendorProfile);

// Listing management routes (Vendor only)
router.post('/listings', validate(schemas.createListing), vendorController.createListing);
router.put('/listings/:id', validate(schemas.updateListing), vendorController.updateListing);
router.delete('/listings/:id', vendorController.deleteListing);
router.put('/listings/:id/availability', validate(schemas.updateAvailability), vendorController.updateAvailability);

export default router;
