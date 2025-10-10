import logger from './logger';
import dotenv from 'dotenv';
import nodemailer, { TransportOptions } from 'nodemailer';

dotenv.config();

type TransportOptionsType = TransportOptions & {
  host: string;
  port: number;
  auth: {
    user: string;
    pass: string;
  };
  tls: {
    rejectUnauthorized: boolean;
  };
};

interface EmailOptions {
  email: string;
  subject: string;
  message: string;
  attachments?: any;
}

const sendEmail = async (options: EmailOptions) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST as string,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.USER_EMAIL as string,
      pass: process.env.USER_EMAIL_PASSWORD as string,
    },
    tls: {
      rejectUnauthorized: false,
    },

  } as TransportOptionsType);

  try {
    const message = {
      from: `${process.env.FROM_NAME} <${process.env.USER_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.message,
      attachments: options.attachments,
      
    };

    const info = await transporter.sendMail(message);
    logger.info('Message sent: %s', info);
    return info;
  } catch (error) {
    logger.error(error);
    return error;
  }
};

export { sendEmail };

