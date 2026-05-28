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

const isAuthorized = (request) => {
  const apiKey = getEnv("ORDER_LOG_API_KEY");
  if (!apiKey) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const headerKey = request.headers.get("x-order-log-key");
  const queryKey = new URL(request.url).searchParams.get("key");

  if (authHeader === `Bearer ${apiKey}`) {
    return true;
  }

  return headerKey === apiKey || queryKey === apiKey;
};

export default async (request) => {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  if (!getEnv("ORDER_LOG_API_KEY")) {
    return jsonResponse({ error: "Order log viewer is not configured yet." }, 500);
  }

  if (!isAuthorized(request)) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const url = new URL(request.url);
  const requestedType = url.searchParams.get("type");
  const requestedLimit = Number.parseInt(url.searchParams.get("limit"), 10);
  const limit = Number.isNaN(requestedLimit)
    ? 25
    : Math.min(Math.max(requestedLimit, 1), 100);

  const store = getEventStore();
  const { blobs } = await store.list();
  const orderedKeys = blobs
    .map((blob) => blob.key)
    .sort((left, right) => right.localeCompare(left));

  const events = [];

  for (const key of orderedKeys) {
    if (events.length >= limit) {
      break;
    }

    const entry = await store.get(key, { type: "json" });
    if (!entry) {
      continue;
    }

    if (requestedType && entry.type !== requestedType) {
      continue;
    }

    events.push(entry);
  }

  return jsonResponse({
    count: events.length,
    events,
  });
};

export const config = {
  path: "/api/order-events",
  preferStatic: true,
};
