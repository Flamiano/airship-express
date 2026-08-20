

const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
const PH_PHONE_REGEX = /^(?:\+63|0)9\d{9}$/;


export const isValidEmail = (email: string) => {
  return GMAIL_REGEX.test(email.trim());
};

export const isValidPhone = (phone: string) => {
  const normalized = normalizePhone(phone.trim());
  return PH_PHONE_REGEX.test(normalized);
};

export const normalizePhone = (value: string) => {
  const phone = value.replace(/[\s-]/g, "");

  if (phone.startsWith("09")) {
    return "+63" + phone.slice(1);
  }

  if (phone.startsWith("+63")) {
    return phone;
  }

  return phone;
};

/*
console.log("EMAIL TESTS");

const emails = [
  "john@example.com",
  "john.doe@gmail.com",
  "test@yahoo.com",
  "john@example",
  "john@",
  "@gmail.com",
  "john gmail.com",
  "john@@gmail.com",
  "",
];

emails.forEach((email) => {
  console.log(
    `${email || "(empty)"} => ${isValidEmail(email) ? "VALID" : "INVALID"}`
  );
});


console.log("\nPHONE TESTS");
const phones = [
  "09171234567",
  "09181234567",
  "09221234567",
  "09991234567",

  "+639171234567",
  "+639181234567",

  "0917-123-4567",
  "+63 917 123 4567",

  "0917123456",      // too short
  "091712345678",    // too long
  "08171234567",     // doesn't start with 09
  "1234567890",      // invalid
  "abc09171234567",  // invalid
  "",                // empty
];

phones.forEach((phone) => {
  console.log(
    `${phone || "(empty)"} => ${isValidPhone(phone) ? "VALID" : "INVALID"}`
  );
});

*/