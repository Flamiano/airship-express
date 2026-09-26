import crypto from "crypto";

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOtp(code: string): string {
  const secret = process.env.OTP_HASH_SECRET!;
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

export function verifyOtpHash(code: string, hash: string): boolean {
  const computed = hashOtp(code);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(hash, "hex")
    );
  } catch {
    return false;
  }
}
