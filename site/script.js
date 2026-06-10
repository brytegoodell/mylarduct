const yearNode = document.querySelector("#current-year");
if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}

const revealNodes = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window && revealNodes.length > 0) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealNodes.forEach((node) => revealObserver.observe(node));
} else {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
}

const snipcartContainer = document.querySelector("#snipcart");
const snipcartButtons = Array.from(document.querySelectorAll(".snipcart-add-item"));
const cartTriggers = Array.from(document.querySelectorAll(".snipcart-checkout"));
const snipcartStatus = document.querySelector("[data-snipcart-status]");
const SNIPCART_CONFIG_ENDPOINT = "/api/snipcart-config";
const SNIPCART_DEFAULT_VERSION = "3.7.1";
const snipcartState = {
  config: null,
  loading: false,
  loaded: false,
  ready: false,
  readyPromise: null,
};

const setSnipcartStatus = (message, tone = "neutral") => {
  if (!snipcartStatus) {
    return;
  }

  snipcartStatus.textContent = message;
  snipcartStatus.dataset.tone = tone;
};

const markSnipcartUnavailable = (message) => {
  setSnipcartStatus(message, "error");
  snipcartButtons.forEach((button) => {
    button.disabled = true;
  });
};

const fetchSnipcartConfig = async () => {
  if (snipcartState.config) {
    return snipcartState.config;
  }

  const response = await fetch(SNIPCART_CONFIG_ENDPOINT, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json();

  if (!response.ok || !payload?.publicApiKey) {
    throw new Error(payload?.error || "Checkout is unavailable right now.");
  }

  snipcartState.config = payload;
  return payload;
};

const appendOnce = (selector, createNode) => {
  const existing = document.querySelector(selector);
  if (existing) {
    return existing;
  }

  const node = createNode();
  document.head.append(node);
  return node;
};

const configureSnipcartContainer = (config) => {
  if (!snipcartContainer) {
    throw new Error("Snipcart container is missing.");
  }

  snipcartContainer.dataset.apiKey = config.publicApiKey;
  snipcartContainer.dataset.currency = config.currency || "usd";
  snipcartContainer.dataset.configAddProductBehavior = config.addProductBehavior || "none";
  snipcartContainer.dataset.configModalStyle = config.modalStyle || "side";
};

const waitForSnipcartReady = () => {
  if (snipcartState.readyPromise) {
    return snipcartState.readyPromise;
  }

  snipcartState.readyPromise = new Promise((resolve, reject) => {
    if (window.Snipcart) {
      snipcartState.ready = true;
      resolve(window.Snipcart);
      return;
    }

    const onReady = () => {
      snipcartState.ready = true;
      document.removeEventListener("snipcart.ready", onReady);
      resolve(window.Snipcart);
    };

    document.addEventListener("snipcart.ready", onReady, { once: true });

    window.setTimeout(() => {
      if (!snipcartState.ready) {
        document.removeEventListener("snipcart.ready", onReady);
        reject(new Error("Checkout did not finish loading."));
      }
    }, 12000);
  });

  return snipcartState.readyPromise;
};

const loadSnipcartAssets = async () => {
  if (snipcartState.loaded) {
    return waitForSnipcartReady();
  }

  if (snipcartState.loading) {
    return waitForSnipcartReady();
  }

  snipcartState.loading = true;
  const config = await fetchSnipcartConfig();
  configureSnipcartContainer(config);

  const version = config.version || SNIPCART_DEFAULT_VERSION;
  window.SnipcartSettings = {
    publicApiKey: config.publicApiKey,
    version,
    currency: config.currency || "usd",
    addProductBehavior: config.addProductBehavior || "none",
    modalStyle: config.modalStyle || "side",
  };

  appendOnce('link[data-snipcart-css="true"]', () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://cdn.snipcart.com/themes/v${version}/default/snipcart.css`;
    link.dataset.snipcartCss = "true";
    return link;
  });

  const scriptNode = document.querySelector('script[data-snipcart-script="true"]')
    || (() => {
      const script = document.createElement("script");
      script.src = `https://cdn.snipcart.com/themes/v${version}/default/snipcart.js`;
      script.async = true;
      script.dataset.snipcartScript = "true";
      document.body.append(script);
      return script;
    })();

  scriptNode.addEventListener("error", () => {
    markSnipcartUnavailable("Checkout could not load. Please try again.");
  }, { once: true });

  const ready = await waitForSnipcartReady();
  snipcartState.loading = false;
  snipcartState.loaded = true;
  setSnipcartStatus(
    "Secure checkout, taxes, and order confirmation through Snipcart.",
    "ready"
  );

  return ready;
};

const bootstrapSnipcart = (() => {
  let bootRequested = false;

  return async () => {
    if (bootRequested) {
      return loadSnipcartAssets();
    }

    bootRequested = true;
    setSnipcartStatus("Loading secure checkout...", "loading");
    return loadSnipcartAssets();
  };
})();

const triggerSnipcartLoadOnInteraction = () => {
  const handler = () => {
    bootstrapSnipcart().catch((error) => {
      markSnipcartUnavailable(error.message || "Checkout unavailable.");
    });
  };

  ["focus", "mouseover", "touchstart", "scroll", "keydown"].forEach((eventName) => {
    document.addEventListener(eventName, handler, { once: true, passive: true });
  });

  window.setTimeout(() => {
    bootstrapSnipcart().catch((error) => {
      markSnipcartUnavailable(error.message || "Checkout unavailable.");
    });
  }, 2500);
};

snipcartButtons.forEach((button) => {
  button.addEventListener("click", async (event) => {
    if (snipcartState.ready) {
      return;
    }

    event.preventDefault();
    button.disabled = true;

    try {
      await bootstrapSnipcart();
      button.disabled = false;
      button.click();
    } catch (error) {
      button.disabled = false;
      window.alert(error.message || "Checkout unavailable.");
    }
  });
});

cartTriggers.forEach((trigger) => {
  trigger.addEventListener("click", async (event) => {
    if (snipcartState.ready) {
      return;
    }

    event.preventDefault();

    try {
      const snipcart = await bootstrapSnipcart();
      snipcart.api.theme.cart.open();
    } catch (error) {
      window.alert(error.message || "Checkout unavailable.");
    }
  });
});

triggerSnipcartLoadOnInteraction();