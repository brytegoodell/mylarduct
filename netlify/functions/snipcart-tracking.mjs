import {
  SnipcartApiError,
  getAdminApiKey,
  isAdminAuthorized,
  jsonResponse,
  snipcartRequest,
  summarizeOrder,
} from "./lib/snipcart.mjs";

const ORDER_STATUSES = new Set(["Processed", "Shipped", "Delivered"]);

const normalizeTrackingUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const trimmed = value.trim();
  const parsed = new URL(trimmed);
  return parsed.toString();
};

export default async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  if (!getAdminApiKey()) {
    return jsonResponse({ error: "Admin access key is not configured yet." }, 500, {
      "Cache-Control": "no-store",
    });
  }

  if (!isAdminAuthorized(request)) {
    return jsonResponse({ error: "Unauthorized." }, 401, {
      "Cache-Control": "no-store",
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400, {
      "Cache-Control": "no-store",
    });
  }

  const token = payload?.token?.trim();
  const trackingNumber = payload?.trackingNumber?.trim();
  const note = payload?.note?.trim() || "";
  const status = ORDER_STATUSES.has(payload?.status) ? payload.status : "Shipped";
  const sendEmail = payload?.sendEmail !== false;

  if (!token) {
    return jsonResponse({ error: "Order token is required." }, 400, {
      "Cache-Control": "no-store",
    });
  }

  if (!trackingNumber) {
    return jsonResponse({ error: "Tracking number is required." }, 400, {
      "Cache-Control": "no-store",
    });
  }

  let trackingUrl = "";
  try {
    trackingUrl = normalizeTrackingUrl(payload?.trackingUrl);
  } catch {
    return jsonResponse({ error: "Tracking URL must be a valid URL." }, 400, {
      "Cache-Control": "no-store",
    });
  }

  try {
    const existingOrder = await snipcartRequest(`/orders/${token}`);
    const updateBody = {
      status,
      trackingNumber,
      metadata: {
        ...(existingOrder?.metadata || {}),
        fulfillmentProvider: "manufacturer",
        trackingUpdatedAt: new Date().toISOString(),
      },
    };

    if (trackingUrl) {
      updateBody.trackingUrl = trackingUrl;
    }

    const updatedOrder = await snipcartRequest(`/orders/${token}`, {
      method: "PUT",
      body: JSON.stringify(updateBody),
    });

    let notification = null;
    if (sendEmail) {
      notification = await snipcartRequest(`/orders/${token}/notifications`, {
        method: "POST",
        body: JSON.stringify({
          type: "TrackingNumber",
          deliveryMethod: "Email",
          message:
            note
            || "Your order has shipped. Fulfillment was handled by the manufacturer and tracking is now available.",
        }),
      });
    }

    return jsonResponse(
      {
        order: summarizeOrder(updatedOrder),
        notificationSent: Boolean(notification),
        notificationId: notification?.id || null,
      },
      200,
      { "Cache-Control": "no-store" }
    );
  } catch (error) {
    if (error instanceof SnipcartApiError) {
      return jsonResponse(
        { error: error.payload?.message || error.payload?.error || error.message },
        error.status,
        { "Cache-Control": "no-store" }
      );
    }

    return jsonResponse({ error: "Unable to update tracking right now." }, 500, {
      "Cache-Control": "no-store",
    });
  }
};

export const config = {
  path: "/api/snipcart-tracking",
  preferStatic: true,
};
