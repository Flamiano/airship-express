export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhoneNumber(phone: string): boolean {
  // Philippine phone number formats:
  // Mobile: 09xx-xxx-xxxx, +639xx-xxx-xxxx, 9xx-xxx-xxxx
  // Landline: 02-xxxx-xxxx, +632-xxxx-xxxx
  const phoneRegex = /^(\+63|0)?(9\d{9}|2\d{8})$/;
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  return phoneRegex.test(cleaned);
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");

  if (cleaned.startsWith("+63")) {
    return "0" + cleaned.slice(3);
  }
  if (cleaned.startsWith("63")) {
    return "0" + cleaned.slice(2);
  }
  if (cleaned.startsWith("9") && cleaned.length === 10) {
    return "0" + cleaned;
  }

  return cleaned;
}