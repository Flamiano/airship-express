

export const formatPhoneNumber = (phone: string | null) => {
  if (!phone) return "";

  if (phone.startsWith("+63")) {
    return "0" + phone.slice(3);
  }

  return phone;
};