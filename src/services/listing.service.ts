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

  return ListingModel.find(query).sort({ createdAt: -1 });
}


  // Get single listing by ID
  public static async getListingById(id: string): Promise<IListing | null> {
    const objId = new mongoose.Types.ObjectId(id);
    const listing = await ListingModel.findById(objId)
      .populate('vendor', 'firstName lastName email kycStatus')
      .populate('ratings.user', 'firstName lastName');

    if (listing) {
      // Calculate average rating
      const ratings = listing.ratings || [];
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      // Add computed fields
      (listing as any).averageRating = averageRating;
      (listing as any).totalReviews = ratings.length;
    }

    return listing;
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

  // Admin: Get all listings (including unapproved)
  public static async getAllListingsAdmin(filters: any = {}): Promise<IListing[]> {
    const query: any = {};

    if (filters.type) query.type = filters.type;
    if (filters.location) query.location = { $regex: filters.location, $options: 'i' };
    if (filters.minPrice || filters.maxPrice) {
      query.pricePerDay = {};
      if (filters.minPrice) query.pricePerDay.$gte = filters.minPrice;
      if (filters.maxPrice) query.pricePerDay.$lte = filters.maxPrice;
    }
    if (filters.isApproved !== undefined) query.isApproved = filters.isApproved;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;

    return ListingModel.find(query)
      .populate('createdBy', 'firstName lastName businessName email kycStatus')
      .sort({ createdAt: -1 });
  }

  // Admin: Update any listing
  public static async adminUpdateListing(id: string, data: Partial<IListing>): Promise<IListing | null> {
    return ListingModel.findByIdAndUpdate(id, data, { new: true });
  }

  // Admin: Delete any listing
  public static async adminDeleteListing(id: string): Promise<IListing | null> {
    return ListingModel.findByIdAndDelete(id);
  }

  // Admin: Update availability for any listing
  public static async adminUpdateAvailability(id: string, availability: any[]) {
    const listing = await ListingModel.findById(id);
    if (!listing) return null;

    listing.availability = availability;
    await listing.save();
    return listing;
  }

  // Add or update review for a listing
  public static async addReview(listingId: string, userId: string, rating: number, comment?: string): Promise<IListing | null> {
    const listing = await ListingModel.findById(listingId);
    if (!listing) return null;

    // Check if user already reviewed
    const existingReviewIndex = listing.ratings?.findIndex(r => r.user.toString() === userId);

    if (existingReviewIndex !== undefined && existingReviewIndex >= 0) {
      // Update existing review
      listing.ratings![existingReviewIndex].rating = rating;
      if (comment !== undefined) listing.ratings![existingReviewIndex].comment = comment;
    } else {
      // Add new review
      listing.ratings = listing.ratings || [];
      listing.ratings.push({ user: new mongoose.Types.ObjectId(userId), rating, comment });
    }

    await listing.save();
    return listing;
  }
}
