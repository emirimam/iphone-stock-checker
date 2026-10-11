# iPhone 18 Pro Max – provjera zaliha (Middleburg, FL 32068)

Provjerava da li Apple Storeovi u blizini ZIP-a **32068** imaju iPhone 18 Pro Max za preuzimanje (pickup)
i šalje push poruku na mobitel kad se nešto pojavi.

- **Web stranica (Vercel):** `index.html` + `api/check.js` – status uživo, dugme „Provjeri sada“.
- **Automatska provjera (GitHub Actions):** svakih 15 min (`.github/workflows/check.yml`), poruka preko [ntfy](https://ntfy.sh)
  samo za *nove* pojave. Vercel Hobby plan dozvoljava cron samo jednom dnevno, pa raspored ide preko GitHub Actions.

## Podešavanje

1. Instaliraj **ntfy** na mobitel i pretplati se na nasumičan topic (npr. `emir-iphone-7f3k9`).
2. GitHub → repo → **Settings → Secrets and variables → Actions**:
   - *Secrets:* `NTFY_TOPIC` = tvoj topic
   - *Variables (opcionalno):* `APP_URL` (Vercel adresa), `ZIP` (default 32068), `MAX_MILES` (default 60), `MODEL` (default `pro max`)
3. **Actions → Provjera zaliha → Run workflow** sa „test“ uključenim → treba stići probna poruka.
4. Vercel → **Add New → Project** → importuj ovaj repo → Deploy (bez dodatnih postavki).

## Lokalno

```
node scripts/notify.mjs --test   # probna poruka
node scripts/notify.mjs          # jedna provjera
```

Koristi Apple endpoint `/shop/retail/pickup-message` (`/shop/fulfillment-messages` vraća 541 sa servera). Za dijagnostiku pokreni workflow sa „diag“.

Ako Apple promijeni stranicu pa skripta ne nađe part brojeve, postavi varijablu `PARTS` (npr. `MXXXXLL/A,MYYYYLL/A`).
