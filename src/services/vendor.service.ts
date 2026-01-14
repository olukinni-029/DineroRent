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
  // Allow partial KYC submissions: fetch vendor first and merge nested fields
  const vendor = await VendorModel.findById(id);
  if (!vendor) return { success: false, message: 'Vendor not found' };

  const updatePayload: Partial<IVendor> = {};

  // Merge simple top-level provided fields (avoid overwriting with undefined)
  for (const key of Object.keys(kycData || {})) {
    const val = (kycData as any)[key];
    if (val === undefined) continue;
    if (key === 'verificationImages' || key === 'bankDetails') continue; // handled below
    (updatePayload as any)[key] = val;
  }

  // Merge nested verificationImages without dropping existing ones
  // Only accept `cacCertificate` from submissions (other image types are not part of this flow)
  if (kycData.verificationImages?.cacCertificate) {
    updatePayload.verificationImages = {
      ...(vendor.verificationImages || {}),
      cacCertificate: kycData.verificationImages.cacCertificate,
    };
  }

  // Merge nested bankDetails safely
  if (kycData.bankDetails) {
    updatePayload.bankDetails = {
      ...(vendor.bankDetails || {}),
      ...kycData.bankDetails,
    };
  }

  // Ensure NIN is explicitly persisted when provided
  if (kycData.nin) {
    (updatePayload as any).nin = kycData.nin;
  }

  // Always mark as in_progress when user initiates submission
  (updatePayload as any).kycStatus = 'in_progress';

  const updatedAfterSubmit = await VendorModel.findByIdAndUpdate(
    id,
    { $set: updatePayload },
    { new: true }
  );

  try {
    // Determine which KYC fields were provided in this submission
    const submittedFields: string[] = [];
    if (kycData.nin) submittedFields.push('nin');
    if (kycData.phone) submittedFields.push('phone');
    if (kycData.verificationImages?.cacCertificate) submittedFields.push('cac');
    if (kycData.bankDetails) submittedFields.push('bank');

    // Run verification only for the fields provided in this submission
    const verificationResult = await verifyKYC(id, { submittedFields });

    // Persist verification status/progress and return the fresh vendor doc
    const updatedVendor = await VendorModel.findByIdAndUpdate(
      id,
      {
        $set: {
          kycStatus: verificationResult.overallStatus,
          kycProgress: verificationResult.progress,
        },
      },
      { new: true }
    );

    const vendorFullName = `${updatedAfterSubmit?.firstName || vendor.firstName || ''} ${
      updatedAfterSubmit?.lastName || vendor.lastName || ''
    }`.trim();

    emitter.emit('kyc:submitted', {
      vendorId: id,
      vendorName: vendorFullName,
      vendorEmail: (updatedAfterSubmit && updatedAfterSubmit.email) || vendor.email,
      businessName: (updatedAfterSubmit && updatedAfterSubmit.businessName) || vendor.businessName,
      status: verificationResult.overallStatus,
      submittedAt: new Date(),
    });

    return {
      success: true,
      vendor: updatedVendor ? updatedVendor.toObject() : (updatedAfterSubmit ? updatedAfterSubmit.toObject() : vendor.toObject()),
    };
  } catch (error: any) {
    logger.error('KYC submission error:', { vendorId: id, error: error?.message || error });
    return { success: false, message: error?.message || 'Unexpected KYC processing error' };
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
