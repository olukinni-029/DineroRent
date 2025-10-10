import { Router } from 'express';
import { getListings, createListing } from '../controllers/listing.controller';

const router = Router();

router.get('/', getListings);
router.post('/', createListing);

export default router;
