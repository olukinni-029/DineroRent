import { Router } from 'express';
import { getAdminData } from '../controllers/admin.controller';

const router = Router();

router.get('/data', getAdminData);

export default router;
