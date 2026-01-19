import mongoose, { Document, Schema } from 'mongoose';

export interface IVendor {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  kycStatus?: 'pending'| 'verified'|'failed'| 'partially_verified'|'in_progress';
  fullLegalName?: string;
  nin?: string;
  role?: string;
  businessName?: string;
  images?: string[]; // general product/property images
  verificationImages?: {
    idCard?: string;           // government-issued ID (required)
    cacCertificate?: string;   // CAC document (optional)
    ownershipProof?: string;   // proof of business/property ownership (required)
  };
  businessAddress?: {
    lat: number;
    lng: number;
  };
  bankDetails?: {
    accountNumber: string;
    bankName: string;
    bvn?: string;
  };
  paystackRecipientCode?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
  adminApproveVerification?:'pending' | 'approved' | 'rejected' ;
  kycProgress: {
  nin?: { status: 'pending' | 'verified' | 'failed'; reason?: string };
  phone?: { status: 'pending' | 'verified' | 'failed'; reason?: string };
  cac?: { status: 'pending' | 'verified' | 'failed'; reason?: string };
  bank?: { status: 'pending' | 'verified' | 'failed'; reason?: string };
},

}

export type VendorDocument = IVendor & Document;

const VendorSchema = new Schema<VendorDocument>(
  {
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String, unique: true, required: true },
    phone: { type: String, unique: true },
    password: { type: String },
    kycStatus: {
      type: String,
      enum: ['pending', 'verified',"failed", 'partially_verified',"in_progress"],
      default: 'pending',
    },
    fullLegalName: { type: String },
    nin: { type: String },
    role: { type: String, default: 'vendor' },
    businessName: { type: String },

    // ✅ Structured KYC-related uploads
    verificationImages: {
      idCard: { type: String },
      cacCertificate: { type: String },
      ownershipProof: { type: String },
    },

    // ✅ General vendor images (optional)
    images: [{ type: String }],

    businessAddress: {
      lat: { type: Number },
      lng: { type: Number },
    },
    bankDetails: {
      accountNumber: { type: String },
      bankName: { type: String },
      bvn: { type: String },
    },
    bio: { type: String },
    adminApproveVerification:{
       type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    paystackRecipientCode: { type: String },
    kycProgress: {
      nin: {
        status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
        reason: { type: String },
      },
      phone: {
        status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
        reason: { type: String },
      },
      cac: {
        status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
        reason: { type: String },
      },
      bank: {
        status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
        reason: { type: String },
      },
    },
  },
  {
    timestamps: true,
  }
);

const VendorModel = mongoose.model<VendorDocument>('Vendor', VendorSchema);

export default VendorModel;
