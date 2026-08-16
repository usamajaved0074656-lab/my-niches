# My Niches (local)

Apni niche library — har niche ek folder, andar jitne marzi YouTube channels. Link paste karo, naam/subs/video-count/tasveer khud aa jati hai. Har niche aur har channel ke apne notes.

## Chalao

```bash
node C:\Users\Bjay\Documents\niche-core\server.js
```

Phir browser mein: http://localhost:5173

Port badalna ho to `PORT=8080 node server.js`.

### Server khud chalu ho (recommended)

Ek dafa **`install-autostart.cmd`** chala do. Ye Startup folder mein ek chhota launcher rakh deta hai jo har Windows login par server **chupchap background mein** start kar deta hai — koi window nahi khulti.

Iske bagair PC restart hote hi server band ho jata hai, aur phir extension "Server nahi mil raha" dikhati hai.

Hatana ho to `uninstall-autostart.cmd`.

## Kaise chalta hai

**Ek card = ek channel.** Grid mein har channel apna alag card hai — avatar, naam, link icon, subs/videos, banner, aur latest 3 uploads titles ke saath.

**Niche = group.** Sidebar aur upar wale pills se group chuno:

- **All channels** — sab niches ke saare channels ek saath
- **koi ek niche** — sirf usi ke channels; saath hi upar ek toolbar aata hai jisme us niche mein seedha link paste kar ke channel add kar sakte ho, aur "Niche settings" se uska naam/status/tags/notes edit ya delete
- **Saved** — jo niches bookmark kiye hue hain, unke channels

Har card par niche ka naam badge ki tarah likha hota hai — us par click karo to seedha usi group par filter ho jata hai.

**Channel par click** karo to uska apna panel khulta hai: latest uploads, us channel ke apne notes (khud save hote hain), "Refresh stats", aur ek dropdown jisse channel kisi doosre niche mein move kar sakte ho.

## Kya kya hai

- **Niche cards** — cover apne aap ban jata hai andar ke channels ki tasveeron se (max 4 + "+N").
- **Status** — `Researching`, `Future ideas` (jinpy baad mein kaam karna hai), `Building now`, `Parked`. Sidebar aur pills dono se filter hota hai.
- **Channel add** — channel link (`@handle`, `/channel/UC…`, `/c/Name`) ya kisi video ka link (`watch?v=`, `youtu.be/`). Video link se channel ka naam + video ka title + dono tasveeren aati hain.
- **Notes** — niche level par bara notes box, har channel ke neeche chhota box. Dono 0.5s baad khud save.
- **Saved** — card ke neeche 🏷 button.
- **Search** — title, tags, notes, channel names — sab mein.
- **Export backup** — sidebar se poori library JSON mein download.

## Chrome extension (swipe file)

YouTube browse karte hue seedha library mein save karne ke liye — Nexlev ke swipe file jaisa.

### Install (ek baar)

1. Chrome mein `chrome://extensions` kholo
2. upar dayein **Developer mode** on karo
3. **Load unpacked** → ye folder chuno:
   ```
   C:\Users\Bjay\Documents\niche-core\extension
   ```

Bas. Ab kisi bhi YouTube channel ya video page par hara **+ My Niches** button aayega — Subscribe button ke bilkul saath.

### Kaise chalta hai

- **Channel page** par button dabao → apne niches ki list khulegi → jis par click karoge usme channel add ho jayega.
- **Video / Shorts page** par bhi kaam karta hai — video ka channel + us video ka title aur thumbnail dono aa jate hain.
- Jo niche mein ye channel pehle se hai uspar **already ✓** likha aata hai, to duplicate nahi banega.
- Panel ke neeche se wahin **naya niche** bhi bana sakte ho — banate hi channel usme chala jayega.
- Toolbar wale icon se bhi wahi list milti hai (agar floating button chhupa ho to).

