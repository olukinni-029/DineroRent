import { Request, Response } from 'express';
import asyncOps from '../utils/async_handler';
import crypto from 'crypto';
import { BookingService } from '../services/booking.service';
import emitter from '../utils/common/eventEmitter';
import BookingModel from '../models/Booking.model';

export const WebHookController = {
  handlePaystackWebhook: asyncOps(async (req: Request, res: Response) => {
    const secret = process.env.PAYSTACK_SECRET_KEY!;
    const signature = req.headers['x-paystack-signature'] as string;

    // ✅ Verify webhook authenticity
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== signature) {
      console.error('[Paystack Webhook] Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const { reference, amount, status, metadata, recipient } = event.data || {};

    console.log(`🔔 [Paystack Webhook] Event: ${event.event}`);

    switch (event.event) {
      /**
       * 🔹 1. USER PAYMENT SUCCESS (charge.success)
       * Triggered when a user successfully pays through Paystack Checkout
       */
      case 'charge.success':
        if (status === 'success' && metadata?.bookingId) {
          console.log(`💰 Payment confirmed for booking ${metadata.bookingId}`);
          await BookingService.completeBookingPayment(reference, metadata.bookingId);
        }
        break;

      /**
       * 🔹 2. VENDOR TRANSFER SUCCESS (transfer.success)
       * Triggered when payout to vendor completes successfully
       */
      case 'transfer.success':
        if (reference) {
          const booking = await BookingModel.findOneAndUpdate(
            { transactionReference: reference },
            { paymentStatus: 'released' },
            { new: true }
          );

          if (booking) {
            console.log(`✅ Transfer successful for booking ${booking._id}`);
            emitter.emit('booking:payment:released', {
              bookingId: booking._id,
              vendorId: booking.vendorId,
              amount: amount / 100,
            });
          }
        }
        break;

      /**
       * 🔹 3. VENDOR TRANSFER FAILED (transfer.failed)
       */
      case 'transfer.failed':
        if (reference) {
          await BookingModel.findOneAndUpdate(
            { transactionReference: reference },
            { paymentStatus: 'transfer_failed' }
          );
          console.warn(`❌ Transfer failed for reference ${reference}`);
          emitter.emit('booking:payment:failed', { reference });
        }
        break;

      /**
       * 🔹 4. VENDOR TRANSFER REVERSED (transfer.reversed)
       * Funds have been returned to the platform balance
       */
      case 'transfer.reversed':
        if (reference) {
          await BookingModel.findOneAndUpdate(
            { transactionReference: reference },
            { paymentStatus: 'reversed' }
          );
          console.warn(`⚠️ Transfer reversed for reference ${reference}`);
          emitter.emit('booking:payment:reversed', { reference });
        }
        break;

      /**
       * 🔹 5. REFUND SUCCESS (refund.processed)
       */
      case 'refund.processed':
        if (metadata?.bookingId) {
          await BookingModel.findByIdAndUpdate(metadata.bookingId, {
            paymentStatus: 'refunded',
          });
          console.log(`💸 Refund processed for booking ${metadata.bookingId}`);
          emitter.emit('booking:payment:refunded', {
            bookingId: metadata.bookingId,
            amount: amount / 100,
          });
        }
        break;

      /**
       * 🔹 6. REFUND FAILURE (refund.failed)
       */
      case 'refund.failed':
        if (metadata?.bookingId) {
          await BookingModel.findByIdAndUpdate(metadata.bookingId, {
            paymentStatus: 'refund_failed',
          });
          console.warn(`❌ Refund failed for booking ${metadata.bookingId}`);
          emitter.emit('booking:payment:refund_failed', { bookingId: metadata.bookingId });
        }
        break;

      default:
        console.log(`[Paystack Webhook] Unhandled event: ${event.event}`);
        break;
    }

    // ✅ Respond to Paystack
    res.sendStatus(200);
  }),
};
