# TODO: Implement Forget and Reset Password for Users and Vendors

## 1. Modify OTP Model ✅ COMPLETED
- Add email field to IOtp interface and otpSchema in src/models/otp.model.ts

## 2. Update OTP Service ✅ COMPLETED
- Add methods to find/delete OTP by email and purpose in src/services/otp.service.ts
- Modify issueOtp to support email-based OTPs

## 3. Create Forgot Password Email Template ✅ COMPLETED
- Create src/utils/template/forgotPassword.template.ts with HTML template for reset OTP email

## 4. Add Event Listener for Forgot Password ✅ COMPLETED
- Add listener for "forgot_password" event in src/utils/common/eventEmitter.ts to send email

## 5. Add Controller Methods ✅ COMPLETED
- Add forgotPassword and resetPassword methods in src/controllers/user.controller.ts
- Add forgotPassword and resetPassword methods in src/controllers/vendor.controller.ts

## 6. Add Routes ✅ COMPLETED
- Add POST /forgot-password and POST /reset-password routes in src/routes/user.routes.ts
- Add POST /forgot-password and POST /reset-password routes in src/routes/vendor.routes.ts

## 7. Update Validators ✅ COMPLETED
- Add validation schemas for forgot password and reset password in src/utils/validator.ts

## 8. Test Implementation
- Test forgot password flow for users
- Test forgot password flow for vendors
- Test reset password functionality
- Verify OTP expiration and validation
