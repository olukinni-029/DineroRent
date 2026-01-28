import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authMiddleware, authorizeRoles } from '../middlewares/auth.middleware';
import { validate, schemas } from '../utils/validator';

const router = Router();

// Public routes
router.post('/register', validate(schemas.registerUser), userController.registerUser);
router.post('/login', validate(schemas.loginUser), userController.loginUser);
router.post('/forgot-password', validate(schemas.forgotPassword), userController.forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), userController.resetPassword);

// Public listing routes (no authentication required)
router.get('/listings', userController.getAllListings);
router.get('/listings/:id', userController.getListingById);

// Protected routes (require authentication)
router.use(authMiddleware);

// User-specific routes (require 'user' role)
router.use(authorizeRoles('user'));
router.get('/profile', userController.getProfile);
router.put('/profile', validate(schemas.updateProfile), userController.updateProfile);

// Booking routes
router.post('/:listingId/bookings', userController.createBooking);
router.post('/bookings/:bookingId/payment', userController.processBookingPayment);
router.post('/bookings/:bookingId/checkin', userController.checkInBooking);
router.get('/bookings', userController.getUserBookings);
router.get('/bookings/:bookingId', userController.getBookingById);
router.post('/bookings/:bookingId/cancel', userController.cancelBooking);

// Review routes
router.post('/listings/:id/review', validate(schemas.addReview), userController.addReview);

export default router;
