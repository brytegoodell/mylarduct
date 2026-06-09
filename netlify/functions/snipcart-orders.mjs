import {
  SnipcartApiError,
  coerceOrderCollection,
  getAdminApiKey,
  isAdminAuthorized,
  jsonResponse,
  snipcartRequest,
  summarizeOrder,
} from "./lib/snipcart.mjs";

const ORDER_STATUSES = new Set([
  "InProgress",
  "Processed",
  "Disputed",
  "Shipped",
  "Delivered",
  "Pending",
  "Cancelled",
]);

const normalize = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const matchesSearch = (order, query) => {
  if (!query) {
    return true;
  }

  const haystack = [
    order.invoiceNumber,
    order.customerEmail,
    order.customerName,
    order.status,
    order.trackingNumber,
    ...order.items.map((item) => item.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
};

export default async (request) => {
  if (request.method !== "GET") {
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

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status");
  const status = ORDER_STATUSES.has(requestedStatus) ? requestedStatus : "";
  const requestedLimit = Number.parseInt(url.searchParams.get("limit"), 10);
  const limit = Number.isNaN(requestedLimit) ? 20 : Math.min(Math.max(requestedLimit, 1), 50);
  const search = normalize(url.searchParams.get("q"));
  const invoiceNumber = url.searchParams.get("invoiceNumber")?.trim();
  const fetchLimit = Math.min(Math.max(limit, 60), 100);

  const query = new URLSearchParams({
    limit: String(fetchLimit),
    offset: "0",
  });

  if (status) {
    query.set("status", status);
  }

  if (invoiceNumber) {
    query.set("invoiceNumber", invoiceNumber);
  }

  try {
    const payload = await snipcartRequest(`/orders?${query.toString()}`);
    const orders = coerceOrderCollection(payload)
      .map(summarizeOrder)
      .filter((order) => matchesSearch(order, search))
      .slice(0, limit);

    return jsonResponse(
      {
        count: orders.length,
        orders,
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

    return jsonResponse({ error: "Unable to load orders right now." }, 500, {
      "Cache-Control": "no-store",
    });
  }
};

export const config = {
  path: "/api/snipcart-orders",
  preferStatic: true,
};
