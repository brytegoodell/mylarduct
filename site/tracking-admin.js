const STORAGE_KEY = "mylarduct_admin_api_key";
const authForm = document.querySelector("#admin-auth-form");
const clearKeyButton = document.querySelector("#admin-clear-key");
const controlsNode = document.querySelector("#admin-controls");
const searchForm = document.querySelector("#admin-search-form");
const refreshButton = document.querySelector("#admin-refresh");
const orderList = document.querySelector("#admin-order-list");
const statusMessage = document.querySelector("#admin-status-message");
const adminKeyInput = document.querySelector("#admin-key");

const formatDate = (value) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatTotal = (amount, currency) => {
  if (typeof amount !== "number") {
    return "Total unavailable";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
};

const setStatusMessage = (message, tone = "neutral") => {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
};

const getAdminKey = () => window.sessionStorage.getItem(STORAGE_KEY) || "";

const setAdminKey = (value) => {
  if (!value) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, value);
};

const authorizedFetch = async (url, options = {}) => {
  const adminKey = getAdminKey();
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (adminKey) {
    headers.set("Authorization", `Bearer ${adminKey}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Request failed.");
  }

  return payload;
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderOrders = (orders) => {
  if (!orderList) {
    return;
  }

  if (!orders.length) {
    orderList.innerHTML = `
      <article class="admin-order-card">
        <p class="admin-order-meta">No matching orders found. Try a different status or search term.</p>
      </article>
    `;
    return;
  }

  orderList.innerHTML = orders
    .map((order) => {
      const itemSummary = order.items.length
        ? order.items.map((item) => `${escapeHtml(item.name || "Item")} x ${item.quantity || 0}`).join("<br />")
        : "No items available";

      return `
        <article class="admin-order-card" data-order-token="${escapeHtml(order.token)}">
          <div class="admin-order-head">
            <div>
              <h3>${escapeHtml(order.invoiceNumber || "Order")}</h3>
              <p class="admin-order-meta">${escapeHtml(order.customerName || "Customer unavailable")} · ${escapeHtml(order.customerEmail || "Email unavailable")}</p>
              <p class="admin-order-meta">Placed ${escapeHtml(formatDate(order.createdAt))} · ${escapeHtml(formatTotal(order.total, order.currency))}</p>
            </div>
            <span class="status-pill" data-status="${escapeHtml(order.status || "Processed")}">${escapeHtml(order.status || "Processed")}</span>
          </div>

          <div class="admin-order-summary">${itemSummary}</div>
          <p class="admin-order-current">Current tracking: ${escapeHtml(order.trackingNumber || "Not entered yet")}</p>

          <form class="admin-order-form" data-token="${escapeHtml(order.token)}">
            <label>
              Tracking number
              <input name="trackingNumber" type="text" value="${escapeHtml(order.trackingNumber || "")}" required />
            </label>

            <label>
              Tracking URL
              <input name="trackingUrl" type="url" value="${escapeHtml(order.trackingUrl || "")}" placeholder="https://tracking.example.com/..." />
            </label>

            <label>
              Order status
              <select name="status">
                <option value="Processed"${order.status === "Processed" ? " selected" : ""}>Processed</option>
                <option value="Shipped"${order.status === "Shipped" || !order.status ? " selected" : ""}>Shipped</option>
                <option value="Delivered"${order.status === "Delivered" ? " selected" : ""}>Delivered</option>
              </select>
            </label>

            <label>
              Customer note
              <textarea name="note" rows="3" placeholder="Optional shipment note for the customer email.">Fulfillment was handled by the manufacturer. Tracking is now available.</textarea>
            </label>

            <div class="admin-form-full">
              <label class="admin-checkbox">
                <input name="sendEmail" type="checkbox" checked />
                Send tracking email through Snipcart
              </label>
            </div>

            <div class="admin-form-actions">
              <button class="button button-primary" type="submit">Save Tracking</button>
            </div>
          </form>
        </article>
      `;
    })
    .join("");
};

const loadOrders = async () => {
  if (!searchForm) {
    return;
  }

  const params = new URLSearchParams();
  const formData = new FormData(searchForm);
  const query = formData.get("query")?.toString().trim();
  const status = formData.get("status")?.toString().trim();
  const limit = formData.get("limit")?.toString().trim();

  if (query) {
    params.set("q", query);
  }

  if (status) {
    params.set("status", status);
  }

  if (limit) {
    params.set("limit", limit);
  }

  setStatusMessage("Loading recent orders...", "neutral");

  try {
    const payload = await authorizedFetch(`/api/snipcart-orders?${params.toString()}`);
    renderOrders(payload.orders || []);
    setStatusMessage(`Loaded ${payload.count || 0} order${payload.count === 1 ? "" : "s"}.`, "success");
  } catch (error) {
    renderOrders([]);
    setStatusMessage(error.message || "Unable to load orders.", "error");
  }
};

const unlockControls = () => {
  if (controlsNode) {
    controlsNode.hidden = false;
  }
};

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submittedKey = adminKeyInput?.value.trim();

  if (!submittedKey) {
    setStatusMessage("Enter the admin access key to continue.", "error");
    return;
  }

  setAdminKey(submittedKey);
  unlockControls();
  await loadOrders();
});

clearKeyButton?.addEventListener("click", () => {
  setAdminKey("");
  if (adminKeyInput) {
    adminKeyInput.value = "";
  }
  if (controlsNode) {
    controlsNode.hidden = true;
  }
  if (orderList) {
    orderList.innerHTML = "";
  }
  setStatusMessage("Saved admin key cleared.", "success");
});

searchForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadOrders();
});

refreshButton?.addEventListener("click", async () => {
  await loadOrders();
});

orderList?.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches(".admin-order-form")) {
    return;
  }

  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const payload = {
    token: form.dataset.token,
    trackingNumber: formData.get("trackingNumber")?.toString().trim(),
    trackingUrl: formData.get("trackingUrl")?.toString().trim(),
    status: formData.get("status")?.toString().trim(),
    note: formData.get("note")?.toString().trim(),
    sendEmail: formData.get("sendEmail") === "on",
  };

  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
  }

  try {
    const response = await authorizedFetch("/api/snipcart-tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setStatusMessage(
      response.notificationSent
        ? `Tracking saved for ${response.order.invoiceNumber || "order"} and customer email sent.`
        : `Tracking saved for ${response.order.invoiceNumber || "order"}.`,
      "success"
    );
    await loadOrders();
  } catch (error) {
    setStatusMessage(error.message || "Unable to save tracking.", "error");
  } finally {
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = false;
      submitButton.textContent = "Save Tracking";
    }
  }
});

const existingKey = getAdminKey();
if (existingKey) {
  if (adminKeyInput) {
    adminKeyInput.value = existingKey;
  }
  unlockControls();
  loadOrders();
}
