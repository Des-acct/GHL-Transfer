# GHL Integration — Manual Data Export

> **GoHighLevel API V2** · Private Integration · Read-Only Copy

This project connects to your GoHighLevel account using a **Private Integration Token** and exports all your data as local JSON files. No data is ever sent to external servers — everything stays on your machine.

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env
# Edit .env with your real GHL token and location ID

# 3. Validate your setup (no data fetched)
node trigger.js --dry-run

# 4. Run a full export
node trigger.js
```

---

## 🔐 Getting Your Credentials

### Private Integration Token

1. Log into your **GoHighLevel** dashboard
2. Go to **Settings → Integrations → Private Integrations**
3. Click **Create** → name it (e.g. "Antigravity Export")
4. Enable **all scopes** you want to export
5. **Copy the generated token** — you won't be able to see it again!
6. Paste it into your `.env` file as `GHL_API_TOKEN`

### Location ID

Your **Location ID** (sub-account ID) can be found in:
- Your GHL sub-account URL: `https://app.gohighlevel.com/v2/location/<LOCATION_ID>/...`
- Or in **Settings → Business Info**

Paste it into your `.env` file as `GHL_LOCATION_ID`

---

## 📖 Usage

### Full Export (all modules)
```bash
node trigger.js
```

### Dry Run (validate config, test connection)
```bash
node trigger.js --dry-run
```

### Selective Export (specific modules only)
```bash
node trigger.js --modules contacts,calendars,workflows
```

### Using the Antigravity Workflow
Type `/ghl-export` in the Antigravity command palette.

---

## 📦 Available Modules

| Module | What It Exports |
|---|---|
| `locations` | Sub-account details, custom fields, custom values, tags |
| `contacts` | All contacts with fields, tags, and metadata |
| `conversations` | SMS, email, and call conversation threads |
| `calendars` | Calendars and all scheduled events |
| `opportunities` | Sales pipelines and opportunity records |
| `workflows` | All automation workflows |
| `campaigns` | Marketing campaigns |
| `forms` | Forms + submissions, Surveys + submissions |
| `payments` | Orders, subscriptions, transactions, invoices |
| `users` | Users in the sub-account |

---

## 📁 Export Output

Exports are saved to `exports/<timestamp>/`:

```
exports/
└── 2026-02-23T12-14-00/
    ├── _summary.json          ← Overview: counts, timing, status
    ├── locations.json
    ├── contacts.json
    ├── conversations.json
    ├── calendars.json
    ├── opportunities.json
    ├── workflows.json
    ├── campaigns.json
    ├── forms.json
    ├── payments.json
    └── users.json
```

Each file contains the raw JSON data from GHL. The `_summary.json` contains:
- Total records exported per module
- API request count
- Elapsed time
- Success/failure status per module

---

## ⏱ Rate Limiting

The integration actively monitors GHL's rate limits:

| Limit | Value | Behavior |
|---|---|---|
| **Burst** | 100 requests / 10 seconds | Auto-pauses when ≤5 remaining |
| **Daily** | 200,000 requests / day | Aborts with warning when ≤100 remaining |

Rate limit status is logged to the console after every API call. You'll see real-time feedback like:
```
⏱  Rate Limit — Burst: 92/100 (92%)  |  Daily: 199,847/200,000 (99%)
```

---

## 🔒 Security

- ✅ Credentials stored in `.env` (gitignored)
- ✅ Private Integration Token (not OAuth — no public redirect)
- ✅ All data stays local — never sent to external endpoints
- ✅ Read-only operations — original GHL data is never modified
- ✅ No automated triggers — export runs only when you manually invoke it

---

## 🗂 Project Structure

```
GHL integration/
├── .env                  # Your credentials (gitignored)
├── .env.example          # Template
├── .gitignore
├── package.json
├── trigger.js            # ← Entry point (manual trigger)
├── README.md
├── src/
│   ├── config.js         # Env loader + validation
│   ├── ghl-client.js     # Authenticated HTTP client
│   ├── rate-limiter.js   # Rate-limit header monitor
│   ├── orchestrator.js   # Module runner + file writer
│   └── modules/
│       ├── contacts.js
│       ├── conversations.js
│       ├── calendars.js
│       ├── opportunities.js
│       ├── workflows.js
│       ├── campaigns.js
│       ├── forms.js
│       ├── payments.js
│       ├── users.js
│       └── locations.js
├── exports/              # Output directory (gitignored)
└── .agent/workflows/
    └── ghl-export.md     # Antigravity workflow command
```
