/**
 * Demo script to test email functionality
 * Run with: npx tsx scripts/test-email.ts
 */

import dotenv from "dotenv";
import path from "path";

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { sendPasswordResetEmail } from "@/lib/emails/send-password-reset";
import { sendEmailVerification } from "@/lib/emails/send-email-verification";

async function testEmailFunctionality() {
  console.log("🚀 Testing Email Functionality with Brevo API\n");
  console.log("Environment Check:");
  console.log(`• BREVO_API_KEY: ${process.env.BREVO_API_KEY ? "✅ Loaded" : "❌ Missing"}`);
  console.log(`• BREVO_SENDER_EMAIL: ${process.env.BREVO_SENDER_EMAIL || "❌ Missing"}`);
  console.log("\n");

  const testEmail = "fahadshaikher@gmail.com";
  const testName = "Fahad Shaikher";

  // Test 1: Password Reset Email
  console.log("📧 Test 1: Password Reset Email");
  console.log("━".repeat(50));
  console.log(`To: ${testEmail}`);
  console.log(`Name: ${testName}\n`);

  const passwordResetResult = await sendPasswordResetEmail({
    email: testEmail,
    fullName: testName,
    resetLink: "http://localhost:3000/auth/reset-password?code=test-token-12345",
    expiryHours: 24,
  });

  if (passwordResetResult.success) {
    console.log("✅ Password Reset Email SENT");
    console.log(`   Message ID: ${passwordResetResult.messageId}`);
  } else {
    console.log("❌ Password Reset Email FAILED");
    console.log(`   Error: ${passwordResetResult.error}`);
  }

  console.log("\n");

  // Test 2: Email Verification
  console.log("📧 Test 2: Email Verification");
  console.log("━".repeat(50));
  console.log(`To: ${testEmail}`);
  console.log(`Name: ${testName}\n`);

  const emailVerificationResult = await sendEmailVerification({
    email: testEmail,
    fullName: testName,
    verificationLink:
      "http://localhost:3000/api/auth/callback?token=verification-token-12345",
    expiryHours: 7,
  });

  if (emailVerificationResult.success) {
    console.log("✅ Email Verification SENT");
    console.log(`   Message ID: ${emailVerificationResult.messageId}`);
  } else {
    console.log("❌ Email Verification FAILED");
    console.log(`   Error: ${emailVerificationResult.error}`);
  }

  console.log("\n");
  console.log("━".repeat(50));
  console.log("📨 Email Summary:");
  console.log(`• Password Reset: ${passwordResetResult.success ? "✅" : "❌"}`);
  console.log(`• Email Verification: ${emailVerificationResult.success ? "✅" : "❌"}`);
  console.log("\nCheck your email at: " + testEmail);
}

testEmailFunctionality();
