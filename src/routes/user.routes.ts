import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authMiddleware, authorizeRoles } from '../middlewares/auth.middleware';
import { validate, schemas } from '../utils/validator';

const router = Router();

// Public routes
router.post('/register', validate(schemas.registerUser), userController.registerUser);
router.post('/login', validate(schemas.loginUser), userController.loginUser);

// Public listing routes (no authentication required)
router.get('/listings', userController.getAllListings);
router.get('/listings/:id', userController.getListingById);

// Protected routes (require authentication)
router.use(authMiddleware);

// User-specific routes (require 'user' role)
router.use(authorizeRoles('user'));
router.get('/profile', userController.getProfile);
router.put('/profile', validate(schemas.updateProfile), userController.updateProfile);

export default router;
