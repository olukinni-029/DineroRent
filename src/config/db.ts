import mongoose from 'mongoose';
import logger from "../utils/logger"
const { MONGO_URI_DEV, MONGO_URI_PROD, NODE_ENV } = process.env;

export const connectToMongoDB = (): void => {
  logger.info(`Connecting to MongoDB - for @${NODE_ENV}`);
  const MONGO_URI = NODE_ENV === 'production' ? MONGO_URI_PROD : MONGO_URI_DEV;
  if (!MONGO_URI) {
    logger.error('Mongo URI is not defined');
    process.exit(1);
  }
  mongoose.connect(MONGO_URI as string);
  mongoose.connection.on('connected', () => {
    logger.info(`Connected to MongoDB - for @${NODE_ENV}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`Error: ${err}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.info('Disconnected from MongoDB');
  });
};

