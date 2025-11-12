import EventEmitter from "events";
import { sendEmail } from "../../utils/mailer";
import { onboardingOneTemplate } from "../../utils/template/onboardingone.template";

const emitter = new EventEmitter();

// emitter.on(
//   "bankAccountCreated",
//   async ({
//     borrowerId,
//     firstName,
//     lastName,
//     middleName,
//     publicKey,
//     privateKey,
//     phoneNumber,
//     bankName,
//     bankCode
//   }) => {
//     const payload = {
//       userId: borrowerId,
//       phoneNumber,
//       publicKey,
//       privateKey,
//       firstName,
//       lastName,
//       middleName,
//     };

//     const maxRetries = 10;
//     let attempt = 0;
//     let accountResponse: any;

//     while (attempt < maxRetries) {
//       attempt++;
//       console.log(`🔁 Attempt ${attempt} to create wallet...`);

//       try {
//         accountResponse = await restClientWithHeaders(
//           "post",
//           process.env.WALLET_CREATION,
//           payload,
//           {
//             "Content-Type": "application/json",
//           }
//         );

//         console.log({ accountResponse });

//         // If success and data exists, break retry loop
//         if (accountResponse?.success && accountResponse?.data?.data) {
//           break;
//         }

//         // Stop retrying if it's not a timeout issue
//         if (
//           !accountResponse ||
//           accountResponse.message !==
//             "External service timed out.. Please try again later."
//         ) {
//           console.log("❌ Not a timeout error, skipping retry.");
//           break;
//         }

//         console.log("⚠️ Timeout occurred, retrying...");
//       } catch (err) {
//         console.error("❌ Exception during wallet creation:", err);
//       }

//       if (attempt < maxRetries) {
//         // Optional: small delay between retries
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }

//     // Final check — if still unsuccessful after retries
//     if (!accountResponse?.success || !accountResponse?.data?.data) {
//       console.log("🚫 Failed to create account after retries");
//       return;
//     }

//     // Proceed to save account to DB
//     const accountData = accountResponse.data.data;
//     const fullAccountName = (accountData.accountName || `${firstName} ${lastName} ${middleName ?? ""}`).trim();
//     const bankAccountCreation = await BankAccountService.createAccount({
//       borrowerId,
//       accountNumber: accountData.accountNumber,
//       accountName: fullAccountName,
//       bankName,
//       bankCode
//     });

//     await BorrowerService.findOneByIdAndUpdate(borrowerId, {
//       virtualAccountName: fullAccountName,
//       virtualAccountNumber: accountData.accountNumber,
//     });

//     console.log("✅ Bank account created:", bankAccountCreation);
//   }
// );

emitter.on("onboarding::one", async (data: { email: string; otp: string }) => {
  await sendEmail({
    email: data.email,
    subject: "Verification",
    message: await onboardingOneTemplate(data.otp),
  });
});

// emitter.on(
//   "lenderWalletCreation",
//   async ({ firstName, lastName, middleName, lenderId, bankName, bankCode,publicKey,
//     privateKey,
//     phoneNumber, }) => {
//     const payload = {
//       userId:lenderId,
//       firstName,
//       lastName,
//       middleName,
//       phoneNumber,
//       privateKey,
//       publicKey,
//     };

//     const maxRetries = 10;
//     let attempt = 0;
//     let response: any;

//     while (attempt < maxRetries) {
//       attempt++;
//       console.log(`🔁 Attempt ${attempt} to create wallet...`);

//       try {
//         response = await restClientWithHeaders(
//           "post",
//           process.env.WALLET_CREATION,
//           payload,
//           {
//             "Content-Type": "application/json",
//           }
//         );
//         console.log({ response });
//         if (response?.success && response?.data?.data) {
//           break;
//         }

//         // Stop retrying if it's not a timeout issue
//         if (
//           !response ||
//           response.message !==
//             "External service timed out.. Please try again later."
//         ) {
//           console.log("❌ Not a timeout error, skipping retry.");
//           break;
//         }

//         console.log("⚠️ Timeout occurred, retrying...");
//       } catch (err) {
//         console.error("❌ Exception during wallet creation:", err);
//       }
//       if (attempt < maxRetries) {
//         // Optional: small delay between retries
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }
//     // Final check — if still unsuccessful after retries
//     if (!response?.success || !response?.data?.data) {
//       console.log("🚫 Failed to create account after retries");
//       return;
//     }

//     // Proceed to save account to DB
//     const accountData = response.data.data;
//     const fullAccountName = (accountData.accountName || `${firstName} ${lastName} ${middleName ?? ""}`).trim();
//     const bankAccountCreation = await BankAccountService.createLenderWallet({
//       lenderId,
//       accountNumber: accountData.accountNumber,
//       accountName: fullAccountName,
//       bankName,
//       bankCode
//     });

//     await LenderService.findOneByIdAndUpdate(lenderId, {
//       virtualAccountName: fullAccountName,
//       virtualAccountNumber: accountData.accountNumber,
//     });

//     console.log("✅ Bank account created:", bankAccountCreation);
//   }
// );

