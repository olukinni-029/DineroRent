import mongoose from 'mongoose';
import VendorModel, { IVendor } from '../models/Vendor.model';
import { hash } from '../utils/hashes/hasher';
import { verifyKYC } from './kyc.service';
import emitter from '../utils/common/eventEmitter';
import logger from '../utils/logger';

export class VendorService {
  public static async createVendor(vendorData:IVendor) {
    return VendorModel.create(vendorData);
  }

  public static async getVendorById(id: string){
   const convertToObjectId = new mongoose.Types.ObjectId(id);
    console.log("convertToObjectId: ", convertToObjectId);
    return VendorModel.findOne({ _id: convertToObjectId });
  }

  public static async getVendorByEmail(email: string) {
    return  VendorModel.findOne({ email });
  }

  public static async getVendorByPhone(phone: string) {
    return  VendorModel.findOne({ phone });
  }

  public static async updateVendor(id: string, updateData: Partial<IVendor>){
    return  VendorModel.findByIdAndUpdate(id, updateData, { new: true });
  }

public static async submitKYC(id: string, kycData: Partial<IVendor>) {
  const vendor = await VendorModel.findByIdAndUpdate(
    id,
    { ...kycData, kycStatus: 'in_progress' },
    { new: true }
  );

  if (!vendor) return { success: false, message: 'Vendor not found' };

  try {
    const verificationResult = await verifyKYC(id);

    await VendorModel.findByIdAndUpdate(id, {
      kycStatus: verificationResult.overallStatus,
      kycProgress: verificationResult.progress,
    });

    return {
      success: true,
      vendor: {
        ...vendor.toObject(),
        kycProgress: verificationResult.progress,
      },
    };
  } catch (error: any) {
    logger.error('KYC submission error:', { vendorId: id, error: error.message });
    return { success: false, message: error.message || 'Unexpected KYC processing error' };
  }
}



  public static async approveVendor(id: string) {
    return  VendorModel.findByIdAndUpdate(id, { kycStatus: 'approved' }, { new: true });
  }

  public static async rejectVendor(id: string, reason?: string) {
  return VendorModel.findByIdAndUpdate(
    id,
    { kycStatus: 'rejected', rejectionReason: reason },
    { new: true }
  );
   }

  public static async getAllVendors(): Promise<IVendor[]> {
    return VendorModel.find().sort({ createdAt: -1 });
  }

  public static async getPendingVendors(): Promise<IVendor[]> {
    return VendorModel.find({ kycStatus: 'pending' }).sort({ createdAt: -1 });
  }
  
  public static async getApprovedVendors(): Promise<IVendor[]> {
    return VendorModel.find({ kycStatus: 'approved' }).sort({ createdAt: -1 });
  }

  public static async getRejectedVendors(): Promise<IVendor[]> {
    return VendorModel.find({ kycStatus: 'rejected' }).sort({ createdAt: -1 });
  }
 
}
