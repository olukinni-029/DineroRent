import {
  hash as bcryptHash,
  compare as bcryptCompare,
  genSalt as bcryptGenSalt,
} from "bcrypt";
import { sendSms } from "./sms";


export const generateRandomNumber = (length: number): number => {
  return Math.floor(
    Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)
  );
};

export const generateRandomOTP = (): number => {
  return Math.floor(100000 + Math.random() * 900000);
};

export const hashOTP = async (value: string): Promise<string> => {
  const salt = await bcryptGenSalt(10);
  return bcryptHash(value, salt);
};

export const compareOTP = async (
  value: string,
  hash: string
): Promise<boolean> => {
  return bcryptCompare(value, hash);
};

export async function sendOtpToPhone(
  phone: string,
  otp: string
): Promise<void> {
  try {
    const message = `Your Dinero Rental verification code is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`;
    await sendSms({ destination: phone, message });
  } catch (error) {
    console.error(`OTP sending failed to ${phone}`, error);
    throw new Error("OTP sending failed");
  }
}

// const OTP_KEY = "admin:otps";

// export async function fetchAdminOtps(limit = 50) {
//   const results = await redisClient.lRange(OTP_KEY, 0, limit - 1);
//   return results.map((r) => JSON.parse(r));
// }
