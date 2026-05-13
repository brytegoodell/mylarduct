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

const checkoutButtons = document.querySelectorAll("[data-checkout-size]");
checkoutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Opening...";

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size: button.getAttribute("data-checkout-size"),
          quantity: 1,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Checkout unavailable.");
      }

      window.location.href = payload.url;
    } catch (error) {
      window.alert(error.message || "Checkout unavailable.");
      button.disabled = false;
      button.textContent = originalText;
    }
  });
});
