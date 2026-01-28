import mongoose from 'mongoose';

export interface IOtp {
  phone?: string;
  email?: string;
  otp: string;
  purpose: string;
  expiresAt?: Date;
}

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
  },
  email: {
    type: String,
  },
  otp: {
    type: String,
  },
  purpose: {
    type: String,
  },
  expiresAt: { type: Date, index: { expires: "5 min" } },
},{
  timestamps: true
});

const OtpModel = mongoose.model('Otp', otpSchema);

export default OtpModel;
