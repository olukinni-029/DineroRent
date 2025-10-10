import winston from 'winston';
import { format } from 'winston';

const { combine, timestamp, label, printf, colorize } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  const formattedMessage = typeof message === 'object'
    ? JSON.stringify(message, null, 2)
    : message;

  return `${timestamp} [${label}] ${level}: ${formattedMessage}`;
});

const logger = winston.createLogger({
  format: combine(
    colorize(),
    label({ label: 'right meow!' }),
    timestamp(),
    myFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/combined.log' }),
  ],
});

export default logger;
