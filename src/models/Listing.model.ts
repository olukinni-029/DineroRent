import mongoose, { Schema, Document } from 'mongoose';
export interface ApartmentSubTypes {
  studio: string;
  '1-bedroom': string;
  '2-bedroom': string;
  '3-bedroom': string;
  penthouse: string;
  duplex: string;
}

export interface CarSubTypes {
  sedan: string;
  suv: string;
  truck: string;
  van: string;
  convertible: string;
  coupe: string;
  hatchback: string;
  wagon: string;
}

export interface BoatSubTypes {
  speedboat: string;
  yacht: string;
  sailboat: string;
  catamaran: string;
  'fishing-boat': string;
  houseboat: string;
}

export interface IListing extends Document {
  createdBy: mongoose.Types.ObjectId;
  type: 'apartment' | 'car' | 'boat';
  subType?: ApartmentSubTypes | CarSubTypes | BoatSubTypes;
  title: string;
  description: string;
  pricePerDay: number;
  location: string;
  coordinates?: { lat: number; lng: number };
  images: string[];
  features?: string[]; // general descriptive tags
  amenities?: string[]; // user-facing conveniences (e.g. WiFi, AC)
  attributes?: Record<string, any>; // type-specific metadata
  availability?: { startDate: Date; endDate: Date }[]; // reserved/unavailable dates
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
    createdBy: { type: Schema.Types.ObjectId},
    type: { type: String, enum: ['apartment', 'car', 'boat'], required: true },
    subType: {type: Schema.Types.Mixed },
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
    amenities: [{ type: String }], // ✅ Added back
    attributes: { type: Schema.Types.Mixed }, // ✅ Keeps flexible metadata
    availability: [
      {
        startDate: { type: Date },
        endDate: { type: Date },
      },
    ], // ✅ Added for booking/availability
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

export default mongoose.model<IListing>('Listing', ListingSchema);
