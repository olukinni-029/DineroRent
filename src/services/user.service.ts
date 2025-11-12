import mongoose from 'mongoose';
import UserModel, { IUser } from '../models/User.model';
import { hash } from '../utils/hashes/hasher';

export class UserService {
  // Create new user
  public static async createUser(userData: IUser){
    const hashedPassword = await hash(userData.password);
    userData.password = hashedPassword;
    return UserModel.create(userData);
  }

  // Get user by email
  public static async getUserByEmail(email: string) {
    return UserModel.findOne({ email });
  }

  // Get user by phone
  public static async getUserByPhone(phone: string) {
    return UserModel.findOne({ phone });
  }

  // Get user by ID
  public static async getUserById(id: string) {
    const objId = new mongoose.Types.ObjectId(id);
    return UserModel.findOne({ _id: objId });
  }

  // Update user profile
  public static async updateUser(id: string, updateData: Partial<IUser>) {
    return UserModel.findByIdAndUpdate(id, updateData, { new: true });
  }
}
