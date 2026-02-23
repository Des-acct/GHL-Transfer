# KissHub — GHL Data Transfer Console

A web-based dashboard for exporting data from GoHighLevel (GHL) CRM via API V2.

## Features

- **16 GHL Modules**: Contacts, Opportunities, Pipelines, Tasks, Tags, Custom Fields, Custom Values, Conversations, Email Templates, Calendars, Appointments, Workflows, Forms, Surveys, Media Library, Reporting
- **Dynamic Filters**: Each module loads filter options from GHL API (pipelines, stages, tags, etc.)
- **Real API Integration**: Exports actual data from your GHL sub-account
- **Single Export Directory**: All exports saved as JSON in `exports/` — same files used for import
- **Download**: Each exported module provides a direct JSON download link
- **Error Reporting**: Failed exports show the specific error reason

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your GHL credentials
npm run serve
# Open http://localhost:3000
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GHL_API_TOKEN` | GHL Private Integration Token (`pit-...`) |
| `GHL_LOCATION_ID` | GHL Sub-Account / Location ID |
| `PORT` | Server port (default: 3000) |

## Deploy to Vercel

1. Import this repo in [vercel.com](https://vercel.com)
2. Add `GHL_API_TOKEN` and `GHL_LOCATION_ID` as environment variables
3. Deploy

## Demo Login

- Email: `admin@kinetic.com`
- Password: `kinetic123`
