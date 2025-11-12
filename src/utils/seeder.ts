import mongoose from "mongoose";
import ListingModel from "../models/Listing.model";
import listings from "./listings.json";

mongoose.connect("mongodb://127.0.0.1:27017/dinerorent").then(async () => {
  await ListingModel.insertMany(listings);
  console.log("✅ Listings inserted successfully!");
  process.exit();
});
