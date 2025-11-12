import ListingModel, { IListing } from '../models/Listing.model';
import mongoose from 'mongoose';

export class ListingService {
  // Create new listing
  public static async createListing(data: IListing): Promise<IListing> {
    return ListingModel.create(data);
  }

  // Get all listings (with filters)
  public static async getAllListings(filters: any = {}): Promise<IListing[]> {
    const query: any = { isActive: true, isApproved: true };

    if (filters.type) query.type = filters.type;
    if (filters.location) query.location = { $regex: filters.location, $options: 'i' };
    if (filters.minPrice || filters.maxPrice) {
      query.pricePerDay = {};
      if (filters.minPrice) query.pricePerDay.$gte = filters.minPrice;
      if (filters.maxPrice) query.pricePerDay.$lte = filters.maxPrice;
    }

    return ListingModel.find(query)
      .populate('vendor', 'firstName lastName businessName kycStatus')
      .sort({ createdAt: -1 });
  }

  // Get single listing by ID
  public static async getListingById(id: string): Promise<IListing | null> {
    const objId = new mongoose.Types.ObjectId(id);
    return ListingModel.findById(objId).populate('vendor', 'firstName lastName email kycStatus');
  }

  // Update listing (vendor only)
  public static async updateListing(id: string, vendorId: string, data: Partial<IListing>): Promise<IListing | null> {
    return ListingModel.findOneAndUpdate(
      { _id: id, vendor: vendorId },
      data,
      { new: true }
    );
  }

  // Delete listing (vendor only)
  public static async deleteListing(id: string, vendorId: string): Promise<IListing | null> {
    return ListingModel.findOneAndDelete({ _id: id, vendor: vendorId });
  }

  // Admin: approve or reject listing
  public static async setApprovalStatus(id: string, status: boolean): Promise<IListing | null> {
    return ListingModel.findByIdAndUpdate(id, { isApproved: status }, { new: true });
  }

  static async updateAvailability(id: string, vendorId: string, availability: any[]) {
    const listing = await ListingModel.findOne({ _id: id, vendor: vendorId });
    if (!listing) return null;

    // Replace or merge the availability array
    listing.availability = availability;
    await listing.save();
    return listing;
  }

   static async approveListing(id: string, approve: boolean) {
    return ListingModel.findByIdAndUpdate(
      id,
      { isApproved: approve },
      { new: true }
    );
  }
}
