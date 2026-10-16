"use server";

import { getCurrentUser } from "../library/auth/getCurrentUser";
import { getBookingRequests } from "../services/booking-request.service";
import { getCustomerNotifications } from "../services/notification.service";
import type { CustomerNotification } from "../services/notification.service";

export async function getNotificationsAction(): Promise<CustomerNotification[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.profile.role !== "customer" || !currentUser.customer) {
    return [];
  }

  const requests = await getBookingRequests({ customerUuid: currentUser.customer.id });
  return getCustomerNotifications(currentUser.customer.id, requests);
}
