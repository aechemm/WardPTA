# Ward PTA Meeting Sign-In

Public meeting check-in site for Ward Traditional Academy PTA.

**Architecture:** GitHub → Cloudflare Pages (+ Pages Function) → Google Apps Script → Google Sheets

Parents never sign into Google. The Cloudflare Function proxies requests to Apps Script using a shared secret stored only in Cloudflare and Apps Script Properties.

## Project layout

```
public/                 Static site (index.html) served by Cloudflare Pages
functions/api/checkin.js  Same-origin API proxy → Apps Script
functions/_lib/         Shared validation + Apps Script HTTP helpers
apps-script/            Source to paste into Google Apps Script
tests/                  Automated tests (no live spreadsheet required)
```

## Features (preserved)

- Ward PTA branding, logo, social QR codes, colors, mobile layout
- Member autocomplete (partial first/last name via browser datalist)
- Member check-in writes `X` in today’s date column on `Members 2026-2027`
- Non-member form writes to a `Meeting yyyy-MM-dd` tab
- Loading / success / error messages; buttons disable while submitting

## Quick local test (no Google / Cloudflare account needed)

```bash
npm install
npm test
```

Optional end-to-end with a mock backend:

```bash
# terminal 1
API_SECRET=test-secret MOCK_REDIRECT=1 npm run mock:apps-script

# terminal 2 — create .dev.vars (gitignored):
#   APPS_SCRIPT_URL=http://127.0.0.1:8788/exec
#   API_SECRET=test-secret
npx wrangler pages dev public --compatibility-date=2024-11-01
```

Open the printed `http://localhost:…` URL. Member list should load; try signing in as `Test Member`.

## Production deploy

### A. Google Apps Script

Follow [`apps-script/SETUP.md`](apps-script/SETUP.md):

1. Paste updated `Code.gs`
2. Set Script Property `API_SECRET`
3. Redeploy web app: **Execute as Me**, **Anyone**
4. Keep the existing `/exec` URL (do not delete the old deployment yet)

### B. GitHub

This project lives in the connected repository. Preferred repo name: `ward-pta-signin` (rename in GitHub settings if desired). Keep the repo **private**.

### C. Cloudflare Pages (free tier)

1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select this repository.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. **Environment variables** (Production and Preview):
   - `APPS_SCRIPT_URL` = your Apps Script `/exec` URL
   - `API_SECRET` = same value as Apps Script Script Property (mark as **Secret**)
5. Save and deploy.
6. Note the permanent URL: `https://ward-pta-signin.pages.dev` (or the project name you chose). Custom domains are optional and free on Cloudflare.

Automatic deploys: every push to the production branch updates the site.

### D. Smoke test before swapping the QR code

- [ ] Site loads with no Google account
- [ ] Site loads while multiple Google accounts are signed in (browser)
- [ ] Member autocomplete populates
- [ ] Member check-in writes `X` for today (use a test row / sheet copy)
- [ ] Non-member form creates/updates `Meeting yyyy-MM-dd`
- [ ] Invalid name shows a clear error
- [ ] Double-clicking Sign In does not send duplicate concurrent requests (button disables)
- [ ] Usable on phone-width viewport

Only after those pass: update any printed/QR links to the Cloudflare URL. Leave the old Apps Script HTML host in place until you are confident.

## Security notes

- Shared secret is **never** shipped to the browser.
- A public check-in endpoint cannot fully prove a visitor is a parent; rate limiting (Cache API) and input length limits reduce abuse.
- Enable Cloudflare **Bot Fight Mode** (free) on the zone if you attach a custom domain.
- Member list returned to the browser is names only (same as the previous app).

## Spreadsheet

- Spreadsheet ID: configured in `apps-script/Code.gs` (`SPREADSHEET_ID`)
- Membership tab: `Members 2026-2027`
