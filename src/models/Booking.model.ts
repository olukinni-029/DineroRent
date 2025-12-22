import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
  userId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  listingId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'disputed';
  paymentStatus: 'pending' | 'paid' | 'escrowed' | 'released' | 'refunded';
  transactionId: string;
  cancellationReason?: string;
  transactionReference: string;
}

const BookingSchema = new Schema<IBooking>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: Schema.Types.ObjectId },
  listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  startDate: Date,
  endDate: Date,
  totalAmount: Number,
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled', 'disputed'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'escrowed', 'released', 'refunded'], default: 'pending' },
  transactionId: String,
  cancellationReason: String,
  transactionReference: { 
  type: String, 
  index: true 
}
}, { timestamps: true });

export default mongoose.model<IBooking>('Booking', BookingSchema);

