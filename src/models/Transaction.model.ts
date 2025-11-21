import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
bookingId?: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  reference: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  type: 'topup' | 'booking' | 'payout' | 'refund';
  paymentMethod?: string;
  description?: string;
  transactionLink?: string;
  metadata?: any;
  logId?: mongoose.Types.ObjectId;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  reference: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'in_escrow', 'completed', 'failed', 'cancelled', 'refunded'], default: 'pending' },
  type: { type: String, enum: ['topup', 'booking', 'payout', 'refund'], required: true },
  paymentMethod: String,
  description: String,
  transactionLink: String,
  metadata: Schema.Types.Mixed,
  logId: { type: Schema.Types.ObjectId, ref: 'SocialLog' },
}, { timestamps: true });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);

TransactionSchema.index({ userId: 1 });
TransactionSchema.pre('save', function(next) {
  if (!this.reference) this.reference = `TX-${new mongoose.Types.ObjectId()}`;
  next();
});
