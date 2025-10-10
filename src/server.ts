import app from './app';
import { createServer } from "http";
import dotenv from 'dotenv';
import { connectToMongoDB } from './config/db';
import logger from './utils/logger';

dotenv.config();

// Connect to database
connectToMongoDB();

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

const server = httpServer.listen(PORT, () => {
  logger.info(
    `Prometheus metrics are available at http://localhost:${PORT}/metrics`
  );
  logger.info(
    `Server is live on http://localhost:${PORT} - PID: ${process.pid} - ENV: ${process.env.NODE_ENV}`
  );
});


// Graceful shutdown
const shutdown = () => {
  server.close(() => {
    logger.info("Server is closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Export for use in event listeners
export { server };
