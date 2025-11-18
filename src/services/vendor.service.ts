import mongoose from 'mongoose';
import VendorModel, { IVendor } from '../models/Vendor.model';
import { hash } from '../utils/hashes/hasher';
import { verifyKYC } from './kyc.service';
import emitter from '../utils/common/eventEmitter';

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
    { ...kycData, kycStatus: 'pending' },
    { new: true }
  );
  if (vendor) {
    await verifyKYC(id); // optional background verification
    // Emit event for admin notification
    emitter.emit('kyc:submitted', {
      vendorId: vendor._id,
      vendorName: `${vendor.firstName} ${vendor.lastName}`,
      vendorEmail: vendor.email,
      businessName: vendor.businessName,
      submittedAt: new Date(),
    });
  }
  return vendor;
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
}
