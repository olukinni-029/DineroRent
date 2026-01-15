import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware, authorizeRoles, authorizeAdminRoles } from '../middlewares/auth.middleware';
import { validate, schemas } from '../utils/validator';

const router = Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);

// Admin routes for vendor management
router.post('/vendors/:vendorId/approve', authorizeAdminRoles('vendor_verification_admin'), adminController.approveVendor);
router.post('/vendors/:vendorId/reject', authorizeAdminRoles('vendor_verification_admin'), validate(schemas.rejectVendor), adminController.rejectVendor);

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

// User Management Routes (Super Admin only)
router.get('/users', authorizeAdminRoles('super_admin'), adminController.getAllUsers);
router.get('/users/:id', authorizeAdminRoles('super_admin'), adminController.getUserById);
router.put('/users/:id/role', authorizeAdminRoles('super_admin'), adminController.updateUserRole);
router.put('/users/:id/deactivate', authorizeAdminRoles('super_admin'), adminController.deactivateUser);
router.put('/users/:id/activate', authorizeAdminRoles('super_admin'), adminController.activateUser);
router.put('/users/:id/suspend', authorizeAdminRoles('super_admin'), adminController.suspendUser);
router.put('/users/:id/unsuspend', authorizeAdminRoles('super_admin'), adminController.unsuspendUser);
router.post('/users/admin', authorizeAdminRoles('super_admin'), adminController.createAdminUser);

// Vendor Verification Admin Routes
router.get('/vendors/pending', authorizeAdminRoles('vendor_verification_admin'), adminController.getPendingVendors);
router.get('/vendors', authorizeAdminRoles('vendor_verification_admin'), adminController.getAllVendors);
router.get('/vendors/:vendorId', authorizeAdminRoles('vendor_verification_admin'), adminController.getVendorById);

// Finance Admin Routes
router.get('/transactions', authorizeAdminRoles('finance_admin'), adminController.getAllTransactions);
router.get('/revenue-report', authorizeAdminRoles( 'finance_admin'), adminController.getRevenueReport);
router.post('/payout', authorizeAdminRoles('finance_admin'), adminController.processPayout);

// System Stats (Super Admin)
router.get('/stats', authorizeAdminRoles('super_admin'), adminController.getSystemStats);

export default router;
