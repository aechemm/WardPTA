# Google Apps Script setup (required once)

Keep the existing deployment URL until Cloudflare Pages is confirmed working.

## 1. Update the script

1. Open your Apps Script project attached to the Ward PTA spreadsheet.
2. Replace `Code.gs` with the contents of [`Code.gs`](./Code.gs) from this repo.
3. Keep `SignIn.html` in the Apps Script project (legacy host). You can leave the existing HTML file as-is.
4. Click **Save**.

## 2. Set the shared secret

1. In Apps Script: **Project Settings** (gear) → **Script Properties**.
2. Add property:
   - Property: `API_SECRET`
   - Value: the same long random string you will put in Cloudflare as `API_SECRET`
3. Do **not** put this value in GitHub, `index.html`, or chat logs if avoidable.

Generate a secret locally, for example:

```bash
openssl rand -hex 32
```

## 3. Deploy / update the web app

1. **Deploy** → **Manage deployments** → edit the existing deployment (or New deployment if needed).
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy / New version.

Copy the `/exec` URL. That value becomes Cloudflare’s `APPS_SCRIPT_URL`.

## 4. Optional: use a copy of the sheet for live testing

Before a real meeting, duplicate the spreadsheet (or add a `TEST-` member row) so development check-ins do not mark real attendance. If you point `SPREADSHEET_ID` at a copy, change it back before parents use the site.
