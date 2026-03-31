import ListingModel, { IListing } from '../models/Listing.model';
import mongoose from 'mongoose';
import { NotFoundError, ValidationError } from '../utils/customError';


type ListingWithStats = Record<string, any> & {
  averageRating: number;
  totalReviews: number;
};

export class ListingService {
  private static validateAvailabilityDates(availability?: { startDate: Date | string; endDate: Date | string }[]) {
    if (!availability) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const period of availability) {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Availability dates must be valid');
      }

      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      if (endDay < startDay) {
        throw new ValidationError('Availability end date cannot be before start date');
      }

      if (startDay < today) {
        throw new ValidationError('Availability start date cannot be in the past');
      }
    }
  }

  // Create new listing
  public static async createListing(data: IListing): Promise<IListing> {
    this.validateAvailabilityDates(data.availability);
    return ListingModel.create(data);
  }

  // Get all listings (with filters)
  public static async getAllListings(filters: any = {}, page: number = 1, limit: number = 10) {
  const query: any = {};

  // Apply filters from controller/client, but default to isActive and isApproved if not provided
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive;
  } else {
    query.isActive = true;
  }
  
  if (filters.isApproved !== undefined) {
    query.isApproved = filters.isApproved;
  } else {
    query.isApproved = true;
  }

  if (filters.type) query.type = filters.type;
  
  if (filters.location) {
    if (typeof filters.location === 'string') {
      query.location = { $regex: filters.location, $options: 'i' };
    } else {
      query.location = filters.location;
    }
  }
  
  if (filters.pricePerDay) {
    query.pricePerDay = filters.pricePerDay;
  } else if (filters.minPrice || filters.maxPrice) {
    query.pricePerDay = {};
    if (filters.minPrice) query.pricePerDay.$gte = filters.minPrice;
    if (filters.maxPrice) query.pricePerDay.$lte = filters.maxPrice;
  }
  
  if (filters.createdBy !== undefined) query.createdBy = filters.createdBy;

  const skip = (page - 1) * limit;
  const listings = await ListingModel.find(query)
    .populate('createdBy', 'firstName lastName email kycStatus')
    .populate('ratings.user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const listingsWithReviews = listings.map((listing) => {
    const ratings = listing.ratings || [];
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    return {
      ...(listing.toObject() as any),
      averageRating,
      totalReviews: ratings.length,
    };
  });

  const total = await ListingModel.countDocuments(query);
  const pages = Math.ceil(total / limit);
  return { listings: listingsWithReviews, total, page, pages };
}


  // Get single listing by ID
  public static async getListingById(id: string): Promise<IListing | null> {
    const objId = new mongoose.Types.ObjectId(id);
    const listing = await ListingModel.findById(objId)
      .populate('createdBy', 'firstName lastName email kycStatus')
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

  public static async getListingReviews(listingId: string) {
    const listing = await ListingModel.findById(listingId).populate(
      'ratings.user',
      'firstName lastName email',
    );

    if (!listing) return null;

    const reviews = (listing.ratings || []).map((rating) => ({
      user: rating.user,
      rating: rating.rating,
      comment: rating.comment,
    }));

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
      : 0;

    return { reviews, averageRating, totalReviews };
  }

  // Update listing (vendor only)
  public static async updateListing(id: string, data: Partial<IListing>): Promise<IListing | null> {
    return ListingModel.findOneAndUpdate(
      { _id: id},
      data,
      { new: true }
    );
  }

  // Delete listing (vendor only)
  // public static async deleteListing(id: string, vendorId: string): Promise<IListing | null> {
  //   return ListingModel.findOneAndDelete({ _id: id, createdBy: vendorId });
  // }

  // Admin: approve or reject listing
  public static async setApprovalStatus(id: string, status: { isApproved: boolean; isActive: boolean }): Promise<IListing | null> {
    return ListingModel.findByIdAndUpdate(id, {
      isApproved: status.isApproved,
      isActive: status.isActive // Set isActive to true when approving, false when rejecting
    }, { new: true });
  }

  static async updateAvailability(id: string, availability: any[]) {
    this.validateAvailabilityDates(availability);

    const listing = await ListingModel.findOne({ _id: id });
    if (!listing) throw new NotFoundError('Listing not found');

    // Replace or merge the availability array
    listing.availability = availability;
    await listing.save();
    return listing;
  }

  // static async approveListing(id: string, approve: boolean) {
  //   return ListingModel.findByIdAndUpdate(
  //     id,
  //     { isApproved: approve },
  //     { new: true }
  //   );
  // }

  // static async rejectListing(id: string) {
  //   return ListingModel.findByIdAndUpdate(
  //     id,
  //     { isApproved: false },
  //     { new: true }
  //   );
  // }

  // Admin: Get all listings (including unapproved)
 public static async getAllListingsAdmin(
  filters: any = {},
  page: number = 1,
  limit: number = 10
): Promise<{ listings: ListingWithStats[]; total: number; totalPages: number; currentPage: number }> {
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

  const skip = (page - 1) * limit;

  const listings = await ListingModel.find(query)
    .populate('createdBy', 'firstName lastName businessName email kycStatus')
    .populate('ratings.user', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const listingsWithReviews: ListingWithStats[] = listings.map((listing) => {
    const ratings = listing.ratings || [];
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    return {
      ...(listing.toObject() as any),
      averageRating,
      totalReviews: ratings.length,
    };
  });

  const total = await ListingModel.countDocuments(query);

  return {
    listings: listingsWithReviews,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
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
    if (!listing) throw new NotFoundError('Listing not found');

    listing.availability = availability;
    await listing.save();
    return listing;
  }



  // Add or update review for a listing
  public static async addReview(listingId: string, userId: string, rating: number, comment?: string): Promise<IListing | null> {
    const listing = await ListingModel.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found');

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

  public static async getListingsByVendor(vendorId: string): Promise<IListing[]> {
    const listings = await ListingModel.find({ createdBy: vendorId })
      .populate('createdBy', 'firstName lastName email kycStatus')
      .populate('ratings.user', 'firstName lastName email');
    return listings;
  }
}
