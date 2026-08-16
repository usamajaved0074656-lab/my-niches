# My Niches — Setup Instructions

> Ye file Claude (ya kisi bhi AI assistant) ko paste kar do — wo poora setup kar dega.
> Ya khud follow karo, har step simple hai.

## Ye app kya hai

Apni YouTube niche library — niches (groups) banao, unme channels save karo (link paste karo, naam/subs/thumbnails khud aa jate hain), notes likho. Saath mein ek Chrome extension jo YouTube par Subscribe button ke paas **+** button lagati hai — wahin se channel save ho jata hai.

Data tumhare apne Supabase project mein rehta hai (free) — ya bina Supabase ke sirf local file mein. Kisi aur ka server ya account involved nahi hai.

---

## Claude ke liye instructions

Neeche wale steps follow karo. User se sirf wahi cheez maango jo tum khud nahi kar sakte (Supabase account/key).

### Step 1 — Node.js

Check karo `node -v` chalti hai (v18+). Nahi to https://nodejs.org se LTS install karwao.

### Step 2 — Code extract karo

Ye zip `Documents\my-niches` mein extract karo. Andar ye hona chahiye:
`server.js`, `store.js`, `public/`, `extension/`, `schema.sql`, `.env.example`, `start.cmd`

### Step 3 — Storage chuno

**Option A: Sirf local (sab se asaan).** Kuch nahi karna — `.env` banao hi mat. Data `data/niches.json` mein rahega. Step 5 par jao. (Ek hi PC ho to ye kaafi hai.)

**Option B: Supabase (multi-device sync ke liye).** User se karwao:

1. https://supabase.com par free account → **New project** (naam kuch bhi, region qareeb wala, free tier)
2. Dashboard → **SQL Editor** → is zip ki `schema.sql` ka poora content paste → **Run**
3. **Project Settings → API Keys → Secret keys → New secret key** → jo `sb_secret_...` bane usay copy karo
4. **Project Settings → Data API** se Project URL copy karo (`https://xxxx.supabase.co`)

Phir `.env.example` ko copy kar ke `.env` banao aur bharo:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=sb_secret_...
PORT=5173
```

> Secret key sirf `.env` mein rahe — kisi chat, screenshot ya git mein nahi.
> `.gitignore` mein `.env` pehle se hai.

### Step 4 — (Sirf Option B) Purana local data ho to

`node migrate.js` — `data/niches.json` ka data Supabase par chala jayega. Dobara chalane se duplicate nahi bante.

### Step 5 — Chalao

`start.cmd` double-click (ya `node server.js`). Console par ye dikhna chahiye:

```
My Niches  →  http://localhost:5173
Storage    →  supabase (...)   ya   file (...)
```

Browser mein http://localhost:5173 khol kar verify karo. `http://localhost:5173/api/config` bhi backend confirm karta hai.

### Step 6 — Chrome extension

1. Chrome mein `chrome://extensions`
2. **Developer mode** on (upar dayein)
3. **Load unpacked** → is folder ka `extension` subfolder chuno

Ab kisi YouTube channel/video page par Subscribe ke paas hara **+** button aayega. Server chalta rehna chahiye tabhi extension kaam karti hai.

### Step 7 — Autostart (recommended)

Warna har PC restart par server band ho jata hai aur extension "Server nahi mil raha" dikhati hai.

`install-autostart.cmd` chalao — ye Startup folder mein ek chhota launcher banata hai jo har login par server chupchap (bina window) start kar deta hai. Hatana ho to `uninstall-autostart.cmd`.

### Step 8 — Verify (Claude ye khud kare)

- `curl http://localhost:5173/api/config` → backend sahi hai
- App mein ek test niche bana kar ek channel link add karo → naam/subs/thumbnails aane chahiye
- Test data delete kar do

---

## Rozana istemal

- Sirf `start.cmd` chalao — server + Chrome dono khul jate hain
- Doosre PC par bhi yehi zip + yehi `.env` = wahi library (15 sec mein sync)
- Backup: sidebar → Export backup (JSON file)

## Troubleshooting

| Masla | Hal |
|---|---|
| Extension: "Server nahi mil raha" | `start.cmd` chalao |
| Subs/naam nahi aa raha | Net check karo; YouTube kabhi kabhi rate-limit karta hai, dobara try karo |
| Port 5173 busy | `.env` mein `PORT=5174` kar do (extension ko phir localhost:5174 chahiye hoga — `extension/manifest.json` mein `host_permissions` bhi update karo) |
| Supabase se local par wapas | `.env` se `SUPABASE_KEY` hata do, server restart |
