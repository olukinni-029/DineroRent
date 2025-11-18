import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware, authorizeRoles } from '../middlewares/auth.middleware';
import { validate, schemas } from '../utils/validator';

const router = Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);

// Apply role authorization for admin only
router.use(authorizeRoles('admin'));

// Admin routes for vendor management
router.put('/approve-vendor/:vendorId', adminController.approveVendor);
router.put('/reject-vendor/:vendorId', validate(schemas.rejectVendor), adminController.rejectVendor);

// Admin routes for listing management
router.put('/approve-listing/:id', validate(schemas.approveListing), adminController.approveListing);

// Admin routes for full listing CRUD
router.get('/listings', adminController.getAllListings);
router.get('/listings/:id', adminController.getListingById);
router.post('/listings', adminController.createListing);
router.put('/listings/:id', adminController.updateListing);
router.delete('/listings/:id', adminController.deleteListing);
router.put('/listings/:id/availability', adminController.updateAvailability);

// Admin routes for booking management
router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getBookingById);
router.put('/bookings/:id/status', adminController.updateBookingStatus);

export default router;