> Extension sirf `localhost:5173` se baat karta hai. Server band ho to saaf message aata hai — koi data kahin bahar nahi jata.

Icons dobara banane ho to: `node extension/make-icons.mjs`

## Data

Do backends hain, ek hi interface ke peeche — app khud chun leti hai:

| | Kab | Kahan |
|---|---|---|
| **file** (default) | `.env` mein `SUPABASE_KEY` khali ho | `data/niches.json` |
| **supabase** | `SUPABASE_URL` + `SUPABASE_KEY` dono set hon | Postgres table `public.niches` |

Server start hone par console par likha aata hai konsa backend chal raha hai.

`data/uploads/` mein avatars/thumbnails locally mirror hoti hain. Har channel ke andar YouTube ka original URL bhi save hota hai, to `uploads/` gum bhi ho jaye to cards khali nahi hote.

### Supabase par switch karna

Apna free Supabase project banane ke steps `SETUP-FOR-CLAUDE.md` mein hain.

1. Supabase dashboard → **Project Settings → API Keys → `service_role` → Reveal → Copy**
2. `.env` mein paste karo:
   ```
   SUPABASE_KEY=eyJhbGciOi...
   ```
3. Purana local data upar bhejo:
   ```bash
   node migrate.js
   ```
   (dobara chalane se duplicate nahi bante — jo pehle se hain wo skip ho jate hain)
4. Server restart. Sidebar mein ab **Supabase** dikhega.

`data/niches.json` waise hi para rehta hai — migrate use chhoota nahi, wo tumhara offline backup hai.

Naye project par shuru karna ho to `schema.sql` SQL Editor mein chala do.

### Doosre device par chalana

Data Supabase mein hai, is liye dono devices ki library apne aap ek hi rehti hai. Doosre PC par:

1. **Node.js** install karo — https://nodejs.org (LTS)
2. `my-niches-setup.zip` copy kar ke kahin extract karo (USB, Google Drive, jo bhi)
3. Folder mein `start.cmd` chala do

Bas. Wahan bhi Chrome khul jayega aur wahi niches dikhengi.

Extension bhi wahan load kar lo: `chrome://extensions` → Developer mode → Load unpacked → us folder ka `extension`.

**Sync kaise hota hai:**

- Har 15 second mein, aur jab bhi window par wapas aate ho, app Supabase se naya data le aati hai. Kuch badla ho to card khud aa jata hai aur neeche "Naya data aa gaya" likha aata hai.
- Drawer ya koi dialog khula ho to sync ruk jata hai — taake tum jo likh rahe ho wo kabhi overwrite na ho. Band karte hi phir chal padta hai.
- Tumhare apne changes turant lagte hain; toast sirf doosre device ke changes par aata hai.

**Tasveeren:** `data/uploads/` sirf usi machine par banti hai jisne channel save kiya tha. Doosre device par wo path 404 karta hai, to har `<img>` mein YouTube ka asal URL fallback ke taur par rakha hota hai — image apne aap us par switch ho jati hai. Is liye dono devices par cards poore dikhte hain.

> Zip mein `.env` bhi hai, yani Supabase ki secret key. Usay kisi aur ko na do.

### Backup / restore

- Sidebar → **Export backup** — poori library ek JSON file mein.
- Sidebar → **Import backup** — wo file wapas load. Jo niches pehle se hain wo skip ho jate hain, is liye do libraries merge bhi ho sakti hain.

> `service_role` key browser tak kabhi nahi jati — sirf server use karta hai. `.env` `.gitignore` mein hai.

## Notes

- Koi npm dependency nahi — sirf Node (v18+).
- YouTube ko `hl=en&gl=US` ke saath request jati hai, warna sub count local zabaan mein aata hai aur parse toot jata hai. Browser User-Agent bhi lazmi hai.
- Sub count channel header ke `"content":"513M subscribers"` se uthaya jata hai — page par featured channels ke counts alag jagah hote hain, unse confuse nahi hona.
