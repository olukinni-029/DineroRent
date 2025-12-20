import { Router } from 'express';
import { WebHookController } from '../controllers/webhook.controller';

const router = Router();

// Webhook endpoint for Flutterwave
router.post('/web_hook', WebHookController.handlePaystackWebhook);

export default router;
