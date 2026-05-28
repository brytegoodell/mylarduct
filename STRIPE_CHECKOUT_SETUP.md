# Stripe Checkout Setup

Add these Netlify environment variables on the `mylarduct` site:

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_6_INCH`
- `STRIPE_PRICE_8_INCH`
- `STRIPE_PRICE_10_INCH`
- `STRIPE_PRICE_12_INCH`
- `STRIPE_PRICE_14_INCH`
- `STRIPE_PRICE_16_INCH`
- `STRIPE_PRICE_18_INCH`
- `STRIPE_PRICE_20_INCH`
- `STRIPE_SHIPPING_RATE_6_8_10_12`
- `STRIPE_SHIPPING_RATE_14_16_18_20`
- `STRIPE_WEBHOOK_SECRET`

Optional:

- `STRIPE_AUTOMATIC_TAX=true`
- `ORDER_LOG_API_KEY`

How this is wired:

- Standard size cards call `/api/checkout`
- Standard checkout can include size-group shipping rates
- Checkout success returns to `/thank-you.html`
- Checkout cancel returns to `/#specs`
- Stripe webhook events post to `/api/stripe-webhook`
- Protected event viewer lives at `/api/order-events`

Before launch:

1. Create one Stripe Price for each size.
2. Create one shipping rate for `6/8/10/12` and one shipping rate for `14/16/18/20`.
3. In Stripe, add a webhook endpoint for `https://mylarduct.com/api/stripe-webhook`.
4. Subscribe the webhook to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
   - `charge.failed`
5. Add the environment variables in Netlify.
6. Set `ORDER_LOG_API_KEY` if you want a protected JSON viewer for events.
7. Test in Stripe test mode first.

To inspect captured events later:

- Send a `GET` request to `/api/order-events`
- Include either `Authorization: Bearer YOUR_ORDER_LOG_API_KEY`
- Or `x-order-log-key: YOUR_ORDER_LOG_API_KEY`
- Optional query params:
  - `limit=25`
  - `type=payment_intent.payment_failed`
