# RouteLedger Cloudflare Portal (Member & Office Web App)

This standalone React + Vite + Tailwind app is designed to be hosted on **Cloudflare Pages** and connected to your **Supabase** database.

## How It Works

1. **Offline Desktop App -> Supabase**:
   - The main offline app stores every change locally in IndexedDB so it works 100% offline.
   - Whenever internet is available, it uploads queued changes to Supabase via `office_sync_push`.
2. **Member Login (`Member ID` + default password `0000`)**:
   - Every synced member can open the Cloudflare link and sign in using their **Member ID** (e.g., `ADA-0001`) and default password **`0000`**.
   - Once inside, they can change their password to a private password.
3. **Role-Based Views (Enforced in Supabase PostgreSQL)**:
   - **Regular `Member`**: Sees **only** their own profile, digital ID card, truck/compliance expiry dates, payments & official receipts, overdue dues, penalties, trips, mutual aid, and incidents.
   - **Office Roles** (`Manager`, `Vice manager`, `Chairperson`, `Accountant`, `Treasurer`, or any role selected in the offline app's Settings): Signs in with their own Member ID and sees the **full office workspace** synced with Supabase.

## Setup Steps

### 1. Set Up Supabase
1. Create a free Supabase project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your Supabase Dashboard and run the entire contents of `../supabase/schema.sql`.
3. In **Project Settings -> API**, copy your **Project URL** and **`anon` public key**.
4. Open the offline desktop app -> **Settings -> Supabase Cloud Sync & Cloudflare Member Portal**, paste the URL, Anon Key, and choose an **Office Sync Secret** (6+ characters), then click **Upload All Offline Data to Supabase**.

### 2. Deploy This Folder to Cloudflare Pages
1. Connect this repository in Cloudflare Dashboard -> **Workers & Pages -> Create -> Pages** (or run locally with Wrangler):
   - **Root directory**: `cloudflare-portal`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
2. Add **Environment Variables** in Cloudflare Pages Settings:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase `anon` public key
3. Or deploy via CLI:
   ```bash
   cd cloudflare-portal
   npm install
   npm run build
   npx wrangler pages deploy dist
   ```
