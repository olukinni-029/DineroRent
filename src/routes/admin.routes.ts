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

export default router;
