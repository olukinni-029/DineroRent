import mongoose, { Schema, Document } from 'mongoose';

export type ApartmentOrShortletSubType =
  | 'studio'
  | '1-bedroom'
  | '2-bedroom'
  | '3-bedroom'
  | 'penthouse'
  | 'duplex';

export type CarSubType =
  | 'sedan'
  | 'suv'
  | 'truck'
  | 'van'
  | 'convertible'
  | 'coupe'
  | 'hatchback'
  | 'wagon';

export type BoatSubType =
  | 'speedboat'
  | 'yacht'
  | 'sailboat'
  | 'catamaran'
  | 'fishing-boat'
  | 'houseboat';

export type ListingType = 'apartment' | 'shortlets' | 'car' | 'boat';

export interface IListing extends Document {
  createdBy: mongoose.Types.ObjectId;
  type: ListingType;
  subType?: ApartmentOrShortletSubType | CarSubType | BoatSubType;
  title: string;
  description: string;
  pricePerDay: number;
  location: string;
  coordinates?: { lat: number; lng: number };
  images: string[];
  features?: string[];
  amenities?: string[];
  attributes?: Record<string, any>;
  availability?: { startDate: Date; endDate: Date }[];
  isActive: boolean;
  isApproved: boolean;
  ratings?: {
    user: mongoose.Types.ObjectId;
    rating: number;
    comment?: string;
  }[];
}

const ListingSchema = new Schema<IListing>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    type: {
      type: String,
      enum: ['apartment', 'shortlets', 'car', 'boat'],
      required: true,
    },

    subType: {
      type: String,
      required: false,
      validate: {
        validator: function (this: IListing, value: string) {
          const map: Record<ListingType, string[]> = {
            apartment: [
              'studio',
              '1-bedroom',
              '2-bedroom',
              '3-bedroom',
              'penthouse',
              'duplex',
            ],
            shortlets: [
              'studio',
              '1-bedroom',
              '2-bedroom',
              '3-bedroom',
              'penthouse',
              'duplex',
            ],
            car: [
              'sedan',
              'suv',
              'truck',
              'van',
              'convertible',
              'coupe',
              'hatchback',
              'wagon',
            ],
            boat: [
              'speedboat',
              'yacht',
              'sailboat',
              'catamaran',
              'fishing-boat',
              'houseboat',
            ],
          };

          return !value || map[this.type]?.includes(value);
        },
        message: 'Invalid subtype for listing type',
      },
    },

    title: { type: String, required: true },
    description: { type: String, required: true },
    pricePerDay: { type: Number, required: true },
    location: { type: String, required: true },

    coordinates: {
      lat: Number,
      lng: Number,
    },

    images: [{ type: String, required: true }],
    features: [{ type: String }],
    amenities: [{ type: String }],
    attributes: { type: Schema.Types.Mixed },

    availability: [
      {
        startDate: Date,
        endDate: Date,
      },
    ],

    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: true },

    ratings: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
      },
    ],
  },
  { timestamps: true }
);
const ListingModel = mongoose.model<IListing>('Listing', ListingSchema);
export default ListingModel;
