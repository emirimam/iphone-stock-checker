# iPhone 18 Pro Max – provjera zaliha (Middleburg, FL 32068)

Provjerava da li Apple Storeovi u blizini ZIP-a **32068** imaju iPhone 18 Pro Max za preuzimanje (pickup)
i šalje push poruku na mobitel kad se nešto pojavi.

- **Web stranica (Vercel):** traženi i ostali dostupni telefoni + sva podešavanja (model, memorija, boja, ZIP, obavijesti) zaštićena PIN-om.
- **Automatska provjera (GitHub Actions):** svakih 15 min (`.github/workflows/check.yml`), poruka preko [ntfy](https://ntfy.sh)
  samo za *nove* pojave. Vercel Hobby plan dozvoljava cron samo jednom dnevno, pa raspored ide preko GitHub Actions.

## Podešavanje

**Vercel** (projekat `iphone-stock-checker`):
1. *Storage → Create Database → Upstash (Redis)* (besplatno) → poveži sa projektom.
2. *Settings → Environment Variables*: `ADMIN_PIN` = PIN po izboru (za izmjene podešavanja).
3. *Deployments → Redeploy*.

**GitHub** (*Settings → Secrets and variables → Actions*):
- Secret `ADMIN_PIN` = isti PIN kao na Vercelu
- Variable `APP_URL` = adresa Vercel stranice, npr. `https://iphone-stock-checker.vercel.app`

Zatim na stranici otvori *Podešavanja i obavijesti*, unesi PIN, izaberi telefon i upiši ntfy topic
(aplikacija **ntfy** na mobitelu, pretplata na isti topic) → *Pošalji probnu poruku*.

## Lokalno

```
node scripts/notify.mjs --test   # probna poruka
node scripts/notify.mjs          # jedna provjera
```

Koristi Apple endpoint `/shop/retail/pickup-message` (`/shop/fulfillment-messages` vraća 541 sa servera). Za dijagnostiku pokreni workflow sa „diag“.

Ako Apple promijeni stranicu pa skripta ne nađe part brojeve, postavi varijablu `PARTS` (npr. `MXXXXLL/A,MYYYYLL/A`).
