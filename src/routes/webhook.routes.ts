import { Router } from 'express';
import { WebHookController } from '../controllers/webhook.controller';

const router = Router();

// Webhook endpoint for Flutterwave
router.post('/flutterwave', WebHookController.handlePaystackWebhook);

export default router;
