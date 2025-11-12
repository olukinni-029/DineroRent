import { Router } from 'express';
import adminRoutes from './admin.routes';
import userRoutes from './user.routes';
import vendorRoutes from './vendor.routes';

const rootRouter = Router();

rootRouter.use('/admin', adminRoutes);
rootRouter.use('/user', userRoutes);
rootRouter.use('/vendor', vendorRoutes);

export default rootRouter;
