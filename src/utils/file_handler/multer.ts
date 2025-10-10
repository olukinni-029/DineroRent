import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { Request } from 'express';
import dotenv from 'dotenv';
import cloudinary from 'cloudinary';

dotenv.config();

const MAX_SIZE = 1 * 1000 * 1000; // 5MB

export const upload = multer({
  storage: multer.diskStorage({}),
  // limits: { fileSize: MAX_SIZE },
  fileFilter: (req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      ext !== '.jpg' &&
      ext !== '.jpeg' &&
      ext !== '.png' &&
      ext !== '.pdf' &&
      ext !== '.webp' &&
      ext !== '.xls' &&
      ext !== '.xlsx' &&
      ext !== '.csv'
    ) {
      return cb(new Error('Only images, pdf, webp, xls, xlsx, and csv files are allowed'));
    }
    cb(null, true);
  },
});

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function resizeImage(filePath: string): Promise<string> {
  const outputFilePath = filePath.replace(/\.(jpg|jpeg|png)$/i, '_resized.jpg');
  await sharp(filePath)
    .resize({ width: 800 }) // Resize to a width of 800px; adjust as needed
    .jpeg({ quality: 80 })  // Adjust the quality to compress further
    .toFile(outputFilePath);
  return outputFilePath;
}

async function uploadFiles(filePaths: string[]) {
  const imageUrls = [];
  for (const filePath of filePaths) {
    let pathToUpload = filePath;

    // Get original image size
    const stats = await sharp(filePath).metadata();
    const originalFileSize = stats.size || 0;
    console.log(`Original file size: ${originalFileSize / 1000} KB`); // Log original file size

    if (originalFileSize > MAX_SIZE) {
      pathToUpload = await resizeImage(filePath); // Resize if file size is > 5MB
      const resizedStats = await sharp(pathToUpload).metadata();
      const resizedFileSize = resizedStats.size || 0;
      console.log(`Resized file size: ${resizedFileSize / 1000} KB`); // Log resized file size
    }

    const result = await cloudinary.v2.uploader.upload(pathToUpload);
    imageUrls.push(result.secure_url);
  }
  return imageUrls;
}

export { cloudinary, uploadFiles };
