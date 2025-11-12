import mongoose, { Document, Schema } from 'mongoose';

export interface IVendor{
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  kycStatus?: 'pending' | 'approved' | 'rejected';
  fullLegalName?: string;
  nin?: string;
  businessName?: string;
  cacCertificate?: string; // File path or URL
  ownershipProof?: string; // File path or URL
  images?: string[]; // Array of file paths or URLs
  address?: string;
  bankDetails?: {
    accountNumber: string;
    bankName: string;
    bvn?: string;
  };
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorDocument = IVendor & Document;

const VendorSchema = new Schema<VendorDocument>({
  firstName: { type: String},
  lastName: { type: String},
  email: { type: String,unique: true },
  phone: { type: String,unique: true },
  password: { type: String },
  kycStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  fullLegalName: { type: String },
  nin: { type: String },
  businessName: { type: String },
  cacCertificate: { type: String },
  ownershipProof: { type: String },
  images: [{ type: String }],
  address: { type: String },
  bankDetails: {
    accountNumber: { type: String },
    bankName: { type: String },
    bvn: { type: String },
  },
  bio: { type: String },
}, {
  timestamps: true,
});

const VendorModel = mongoose.model<VendorDocument>("Vendor", VendorSchema);

export default VendorModel;
