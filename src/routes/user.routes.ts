import { Router } from 'express';
import { getUser, updateUser } from '../controllers/user.controller';

const router = Router();

router.get('/:id', getUser);
router.put('/:id', updateUser);

export default router;
