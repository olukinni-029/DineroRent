import { Router } from 'express';
import { getVendor, createVendor } from '../controllers/vendor.controller';

const router = Router();

router.get('/:id', getVendor);
router.post('/', createVendor);

export default router;
