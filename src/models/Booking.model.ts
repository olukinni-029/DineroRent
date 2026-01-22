import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
  userId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'disputed';
  paymentStatus:
    | 'pending'
    | 'paid'
    | 'escrowed'
    | 'transfer_pending'
    | 'released'
    | 'transfer_failed'
    | 'reversed'
    | 'refunded'
    | 'refund_failed'
    | 'cancelled_no_payment';
  transactionId?: string;
  cancellationReason?: string;
  transactionReference?: string;
}

const BookingSchema = new Schema<IBooking>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'disputed'],
      default: 'pending',
    },

    paymentStatus: {
      type: String,
      enum: [
        'pending',
        'paid',
        'escrowed',
        'transfer_pending',
        'released',
        'transfer_failed',
        'reversed',
        'refunded',
        'refund_failed',
        'cancelled_no_payment',
      ],
      default: 'pending',
    },

    transactionId: { type: String },
    cancellationReason: { type: String },
    transactionReference: { type: String, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<IBooking>('Booking', BookingSchema);
