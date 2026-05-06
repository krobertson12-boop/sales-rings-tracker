# Sales Activity Tracker — Deployment Guide

## 🚀 Quick Start (5 minutes)

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → Sign up
2. Create a new project (any region)
3. Wait for it to spin up (~30 seconds)
4. Go to **SQL Editor** and run this query:

**⚠️ NOTE:** If you already have a `settings` table from before, you'll need to drop it first and recreate it with the correct schema. Run this:

```sql
DROP TABLE IF EXISTS settings CASCADE;

CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_name TEXT NOT NULL,
  date TEXT NOT NULL,
  meetings_set INT DEFAULT 0,
  meetings_ran INT DEFAULT 0,
  opportunities INT DEFAULT 0,
  credit_apps INT DEFAULT 0,
  lasers_sold INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(rep_name, date)
);

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_type TEXT NOT NULL,
  rep_name TEXT,
  value TEXT,
  UNIQUE(setting_type, rep_name)
);

CREATE INDEX idx_rep_date ON entries(rep_name, date);
```

5. Go to **Settings → API** and copy:
   - `NEXT_PUBLIC_SUPABASE_URL` (the URL under "Project URL")
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (under "anon public")

### 2. GitHub Setup

1. Create a new **public** repo called `sales-rings-tracker`
2. Clone it to your computer:
   ```bash
   git clone https://github.com/YOUR_USERNAME/sales-rings-tracker.git
   cd sales-rings-tracker
   ```

3. Copy all the project files into this directory (package.json, src/, index.html, etc.)

4. Create a `.env.local` file (this is for local development only):
   ```
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

5. Commit and push:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

### 3. Netlify Deployment

1. Go to [netlify.com](https://netlify.com) → Sign up with GitHub
2. Click **"New site from Git"**
3. Connect your GitHub account
4. Select the `sales-rings-tracker` repo
5. **Build command:** `npm run build`
6. **Publish directory:** `dist`
7. Before clicking Deploy, click **"Advanced: new variable"** and add:
   - Key: `VITE_SUPABASE_URL` → Value: (your Supabase URL)
   - Key: `VITE_SUPABASE_ANON_KEY` → Value: (your Supabase anon key)
8. Click **Deploy**

Wait ~2 minutes for the build. Your app will be live at a Netlify URL (like `https://your-site-name.netlify.app`).

### 4. Local Development (optional)

To run locally before deploying:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📋 The Reps (Pre-loaded)

- Dana
- Max
- Lily
- Jeff
- Lindsey
- Seth
- Will
- Daniel

## 📊 Scoring

| Metric | Points | Min |
|--------|--------|-----|
| Meetings set | 1 | 5 |
| Meetings ran | 2 | 3 |
| Opportunities created | 6 | 1 |
| Credit apps | 10 | 0 |
| Lasers sold | 20 | 0 |

---

## ✅ Testing

Once deployed:

1. Open the live URL
2. Select a rep (e.g., Dana)
3. Enter some numbers (e.g., 5 meetings set, 3 meetings ran, 1 opportunity)
4. Click **Save day**
5. Go to **Leaderboard** — you should see Dana ranked with a score

The leaderboard updates in real time across all reps.

---

## 🔄 Making Changes Later

If you want to change metrics, targets, or minimum values:

1. Edit `src/App.jsx` (the METRICS array, DEFAULT_TARGETS, DEFAULT_MINIMUMS)
2. Push to GitHub:
   ```bash
   git add .
   git commit -m "Update targets"
   git push origin main
   ```
3. Netlify rebuilds automatically (~1-2 minutes)

---

## 🐛 Troubleshooting

**"Can't connect to Supabase"**
- Double-check your keys are pasted correctly in Netlify env vars
- Make sure they're in the right order (check Supabase Settings → API)

**"Page is blank or showing errors"**
- Check your browser console (F12 → Console tab)
- Check Netlify deploy logs (Dashboard → Deploys → latest)

**"Data not saving"**
- Make sure your Supabase project is active (not paused)
- Check the SQL table exists by going to Supabase → Tables → entries

---

## 📞 Support

If you run into issues, share:
1. The error message from the browser console (F12)
2. A screenshot of your Netlify deployment logs
3. Confirmation that your Supabase keys are correct

You're all set! 🎉
