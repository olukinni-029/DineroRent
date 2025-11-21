import { Router } from 'express';
import { WebHookController } from '../controllers/webhook.controller';

const router = Router();

// Webhook endpoint for Flutterwave
router.post('/flutterwave', WebHookController.create);

export default router;
