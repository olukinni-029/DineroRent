import mongoose from "mongoose";
import OtpModel, { IOtp } from "../models/otp.model";
import { compare } from "../utils/hashes/hasher";
import {
  generateRandomOTP,
  hashOTP,
  sendOtpToPhone,
} from "../utils/common/otpGeneration";
import emitter from "../utils/common/eventEmitter";
import { ValidationError } from "../utils/customError";

export class OtpService {
  public static async create(data: IOtp, session?: mongoose.ClientSession) {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const otpDoc = new OtpModel({ ...data, expiresAt });

    return otpDoc.save({ session });
  }

  public static async findOneOtpPhoneAndPurpose(
    phone: string,
    purpose: string
  ) {
    return OtpModel.findOne({
      $and: [{ phone }, { purpose }],
    });
  }

  public static async findOneOtpEmailAndPurpose(
    email: string,
    purpose: string
  ) {
    return OtpModel.findOne({
      $and: [{ email }, { purpose }],
    });
  }

  public static async deleteOtpByPhone(
    phone: string,
    purpose: string,
    session?: mongoose.ClientSession
  ) {
    return OtpModel.findOneAndDelete(
      { phone, purpose },
      session ? { session } : {}
    );
  }

  public static async deleteOtpByEmail(
    email: string,
    purpose: string,
    session?: mongoose.ClientSession
  ) {
    return OtpModel.findOneAndDelete(
      { email, purpose },
      session ? { session } : {}
    );
  }

  public static async findLatestOtpByPurpose(purpose: string, phone: string) {
    return await OtpModel.findOne({ purpose, phone }).sort({ createdAt: -1 });
  }

  public static async verifyOtpHash(
    plainOtp: string,
    hashedOtp: string
  ): Promise<boolean> {
    if (!plainOtp || !hashedOtp) {
      throw new ValidationError('OTP and hashed OTP are required');
    }
    return await compare(plainOtp, hashedOtp);
  }

 public static async issueOtp(
  contact: string, // can be phone or email
  purpose: string
)
 {
  const isEmail = contact.includes("@");

  // Delete previous OTPs for this contact & purpose
  if (isEmail) {
    await this.deleteOtpByEmail(contact, purpose);
  } else {
    await this.deleteOtpByPhone(contact, purpose);
  }

  // Generate OTP
  const otp = generateRandomOTP();
  const hashedOtp = await hashOTP(otp.toString());

  // Expiration: 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Store OTP
  await this.create({
    ...(isEmail ? { email: contact } : { phone: contact }),
    otp: hashedOtp,
    purpose,
    expiresAt,
  });

  // Send OTP
  // if (isEmail) {
  //   await sendOtpToEmail(contact, otp.toString());
  // } else {
  //   const formatted = contact.replace(/^0/, "234");
  //   await sendOtpToPhone(formatted, otp.toString());
  // }

  // Emit event
  emitter.emit("otp:generated", {
    contact,
    otp: otp.toString(), // plain text for internal use only
    purpose,
    createdAt: new Date(),
    expiresAt,
  });
  return otp.toString();
}
}