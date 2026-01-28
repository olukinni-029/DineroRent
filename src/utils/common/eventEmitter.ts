import EventEmitter from "events";
import { sendEmail } from "../../utils/mailer";
import { onboardingOneTemplate } from "../../utils/template/onboardingone.template";
import { kycNotificationTemplate } from "../../utils/template/kycNotification.template";
import { forgotPasswordTemplate } from "../../utils/template/forgotPassword.template";
import UserModel from "../../models/User.model";

const emitter = new EventEmitter();

emitter.on("onboarding::one", async (data: { email: string; otp: string }) => {
  await sendEmail({
    email: data.email,
    subject: "Verification",
    message: await onboardingOneTemplate(data.otp),
  });
});


emitter.on("kyc:submitted", async (data: {
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  businessName?: string;
  submittedAt: Date;
  status: string;
}) => {
  try {
    // Fetch all vendor verification admin emails
    const admins = await UserModel.find({ role: 'vendor_verification_admin' }).select('email');
    const adminEmails = admins.map(admin => admin.email);

    if (adminEmails.length === 0) {
      console.warn("No admin emails found to send KYC notification");
      return;
    }

    // Send notification email to each admin
    const emailPromises = adminEmails.map(email =>
      sendEmail({
        email,
        subject: "New KYC Submission Requires Review",
        message: kycNotificationTemplate(data),
      })
    );

    await Promise.all(emailPromises);
    console.log(`KYC notification sent to ${adminEmails.length} admin(s)`);
  } catch (error) {
    console.error("Failed to send KYC notification:", error);
  }
});

emitter.on('booking:created', (data) => {
   console.log('Booking created:', data);
});

emitter.on('booking:confirmed', (data) => {
  console.log('Booking confirmed:', data);
});

emitter.on('booking:auto:cancelled', (data) => {
  console.log('Booking auto cancelled:', data);
});

emitter.on('booking:checked:in', (data) => {
  console.log('Booking checked in:', data);
});

emitter.on('booking:payment:released', (data) => {
  console.log('Booking payment released:', data);
});

emitter.on('booking:rejected', (data) => {
  console.log('Booking rejected:', data);
});

emitter.on('booking:cancelled', (data) => {
  console.log('Booking cancelled:', data);
});

emitter.on('booking:payment:completed', (data) => {
  console.log('Booking payment completed:', data);
});

emitter.on("otp:generated", (data) => {
  console.log("OTP generated:", data);
});

emitter.on("forgot_password", async (data: { email: string; otp: string }) => {
  await sendEmail({
    email: data.email,
    subject: "DineroRent Password Reset",
    message: await forgotPasswordTemplate(data.otp),
  });
});

export default emitter;
