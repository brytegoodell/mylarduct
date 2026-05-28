import { getDeployStore, getStore } from "@netlify/blobs";

const getEnv = (key) => Netlify.env.get(key);

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const getEventStore = () => {
  const deployContext = Netlify.context?.deploy?.context;

  if (deployContext === "production") {
    return getStore("stripe-order-events", { consistency: "strong" });
  }

  return getDeployStore("stripe-order-events");
};

const parseStripeSignature = (header) => {
  if (!header) {
    return null;
  }

  const parsed = { timestamp: null, signatures: [] };

  for (const segment of header.split(",")) {
    const [key, value] = segment.split("=");
    if (!key || !value) {
      continue;
    }

    if (key === "t") {
      parsed.timestamp = value;
    }

    if (key === "v1") {
      parsed.signatures.push(value);
    }
  }

  if (!parsed.timestamp || parsed.signatures.length === 0) {
    return null;
  }

  return parsed;
};

const timingSafeEqual = (left, right) => {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
};

const signStripePayload = async (payload, secret) => {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const verifyStripeSignature = async (payload, header, secret) => {
  const parsedHeader = parseStripeSignature(header);

  if (!parsedHeader) {
    return false;
  }

  const timestampMs = Number.parseInt(parsedHeader.timestamp, 10) * 1000;
  if (Number.isNaN(timestampMs)) {
    return false;
  }

  const maxAgeMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestampMs) > maxAgeMs) {
    return false;
  }

  const signedPayload = `${parsedHeader.timestamp}.${payload}`;
  const expectedSignature = await signStripePayload(signedPayload, secret);

  return parsedHeader.signatures.some((candidate) =>
    timingSafeEqual(candidate, expectedSignature)
  );
};

const toCurrencyAmount = (amount, currency) => {
  if (typeof amount !== "number") {
    return null;
  }

  return {
    amount,
    currency: currency || null,
    decimal: amount / 100,
  };
};

const summarizeCheckoutSession = (session) => ({
  sessionId: session.id,
  status: session.status || null,
  paymentStatus: session.payment_status || null,
  size: session.metadata?.size || session.client_reference_id || null,
  shippingMode: session.metadata?.shipping_mode || null,
  amountTotal: toCurrencyAmount(session.amount_total, session.currency),
  customerEmail: session.customer_details?.email || session.customer_email || null,
  customerName: session.customer_details?.name || null,
  paymentIntentId: session.payment_intent || null,
});

const summarizePaymentIntentFailure = (paymentIntent) => ({
  paymentIntentId: paymentIntent.id,
  status: paymentIntent.status || null,
  size: paymentIntent.metadata?.size || null,
  shippingMode: paymentIntent.metadata?.shipping_mode || null,
  amount: toCurrencyAmount(paymentIntent.amount, paymentIntent.currency),
  customerEmail: paymentIntent.receipt_email || null,
  lastPaymentError: paymentIntent.last_payment_error
    ? {
        code: paymentIntent.last_payment_error.code || null,
        declineCode: paymentIntent.last_payment_error.decline_code || null,
        message: paymentIntent.last_payment_error.message || null,
        type: paymentIntent.last_payment_error.type || null,
      }
    : null,
});

const summarizeChargeFailure = (charge) => ({
  chargeId: charge.id,
  paymentIntentId: charge.payment_intent || null,
  amount: toCurrencyAmount(charge.amount, charge.currency),
  customerEmail: charge.billing_details?.email || null,
  failureCode: charge.failure_code || null,
  failureMessage: charge.failure_message || null,
  outcomeType: charge.outcome?.type || null,
  outcomeMessage: charge.outcome?.seller_message || null,
});

const summarizeStripeEvent = (event) => {
  const base = {
    eventId: event.id,
    type: event.type,
    livemode: Boolean(event.livemode),
    createdAt: new Date(event.created * 1000).toISOString(),
  };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      return {
        ...base,
        details: summarizeCheckoutSession(event.data.object),
      };
    case "payment_intent.payment_failed":
      return {
        ...base,
        details: summarizePaymentIntentFailure(event.data.object),
      };
    case "charge.failed":
      return {
        ...base,
        details: summarizeChargeFailure(event.data.object),
      };
    default:
      return {
        ...base,
        details: {
          objectId: event.data?.object?.id || null,
        },
      };
  }
};

export default async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return jsonResponse({ error: "Stripe webhook is not configured yet." }, 500);
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  const isValid = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);

  if (!isValid) {
    return jsonResponse({ error: "Invalid Stripe signature." }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid event payload." }, 400);
  }

  const interestingEvents = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "payment_intent.payment_failed",
    "charge.failed",
  ]);

  if (!interestingEvents.has(event.type)) {
    return jsonResponse({ received: true, ignored: true });
  }

  const summary = summarizeStripeEvent(event);
  const store = getEventStore();
  const key = `${summary.createdAt}__${summary.eventId}.json`;

  await store.setJSON(key, summary);
  console.log("stripe-order-event", JSON.stringify(summary));

  return jsonResponse({ received: true });
};

export const config = {
  path: "/api/stripe-webhook",
  preferStatic: true,
};
