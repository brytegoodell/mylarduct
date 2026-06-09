const getEnv = (key) => Netlify.env.get(key);

export const jsonResponse = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });

export const getSnipcartPublicKey = () => getEnv("SNIPCART_PUBLIC_API_KEY");
export const getSnipcartSecretKey = () => getEnv("SNIPCART_SECRET_API_KEY");
export const getAdminApiKey = () => getEnv("SNIPCART_ADMIN_API_KEY") || getEnv("ORDER_LOG_API_KEY");

export const isAdminAuthorized = (request) => {
  const apiKey = getAdminApiKey();
  if (!apiKey) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const adminHeader = request.headers.get("x-admin-key");
  const orderLogHeader = request.headers.get("x-order-log-key");
  const queryKey = new URL(request.url).searchParams.get("key");

  if (authHeader === `Bearer ${apiKey}`) {
    return true;
  }

  return adminHeader === apiKey || orderLogHeader === apiKey || queryKey === apiKey;
};

class SnipcartApiError extends Error {
  constructor(status, payload) {
    super(payload?.message || payload?.error || "Snipcart request failed.");
    this.name = "SnipcartApiError";
    this.status = status;
    this.payload = payload;
  }
}

const parseJsonSafe = (text) => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export const snipcartRequest = async (path, options = {}) => {
  const secretApiKey = getSnipcartSecretKey();
  if (!secretApiKey) {
    throw new SnipcartApiError(500, {
      error: "Snipcart secret API key is not configured yet.",
    });
  }

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Basic ${Buffer.from(`${secretApiKey}:`).toString("base64")}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`https://app.snipcart.com/api${path}`, {
    ...options,
    headers,
  });

  const payload = parseJsonSafe(await response.text());
  if (!response.ok) {
    throw new SnipcartApiError(response.status, payload);
  }

  return payload;
};

const pickFirstString = (...values) => values.find((value) => typeof value === "string" && value.trim()) || null;

const joinName = (address) => {
  if (!address) {
    return null;
  }

  if (typeof address.fullName === "string" && address.fullName.trim()) {
    return address.fullName.trim();
  }

  return [address.firstName || address.name || null, address.lastName || null]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() || null;
};

export const summarizeOrder = (order) => {
  const customerEmail = pickFirstString(
    order.email,
    order.user?.email,
    order.billingAddress?.email,
    order.shippingAddress?.email
  );

  const customerName = pickFirstString(
    joinName(order.shippingAddress),
    joinName(order.billingAddress),
    order.user?.fullName
  );

  const items = Array.isArray(order.items)
    ? order.items.map((item) => ({
        id: item.id || item.uniqueId || null,
        name: item.name || null,
        quantity: item.quantity || 0,
        price: item.price ?? null,
      }))
    : [];

  return {
    token: order.token,
    invoiceNumber: order.invoiceNumber || null,
    status: order.status || null,
    paymentStatus: order.paymentStatus || null,
    customerEmail,
    customerName,
    trackingNumber: order.trackingNumber || null,
    trackingUrl: order.trackingUrl || null,
    createdAt: order.creationDate || order.completionDate || order.invoiceDate || null,
    total: order.finalGrandTotal ?? order.total ?? null,
    currency: order.currency || "usd",
    items,
    metadata: order.metadata || {},
  };
};

export const coerceOrderCollection = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.orders)) {
    return payload.orders;
  }

  return [];
};

export { SnipcartApiError };
