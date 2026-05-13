# MylarDuct Netlify Project

This folder is the standalone deploy root for `mylarduct.com`.

Project structure:

- `site/` static site files
- `netlify/functions/` Stripe Checkout function
- `netlify.toml` Netlify project config

Deploy this folder as its own Netlify project root. Do not deploy only the `site/` folder, or Checkout functions will be missing.
