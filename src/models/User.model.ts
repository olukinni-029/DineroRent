import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: 'user' | 'super_admin' | 'vendor_verification_admin' | 'finance_admin' | 'support_admin';
  avatar?: string;
  username?: string;
  deactivated?: boolean;
  suspended?: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    firstName: { type: String},
    lastName: { type: String },
    email: { type: String, unique: true },
    phone: { type: String, unique: true },
    password: { type: String,},
    role: { type: String, enum: ['user', 'super_admin', 'vendor_verification_admin', 'finance_admin', 'support_admin'], default: 'user' },
    avatar: { type: String },
    username: { type: String, unique: true },
    deactivated: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
