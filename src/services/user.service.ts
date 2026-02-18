import mongoose from 'mongoose';
import UserModel, { IUser } from '../models/User.model';
import { hash } from '../utils/hashes/hasher';
import { ValidationError } from '../utils/customError';

export class UserService {
  // Create new user
  public static async createUser(userData: IUser){
    const hashedPassword = await hash(userData.password as string);
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

  // Admin methods
  public static async getAllUsersAdmin(filters: any = {}, page: number = 1, limit: number = 10) {
    const query: any = {};

    if (filters.role) query.role = filters.role;
    if (filters.deactivated !== undefined) query.deactivated = filters.deactivated;
    if (filters.suspended !== undefined) query.suspended = filters.suspended;

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      UserModel.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserModel.countDocuments(query)
    ]);
    const pages = Math.ceil(total / limit);
    return { users, total, page, pages };
  }

  public static async updateUserRoleAdmin(id: string, role: string) {
    const validRoles = ['user', 'super_admin', 'vendor_verification_admin', 'finance_admin', 'support_admin'];
    if (!validRoles.includes(role)) {
      throw new ValidationError('Invalid role specified');
    }

    return UserModel.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
  }

  public static async deactivateUserAdmin(id: string) {
    return UserModel.findByIdAndUpdate(id, { deactivated: true }, { new: true }).select('-password');
  }

  public static async activateUserAdmin(id: string) {
    return UserModel.findByIdAndUpdate(id, { deactivated: false }, { new: true }).select('-password');
  }

  public static async suspendUserAdmin(id: string) {
    return UserModel.findByIdAndUpdate(id, { suspended: true }, { new: true }).select('-password');
  }

  public static async unsuspendUserAdmin(id: string) {
    return UserModel.findByIdAndUpdate(id, { suspended: false }, { new: true }).select('-password');
  }
}
