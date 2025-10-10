import mongoose from 'mongoose';
import { Server } from 'http';
import logger from '../utils/logger';

export const setupErrorHandling = (server: Server): void => {
  process.on('unhandledRejection', (err: Error) => {
    logger.error(`Error: ${err.message}`);
    logger.error('Shutting down the server due to Unhandled Promise Rejection');
    server.close(() => {
      process.exit(1);
    });
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error(`Error: ${err.message}`);
    logger.error('Shutting down the server due to Uncaught Exception');
    server.close(() => {
      process.exit(1);
    });
  });

  // Handle SIGINT and SIGTERM signals
  process.on('SIGINT', async () => {
    logger.info('SIGINT received....');
    server.close(() => {
      logger.info('server is closed');

      mongoose.connection.close();
      logger.info('Mongoose connection closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received....');
    server.close(() => {
      logger.info('server is closed');

      mongoose.connection.close();
      logger.info('Mongoose connection closed');
      process.exit(0);
    });
  });
};
