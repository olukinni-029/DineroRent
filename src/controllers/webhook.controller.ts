import { Request, Response } from 'express';
import asyncOps from '../utils/async_handler';
import { successResponse } from '../utils/response';
import TransactionModel from '../models/Transaction.model';
import BookingModel from '../models/Booking.model';
import emitter from '../utils/common/eventEmitter';

export const WebHookController = {
  create: asyncOps(async (req: Request, res: Response) => {
    const signature = req.headers["verif-hash"] as string;

    console.log("FROM WEBHOOK =============================================================");

    if (!signature || signature !== (process.env.FLUTTERWAVE_SECRET_HASH as string)) {
      return res.status(401).send("Unauthorized.");
    }

    const payload = req.body;
    console.log({ "==============================": payload });

    if (payload.event === "charge.completed" && payload.data.status === "successful") {
      const { tx_ref, amount, currency, customer, payment_type } = payload.data;

      // ✅ Find existing transaction
      const transaction = await TransactionModel.findOne({ reference: tx_ref });
      if (!transaction) {
        console.error("Transaction not found for tx_ref:", tx_ref);
        return res.status(404).send("Transaction not found");
      }

      if (transaction.status === "completed") {
        console.log("Transaction already completed:", tx_ref);
        return res.status(200).send("Already processed");
      }

      // ✅ Update transaction record
      transaction.status = "completed";
      transaction.currency = currency;
      transaction.paymentMethod = payment_type;
      transaction.metadata = payload.data;
      await transaction.save();

      // ✅ Update booking payment status if it's a booking payment
      if (transaction.metadata?.bookingId) {
        const booking = await BookingModel.findById(transaction.metadata.bookingId);
        if (booking) {
          booking.paymentStatus = 'paid';
          booking.transactionId = transaction._id.toString();
          await booking.save();

          // Emit payment completed event
          emitter.emit('booking:payment_completed', {
            bookingId: booking._id,
            userId: booking.userId,
            vendorId: booking.vendorId,
            amount: transaction.amount
          });
        }
      }

      console.log("Transaction updated:", transaction);
    }

    return res.status(200).send("Webhook received");
  }),
};
