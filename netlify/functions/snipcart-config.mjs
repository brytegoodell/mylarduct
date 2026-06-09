import { getSnipcartPublicKey, jsonResponse } from "./lib/snipcart.mjs";

export default async (request) => {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const publicApiKey = getSnipcartPublicKey();
  if (!publicApiKey) {
    return jsonResponse({ error: "Snipcart public API key is not configured yet." }, 500, {
      "Cache-Control": "no-store",
    });
  }

  return jsonResponse(
    {
      publicApiKey,
      version: "3.7.1",
      currency: "usd",
      addProductBehavior: "none",
      modalStyle: "side",
    },
    200,
    { "Cache-Control": "no-store" }
  );
};

export const config = {
  path: "/api/snipcart-config",
  preferStatic: true,
};
