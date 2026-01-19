import { Request, Response } from 'express';
import asyncOps from '../utils/async_handler';
import crypto from 'crypto';
import { BookingService } from '../services/booking.service';

export const WebHookController = {
  handlePaystackWebhook: asyncOps(async (req: Request, res: Response) => {
  // Verify webhook signature
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const { reference, amount, status, metadata } = event.data;
    
    if (status === 'success') {
      await BookingService.completeBookingPayment(reference, metadata.bookingId);
    }
  }

  res.status(200).send('Webhook received');
})
};
