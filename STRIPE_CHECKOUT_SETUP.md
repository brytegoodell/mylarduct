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

Optional:

- `STRIPE_AUTOMATIC_TAX=true`

How this is wired:

- Standard size cards call `/api/checkout`
- Standard checkout can include size-group shipping rates
- Checkout success returns to `/thank-you.html`
- Checkout cancel returns to `/#specs`

Before launch:

1. Create one Stripe Price for each size.
2. Create one shipping rate for `6/8/10/12` and one shipping rate for `14/16/18/20`.
3. Add the environment variables in Netlify.
4. Test in Stripe test mode first.
