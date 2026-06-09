# Snipcart + Stripe Setup

Netlify environment variables for the current storefront:

- `SNIPCART_PUBLIC_API_KEY`
- `SNIPCART_SECRET_API_KEY`
- `SNIPCART_ADMIN_API_KEY`

How the current setup works:

- Standard size cards use Snipcart product buttons directly on the page
- Snipcart handles checkout, taxes, order confirmation emails, and customer order management
- Stripe stays connected as the payment processor inside the Snipcart dashboard
- Manufacturer fulfillment language is shown on the storefront
- Manual tracking updates are handled at `/tracking-admin.html`
- Tracking updates are sent through:
  - `GET /api/snipcart-orders`
  - `POST /api/snipcart-tracking`

Snipcart dashboard steps:

1. Connect Stripe as the payment gateway inside Snipcart.
2. Add `https://mylarduct.com` as an allowed domain in Snipcart.
3. Configure taxes in the Snipcart dashboard.
4. Configure shipping methods in the Snipcart dashboard.
   Use product weight rules if you want rates tied to box weight.
   The storefront buttons already include `data-item-weight` in grams, converted from the current box weights.
5. Confirm the tracking numbers email template says fulfillment is handled by the manufacturer.

Tracking admin workflow:

1. Open `https://mylarduct.com/tracking-admin.html`
2. Enter the admin access key from `SNIPCART_ADMIN_API_KEY`
3. Load recent orders
4. Enter the tracking number and tracking URL after the manufacturer ships
5. Save the update and leave `Send tracking email through Snipcart` checked

What the customer receives:

1. Snipcart order confirmation after purchase
2. Snipcart tracking email after tracking is entered in the admin page

Notes:

- This setup does not generate shipping labels
- This setup does not use ShipStation
- Stripe is used only as the connected payment gateway inside Snipcart