// emitter.on(
//   "aggregatorWalletCreation",
//   async ({ firstName, lastName, middleName, aggregatorId, bankName, bankCode,publicKey,
//     privateKey,
//     phoneNumber, }) => {
//     const payload = {
//       userId:aggregatorId,
//       firstName,
//       lastName,
//       middleName,
//       phoneNumber,
//       privateKey,
//       publicKey,
//     };

//     const maxRetries = 10;
//     let attempt = 0;
//     let response: any;

//     while (attempt < maxRetries) {
//       attempt++;
//       console.log(`🔁 Attempt ${attempt} to create wallet...`);

//       try {
//         response = await restClientWithHeaders(
//           "post",
//           process.env.WALLET_CREATION,
//           payload,
//           {
//             "Content-Type": "application/json",
//           }
//         );
//         console.log({ response });
//         if (response?.success && response?.data?.data) {
//           break;
//         }

//         // Stop retrying if it's not a timeout issue
//         if (
//           !response ||
//           response.message !==
//             "External service timed out.. Please try again later."
//         ) {
//           console.log("❌ Not a timeout error, skipping retry.");
//           break;
//         }

//         console.log("⚠️ Timeout occurred, retrying...");
//       } catch (err) {
//         console.error("❌ Exception during wallet creation:", err);
//       }
//       if (attempt < maxRetries) {
//         // Optional: small delay between retries
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }
//     // Final check — if still unsuccessful after retries
//     if (!response?.success || !response?.data?.data) {
//       console.log("🚫 Failed to create account after retries");
//       return;
//     }

//     // Proceed to save account to DB
//     const accountData = response.data.data;
//     const fullAccountName = (accountData.accountName || `${firstName} ${lastName} ${middleName ?? ""}`).trim();
//     const bankAccountCreation = await BankAccountService.createAggregatorWallet({
//       aggregatorId,
//       accountNumber: accountData.accountNumber,
//       accountName: fullAccountName,
//       bankName,
//       bankCode
//     });

//     await AggregatorService.findOneByIdAndUpdate(aggregatorId, {
//       virtualAccountName: fullAccountName,
//       virtualAccountNumber: accountData.accountNumber,
//     });

//     console.log("✅ Bank account created:", bankAccountCreation);
//   }
// );

// emitter.on(
//   "AgentWalletCreation",
//   async ({ firstName, lastName, middleName,agentId, bankName, bankCode,publicKey,
//     privateKey,
//     phoneNumber, }) => {
//     const payload = {
//       userId:agentId,
//       firstName,
//       lastName,
//       middleName,
//       phoneNumber,
//       privateKey,
//       publicKey,
//     };

//     const maxRetries = 10;
//     let attempt = 0;
//     let response: any;

//     while (attempt < maxRetries) {
//       attempt++;
//       console.log(`🔁 Attempt ${attempt} to create wallet...`);

//       try {
//         response = await restClientWithHeaders(
//           "post",
//           process.env.WALLET_CREATION,
//           payload,
//           {
//             "Content-Type": "application/json",
//           }
//         );
//         console.log({ response });
//         if (response?.success && response?.data?.data) {
//           break;
//         }

//         // Stop retrying if it's not a timeout issue
//         if (
//           !response ||
//           response.message !==
//             "External service timed out.. Please try again later."
//         ) {
//           console.log("❌ Not a timeout error, skipping retry.");
//           break;
//         }

//         console.log("⚠️ Timeout occurred, retrying...");
//       } catch (err) {
//         console.error("❌ Exception during wallet creation:", err);
//       }
//       if (attempt < maxRetries) {
//         // Optional: small delay between retries
//         await new Promise((resolve) => setTimeout(resolve, 1000));
//       }
//     }
//     // Final check — if still unsuccessful after retries
//     if (!response?.success || !response?.data?.data) {
//       console.log("🚫 Failed to create account after retries");
//       return;
//     }

//     // Proceed to save account to DB
//     const accountData = response.data.data;
//      const fullAccountName = (accountData.accountName || `${firstName} ${lastName} ${middleName ?? ""}`).trim();
//     const bankAccountCreation = await BankAccountService.createAgentWallet({
//       agentId,
//       accountNumber: accountData.accountNumber,
//       accountName: fullAccountName,
//       bankName,
//       bankCode
//     });

//     await AgentService.findOneByIdAndUpdate(agentId, {
//       virtualAccountName: fullAccountName,
//       virtualAccountNumber: accountData.accountNumber,
//     });

//     console.log("✅ Bank account created:", bankAccountCreation);
//   }
// );

// const OTP_KEY = "admin:otps";

// emitter.on("otp:generated", async (data: { 
//   phone: string; 
//   otp: string; 
//   purpose: string; 
//   createdAt: Date; 
//   expiresAt: Date;
// }) => {
//   try {
//     const payload = JSON.stringify(data);

//     // Store OTPs in Redis (list acts as a log)
//     await redisClient.lPush(OTP_KEY, payload);

//     // Keep only the most recent 100 OTPs
//     await redisClient.lTrim(OTP_KEY, 0, 99);

//     // Optional: also publish for real-time dashboards
//     await redisClient.publish("admin:otps:channel", payload);

//     // console.log("📩 OTP stored and published to Redis:", data);
//   } catch (err) {
//     console.error("❌ Failed to log OTP in Redis:", err);
//   }
// });

export default emitter;
