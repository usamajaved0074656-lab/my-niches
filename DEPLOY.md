# Live deploy — ek link, har device par

> **Ab live hai: https://<tumhara-project>.vercel.app** (Vercel par). Neeche wale Render steps sirf reference ke liye hain.

Deploy karne ke baad zip/`start.cmd`/PC-on rakhne ka jhanjhat khatam. Ek URL, phone se bhi khulega.

---

## Pehle ye samajh lo

**Ek link = ek library.** Jisay bhi link + password doge, wo *wahi* niches dekhega jo tum dekhte ho — apni alag library nahi. Har banda apni alag library chahta ho to usay `my-niches-code.zip` do, wo apna Supabase bana lega.

**Password lazmi hai.** `APP_PASSWORD` set na kiya to link jaanne wala koi bhi tumhara sab kuch mita sakta hai.

**Channel add karna hosted par shayad na chale.** Naam/subs/thumbnails YouTube ke page se scrape hote hain, aur YouTube datacenter IPs ko aksar block karta hai. Library dekhna/notes likhna har jagah chalega; naya channel add karna local server (extension) se hi bharosemand rahega.

---

## Steps

### 1. Code GitHub par

Is folder mein:

```bash
git init
git add -A
git commit -m "My Niches"
```

Phir github.com par naya **private** repo banao aur:

```bash
git remote add origin https://github.com/<tumhara-user>/my-niches.git
git branch -M main
git push -u origin main
```

> `.gitignore` mein `.env` aur `data/` pehle se hain — key kabhi push nahi hogi. Push se pehle `git status` mein `.env` nazar aaye to ruk jao.

### 2. Render par service

1. https://render.com — GitHub se sign in (free)
2. **New → Web Service** → apna repo chuno
3. Settings khud `render.yaml` se bhar jayengi (Node, free plan, `node server.js`)

### 3. Environment variables (Render dashboard mein)

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_KEY` | tumhari `sb_secret_...` key |
| `APP_PASSWORD` | jo bhi password rakhna ho — **lamba rakho** |
| `MIRROR_IMAGES` | `0` |

`APP_PASSWORD` mazboot rakho (16+ characters, koi common lafz nahi).

### 4. Kholo

Render `https://my-niches-xxxx.onrender.com` jaisa URL dega. Kholo → password → library.

### 5. Extension ko hosted server par lagao (agar chahiye)

Extension icon → **Settings**:
- Server ka address: `https://my-niches-xxxx.onrender.com`
- Password: wahi `APP_PASSWORD`
- **Save**

Wapas local par: address `http://localhost:5173`, password khaali.

---

## Free tier ki ek baat

Render free service 15 minute be-istemal rehne par so jati hai. Agli dafa kholne par pehli load **~30-50 second** leti hai, phir normal. Data kahin nahi jata (wo Supabase mein hai).

## Dhyan rahe

- Password kisi public jagah (Drive link, group chat) mein mat daalo
- Password badalna ho: Render mein `APP_PASSWORD` badlo → sab sessions apne aap khatam (token usi password se sign hota hai)
- Sab band karna ho: Render mein service delete kar do; local app aur Supabase jaise the waise rahenge


---

## Vercel (jo abhi chal raha hai)

Render ka free tier poore account ko **750 instance-hours per month** deta hai. Do
services 24/7 chalane par ~1,490 hours chahiye — is liye 20 August ko quota khatam
ho gaya aur dono services 502/503 dene lagin. Vercel par ye limit nahi hai aur app
sota bhi nahi.

**Setup jo ho chuka hai:**

- Project: `my-niches` (Hobby plan), apna GitHub repo
- Framework Preset: **Other** — "Node" preset root ki har `.js` ko serverless
  function bana deta tha, jis se `app.mjs` par `Invalid export` error aata tha.
  Isi liye handler ab `lib/handler.js` mein hai, root mein nahi.
- Environment Variables: `SUPABASE_URL`, `SUPABASE_KEY`, `APP_PASSWORD`, `MIRROR_IMAGES=0`
- `vercel.json` sirf `/api/*` ko function par bhejta hai; `public/` Vercel ka CDN
  seedha serve karta hai.

**Code ki taqseem:**

| File | Kaam |
|---|---|
| `lib/handler.js` | saara request handling — dono jagah yehi chalta hai |
| `server.js` | local/container launcher (`node server.js`) |
| `api/index.js` | Vercel serverless entry |

Serverless par disk read-only hoti hai, is liye `uploads/` banana aur image
mirroring `VERCEL` par khud band ho jate hain — cards YouTube CDN se load hote hain.

**Ek baat:** rate-limiter memory mein ginta hai, aur serverless par har instance ki
apni memory hoti hai — to ginti utni sakht nahi rehti jitni ek server par. Password
24 random characters ka hai, is liye amli tor par farq nahi parta.
