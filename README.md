# BASIC.AUTOGROUP car service booking

This project delivers a lightweight, three-step booking experience for BASIC.AUTOGROUP customers. It now persists to a SQL-backed store (SQLite for local use) and is structured to plug into AWS-hosted relational storage when credentials are provided.

## Features
- Landing page that highlights the workshop and links into the booking flow.
- Service selection with pricing, add/remove support, and a running summary.
- Availability selector that surfaces 30-minute slots between 8:00 AM and 3:00 PM, grouped into morning and afternoon and instantly marks slots as unavailable when already booked.
- Checkout with personal details, optional appointment notes, cancellation policy acknowledgment (with expandable policy text), payment fields, promo codes, and a live appointment summary (subtotal, inclusive tax, discounts, total).
- Booking API that prevents double-booking and applies promo codes (SAVE10, VIP15, NEIGHBOUR5).

## Running locally
1. Ensure Node.js 18+ is installed.
2. Install dependencies (SQLite driver):
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Visit `http://localhost:3000` to use the booking experience.

A `data/app.db` SQLite file will be created automatically to hold services and appointments. Delete it to start fresh.

## AWS and SQL notes
The backend exposes SQL-style queries and structure that can be wired to AWS RDS or Aurora. Provide the following environment variables to connect your preferred SQL host (connection code can be added in `server.js` where the local SQLite store is currently used):
- `AWS_RDS_HOST`
- `AWS_RDS_PORT`
- `AWS_RDS_USER`
- `AWS_RDS_PASSWORD`
- `AWS_RDS_DATABASE`

Until those are set and a different driver is added, the bundled SQLite persistence is used for local development.
