export const sendSms = async (options: SmsOptions): Promise<any> => {};

interface SmsOptions {
  destination: string;
  message: string;
}