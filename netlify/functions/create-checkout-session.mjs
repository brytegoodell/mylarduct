const getEnv = (key) => Netlify.env.get(key);

const PRICE_MAP = {
  "6 inch": () => getEnv("STRIPE_PRICE_6_INCH"),
  "8 inch": () => getEnv("STRIPE_PRICE_8_INCH"),
  "10 inch": () => getEnv("STRIPE_PRICE_10_INCH"),
  "12 inch": () => getEnv("STRIPE_PRICE_12_INCH"),
  "14 inch": () => getEnv("STRIPE_PRICE_14_INCH"),
  "16 inch": () => getEnv("STRIPE_PRICE_16_INCH"),
  "18 inch": () => getEnv("STRIPE_PRICE_18_INCH"),
  "20 inch": () => getEnv("STRIPE_PRICE_20_INCH"),
};

const SHIPPING_RATE_MAP = {
  "6 inch": () => getEnv("STRIPE_SHIPPING_RATE_6_8_10_12") || "shr_1TWlUEI3hOTrJDXohLVZoAL4",
  "8 inch": () => getEnv("STRIPE_SHIPPING_RATE_6_8_10_12") || "shr_1TWlUEI3hOTrJDXohLVZoAL4",
  "10 inch": () => getEnv("STRIPE_SHIPPING_RATE_6_8_10_12") || "shr_1TWlUEI3hOTrJDXohLVZoAL4",
  "12 inch": () => getEnv("STRIPE_SHIPPING_RATE_6_8_10_12") || "shr_1TWlUEI3hOTrJDXohLVZoAL4",
  "14 inch": () => getEnv("STRIPE_SHIPPING_RATE_14_16_18_20"),
  "16 inch": () => getEnv("STRIPE_SHIPPING_RATE_14_16_18_20"),
  "18 inch": () => getEnv("STRIPE_SHIPPING_RATE_14_16_18_20"),
  "20 inch": () => getEnv("STRIPE_SHIPPING_RATE_14_16_18_20"),
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const secretKey = getEnv("STRIPE_SECRET_KEY");
  if (!secretKey) {
    return jsonResponse({ error: "Stripe is not configured yet." }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const size = payload?.size;
  const quantity = Number.parseInt(payload?.quantity, 10) || 1;
  const priceId = PRICE_MAP[size]?.();
  const shippingRateId = SHIPPING_RATE_MAP[size]?.();

  if (!size || !priceId) {
    return jsonResponse({ error: "Invalid or unconfigured size." }, 400);
  }

  if (quantity < 1 || quantity > 99) {
    return jsonResponse({ error: "Quantity must be between 1 and 99." }, 400);
  }

  const siteOrigin = new URL(request.url).origin;
  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", `${siteOrigin}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${siteOrigin}/#specs`);
  params.append("line_items[0][price]", priceId);
  params.append("line_items[0][quantity]", String(quantity));
  params.append("billing_address_collection", "required");
  params.append("phone_number_collection[enabled]", "true");
  params.append("shipping_address_collection[allowed_countries][0]", "US");
  params.append("client_reference_id", size);
  params.append("metadata[size]", size);
  params.append("metadata[shipping_mode]", "standard");
  params.append("metadata[order_channel]", "mylarduct_web");
  params.append("payment_intent_data[metadata][size]", size);
  params.append("payment_intent_data[metadata][shipping_mode]", "standard");
  params.append("payment_intent_data[metadata][order_channel]", "mylarduct_web");

  if (shippingRateId) {
    params.append("shipping_options[0][shipping_rate]", shippingRateId);
  }

  if (getEnv("STRIPE_AUTOMATIC_TAX") === "true") {
    params.append("automatic_tax[enabled]", "true");
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const result = await response.json();
  if (!response.ok) {
    return jsonResponse(
      { error: result?.error?.message || "Unable to create checkout session." },
      response.status
    );
  }

  return jsonResponse({ url: result.url });
};

export const config = {
  path: "/api/checkout",
  preferStatic: true,
};
