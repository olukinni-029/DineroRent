import mongoose from "mongoose";
import ListingModel from "../models/Listing.model";
import UserModel from "../models/User.model";
// import listings from "./listings.json";
import { hash } from "./hashes/hasher";

mongoose.connect("mongodb://127.0.0.1:27017/dinerorent").then(async () => {
  // Seed admin users
  const adminUsers = [
    {
      firstName: "Super",
      lastName: "Admin",
      email: "superadmin@dinerorent.com",
      phone: "+1234567890",
      password: await hash("SuperAdmin123!"),
      role: "super_admin"
    },
    {
      firstName: "Vendor",
      lastName: "Verification",
      email: "vendoradmin@dinerorent.com",
      phone: "+1234567891",
      password: await hash("VendorAdmin123!"),
      role: "vendor_verification_admin"
    },
    {
      firstName: "Finance",
      lastName: "Admin",
      email: "financeadmin@dinerorent.com",
      phone: "+1234567892",
      password: await hash("FinanceAdmin123!"),
      role: "finance_admin"
    },
    {
      firstName: "Support",
      lastName: "Admin",
      email: "supportadmin@dinerorent.com",
      phone: "+1234567893",
      password: await hash("SupportAdmin123!"),
      role: "support_admin"
    }
  ];

  // Check if admin users already exist
  for (const adminUser of adminUsers) {
    const existingUser = await UserModel.findOne({ email: adminUser.email });
    if (!existingUser) {
      await UserModel.create(adminUser);
      console.log(`✅ Admin user ${adminUser.email} created successfully!`);
    } else {
      console.log(`ℹ️ Admin user ${adminUser.email} already exists.`);
    }
  }

  // Seed listings
  // await ListingModel.insertMany(listings);
  console.log("✅ Listings inserted successfully!");
  process.exit();
});
