import Joi from "joi";
import { Request, Response, NextFunction } from "express";

const validate = (schema: Joi.ObjectSchema<object>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    const valid = error == null;

    if (valid) {
      next();
    } else {
      const { details } = error;
      const message = details.map((i) => i.message).join(",");

      const newMessage = message.replace(/"/g, "");
      res.status(422).json({
        status: "error",
        message: newMessage,
      });
    }
  };
};

const schemas = {
  // User schemas
  registerUser: Joi.object({
    payload: Joi.object({
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().required(),
      password: Joi.string().min(6).required(),
      avatar: Joi.string().optional(),
      role: Joi.string().optional(),
    }).required(),
  }),

  loginUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    avatar: Joi.string().optional(),
  }),

  addReview: Joi.object({
    rating: Joi.number().min(1).max(5).optional(),
    comment: Joi.string().optional(),
  }),

  // Vendor schemas
  registerVendor: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    password: Joi.string().min(6).required(),
    avatar: Joi.string().optional(),
  }),

  verifyVendorOtp: Joi.object({
    phone: Joi.string().required(),
    otp: Joi.string().required(),
  }),

  loginVendor: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

 submitKYC: Joi.object({
  fullLegalName: Joi.string().optional(),
  nin: Joi.string().optional(),
  businessName: Joi.string().optional(),
  businessAddress: Joi.object({
    lat: Joi.number().required(),
    lng: Joi.number().required(),
  }).optional(),
  bankDetails: Joi.object({
    accountNumber: Joi.string().required(),
    bankName: Joi.string().required(),
    bvn: Joi.string().optional(),
  }).optional(),
  bio: Joi.string().optional(),
}),

  updateVendorProfile: Joi.object({
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    businessName: Joi.string().optional(),
    businessAddress: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
    }).optional(),
    avatar: Joi.string().optional(),
    bio: Joi.string().optional(),
  }),

  createListing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    type: Joi.string().valid('apartment', 'car', 'boat').required(),
    subType: Joi.string().optional(),
    location: Joi.string().required(),
    pricePerDay: Joi.number().min(0).required(),
    amenities: Joi.array().items(Joi.string()).optional(),
    images: Joi.array().items(Joi.string()).optional(),
    availability: Joi.array().items(Joi.object({
      startDate: Joi.date().required(),
      endDate: Joi.date().required(),
    })).optional(),
  }),

  updateListing: Joi.object({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    type: Joi.string().valid('apartment','car','boat').optional(),
    subType: Joi.string().optional(),
    location: Joi.string().optional(),
    pricePerDay: Joi.number().min(0).optional(),
    amenities: Joi.array().items(Joi.string()).optional(),
    images: Joi.array().items(Joi.string()).optional(),
    availability: Joi.array().items(Joi.object({
      startDate: Joi.date().required(),
      endDate: Joi.date().required(),
    })).optional(),
  }),

  updateAvailability: Joi.object({
    availability: Joi.array().items(Joi.object({
      startDate: Joi.date().required(),
      endDate: Joi.date().required(),
    })).required(),
  }),

  // Admin schemas
  rejectVendor: Joi.object({
    reason: Joi.string().required(),
  }),

  approveListing: Joi.object({
    approve: Joi.boolean().required(),
  }),
};

export { validate, schemas };
