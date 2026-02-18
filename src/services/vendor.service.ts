import mongoose from 'mongoose';
import VendorModel, { IVendor } from '../models/Vendor.model';
import { hash } from '../utils/hashes/hasher';
import { verifyKYC } from './kyc.service';
import emitter from '../utils/common/eventEmitter';
import logger from '../utils/logger';
import { CustomError, NotFoundError, ValidationError } from '../utils/customError';

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
  if (!vendor) throw new NotFoundError('Vendor not found');

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

  // Decide which fields actually need verification by comparing submitted values
  const submittedFields: string[] = [];
  const messages: string[] = [];

  if (kycData.nin !== undefined) {
    if (vendor.nin && vendor.nin === kycData.nin && vendor.kycProgress?.nin?.status === 'verified') {
      messages.push('NIN is already verified');
    } else {
      submittedFields.push('nin');
    }
  }

  if (kycData.phone !== undefined) {
    if (vendor.phone && vendor.phone === kycData.phone && vendor.kycProgress?.phone?.status === 'verified') {
      messages.push('Phone number is already verified');
    } else {
      submittedFields.push('phone');
    }
  }

  if (kycData.verificationImages?.cacCertificate !== undefined) {
    const existingCac = vendor.verificationImages?.cacCertificate;
    if (existingCac && existingCac === kycData.verificationImages.cacCertificate && vendor.kycProgress?.cac?.status === 'verified') {
      messages.push('CAC certificate is already verified');
    } else {
      submittedFields.push('cac');
    }
  }

  if (kycData.bankDetails !== undefined) {
    const b = (vendor.bankDetails || {}) as Partial<IVendor['bankDetails']>;
    const newB = (kycData.bankDetails || {}) as Partial<IVendor['bankDetails']>;

    const nbAcc = newB?.accountNumber;
    const nbBank = newB?.bankName;
    const nbBvn = newB?.bvn;

    const bAcc = b?.accountNumber;
    const bBank = b?.bankName;
    const bBvn = b?.bvn;

    const bankUnchanged =
      (nbAcc === undefined || nbAcc === bAcc) &&
      (nbBank === undefined || nbBank === bBank) &&
      (nbBvn === undefined || nbBvn === bBvn);

    if (bankUnchanged && vendor.kycProgress?.bank?.status === 'verified') {
      messages.push('Bank details are already verified');
    } else {
      submittedFields.push('bank');
    }
  }

  // Set in_progress only when there's something to verify
  if (submittedFields.length > 0) {
    (updatePayload as any).kycStatus = 'in_progress';
  }

  const updatedAfterSubmit = await VendorModel.findByIdAndUpdate(
    id,
    { $set: updatePayload },
    { new: true }
  );

  try {
    // If nothing requires verification, return current vendor and messages
    if (submittedFields.length === 0) {
      return {
        success: true,
        messages,
        vendor: updatedAfterSubmit ? updatedAfterSubmit.toObject() : vendor.toObject(),
      };
    }

    // Run verification only for the fields that changed / need checking
    const verificationResult = await verifyKYC(id, { submittedFields });

    // Persist verification status/progress and build user-facing messages
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

    // Add verification results for submitted fields to messages
    const fieldLabels: Record<string, string> = {
      nin: 'NIN',
      phone: 'Phone number',
      cac: 'CAC certificate',
      bank: 'Bank details',
    };

    for (const f of submittedFields) {
      const p = (verificationResult.progress as any)?.[f];
      if (!p) continue;
      if (p.status === 'verified') {
        messages.push(`${fieldLabels[f] || f} verified${p.reason ? `: ${p.reason}` : ''}`);
      } else {
        messages.push(`${fieldLabels[f] || f} verification failed${p.reason ? `: ${p.reason}` : ''}`);
      }
    }

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
      messages,
      vendor: updatedVendor ? updatedVendor.toObject() : (updatedAfterSubmit ? updatedAfterSubmit.toObject() : vendor.toObject()),
    };
  } catch (error: any) {
    logger.error('KYC submission error:', { vendorId: id, error: error?.message || error });
    throw new CustomError(error?.message || 'Unexpected KYC processing error');
  }
}


  public static async approveVendor(id: string) {
    return  VendorModel.findByIdAndUpdate(id, { adminApproveVerification: 'approved' }, { new: true });
  }

  public static async rejectVendor(id: string, reason?: string) {
  return VendorModel.findByIdAndUpdate(
    id,
    { adminApproveVerification: 'rejected', rejectionReason: reason },
    { new: true }
  );
   }

  public static async getAllVendors(page: number = 1, limit: number = 10): Promise<{ vendors: IVendor[], total: number, page: number, pages: number }> {
    const skip = (page - 1) * limit;
    const [vendors, total] = await Promise.all([
      VendorModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      VendorModel.countDocuments()
    ]);
    const pages = Math.ceil(total / limit);
    return { vendors, total, page, pages };
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
