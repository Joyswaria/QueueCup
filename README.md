# QueueCup

QueueCup simulates a café market. A completed order raises demand and sales volume, and connected shoppers see updated prices live. Purchases are simulated.

## Local development

Use Node.js 24. Start the development database with Docker Compose or supply a PostgreSQL connection string in `backend/.env`.

```sh
docker compose up -d --wait db
cd backend
npm ci
```

Copy `backend/.env.example` to `backend/.env`. From `backend/`, run the migrations and start the API.

```sh
npm run migrate
npm run dev
```

In another terminal, start the frontend.

```sh
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. Vite proxies `/api` to `http://127.0.0.1:3000` by default. Set `QUEUECUP_API_TARGET` when starting Vite to use a different API address.

## Market behaviour

- The cart shows live prices. At checkout, PostgreSQL records the confirmed prices and applies market changes in one transaction. If a quoted price has changed, the shopper reviews the updated total before trying again.
- The seeded products rise by €0.05 per unit sold, up to 150% of base price. The increments and ceilings are per-product database settings. Demand and lifetime volume both accumulate with purchases in this release.
- The client retains the same request key and payload when a checkout result is uncertain. The market stream sends a fresh snapshot on reconnect, and the client applies updates by product revision.

| Endpoint | Behaviour |
| --- | --- |
| `GET /api/market` | Returns the catalog and current prices, demand, volume, and revisions. |
| `POST /api/orders` | Takes an `Idempotency-Key` header and a JSON body with `lines` containing `itemId`, `quantity`, and `unitPriceCents`. Returns a receipt or `409 PRICE_CHANGED` with updated items. A successful retry returns the original receipt. |
| `GET /api/market/stream` | Sends `market-snapshot` and `market-update` events. |
| `GET /api/ready` | Returns `200` when the market table is accessible or `503` when the database is unavailable. |

## Verification

Run `npm run build` in both projects and `npm run lint` in `frontend/`. Run `npm test` in `backend/`. Set `TEST_DATABASE_URL` to enable the integration tests. They create and remove an isolated schema, so the test role needs permission to create schemas in that database.

## Deployment

Run one API process so all market subscribers receive the same updates. Set `DATABASE_URL` to the deployment database, run `npm run migrate` from `backend/` as a release step, and run `npm run build` followed by `npm start` for the API. Build the frontend with `npm run build` from `frontend/`.

Serve `frontend/dist` over HTTPS and proxy `/api/` on the same origin. Configure your host to fall back to `index.html` for React routes and to keep the market stream unbuffered. For example, use these locations in an Nginx server block with its root set to the frontend build directory.

```nginx
location / {
    try_files $uri $uri/ /index.html;
}

location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 60s;
}
```

Use `/api/ready` as the readiness probe. Keep the API and PostgreSQL ports private to the deployment.
