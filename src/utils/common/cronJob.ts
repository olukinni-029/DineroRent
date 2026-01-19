import cron from 'node-cron';
import { BookingService } from '../../services/booking.service';

export const startCronJobs = () => {
  // Run every hour (at minute 0)
  cron.schedule('0 * * * *', async () => {
    console.log('[CronJob] Running autoCancelExpiredBookings...');
    try {
      await BookingService.autoCancelExpiredBookings();
      console.log('[CronJob] autoCancelExpiredBookings completed successfully.');
    } catch (err: any) {
      console.error('[CronJob] autoCancelExpiredBookings failed:', err.message);
    }
  });
};