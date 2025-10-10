import dotenv from 'dotenv';
dotenv.config();

import cloudinary from 'cloudinary';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFiles = async function uploadFiles(filePaths: string[]) {
  const imageUrls = [];
  for (const filePath of filePaths) {
    const result = await cloudinary.v2.uploader.upload(filePath);
    imageUrls.push(result.secure_url);
  }
  return imageUrls;
};

export { cloudinary, uploadFiles };
