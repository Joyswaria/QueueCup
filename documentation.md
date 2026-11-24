# QueueCup

QueueCup is a café simulation. Browse the menu, add items to your cart, and place your order! Each completed purchase increases demand and sales volume. By default, the price rises by €0.05 per unit sold, with a cap of 150% of the original price.

The React frontend interacts with a TypeScript API built with Fastify. PostgreSQL stores the menu, current prices, and order receipts. If a price changes before checkout completes, the cart asks you to review the updated total.

## First-time setup

Install Node.js 24 and start Docker Desktop. From the repository root, run these commands in PowerShell.

```powershell
docker compose up -d --wait db
cd backend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run migrate
npm.cmd run dev
```

Leave that terminal running. Open a second terminal at the repository root and run the frontend.

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite, usually <http://localhost:5173>. Go to **Market**, add an item, then open **Cart** and select **Place simulated order**.

## Starting the app again

Start Docker Desktop if needed. From the repository root, run the database and backend in one terminal.

```powershell
docker compose up -d --wait db
cd backend
npm.cmd run dev
```

In another terminal at the repository root, start the frontend.

```powershell
cd frontend
npm.cmd run dev
```

Run `npm.cmd ci` again in either project when its dependencies change. Run `npm.cmd run migrate` from `backend` when you pull new migrations.

## Stopping

Press **Ctrl+C** in both terminals. To stop PostgreSQL, run `docker compose stop db` from the repository root or stop it from your docker interface.
