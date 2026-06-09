# MylarDuct Netlify Project

This folder is the standalone deploy root for `mylarduct.com`.

Project structure:

- `site/` static site files
- `netlify/functions/` Snipcart config/admin functions plus legacy Stripe utilities
- `netlify.toml` Netlify project config

Current storefront flow:

- Snipcart handles checkout, taxes, order confirmations, and customer emails
- Stripe stays connected as the payment processor inside Snipcart
- Fulfillment is handled by the manufacturer
- Tracking is entered manually at `/tracking-admin.html` after the manufacturer ships

Deploy this folder as its own Netlify project root. Do not deploy only the `site/` folder, or the Snipcart admin/config functions will be missing.

Setup details live in `SNIPCART_SETUP.md`.
