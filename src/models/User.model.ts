import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: 'user' | 'super_admin' | 'vendor_verification_admin' | 'finance_admin' | 'support_admin';
  avatar?: string;
  username?: string;
  phoneNumber?: string;
  deactivated?: boolean;
  suspended?: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'super_admin', 'vendor_verification_admin', 'finance_admin', 'support_admin'], default: 'user' },
    avatar: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
