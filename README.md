# iPhone 18 Pro Max – provjera zaliha (Middleburg, FL 32068)

Provjerava da li Apple Storeovi u blizini ZIP-a **32068** imaju iPhone 18 Pro Max za preuzimanje (pickup)
i šalje push poruku na mobitel kad se nešto pojavi.

- **Web stranica (Vercel):** traženi i ostali dostupni telefoni + sva podešavanja (model, memorija, boja, ZIP, obavijesti) zaštićena PIN-om.
- **Automatska provjera (GitHub Actions):** svakih 15 min (`.github/workflows/check.yml`), poruka preko [ntfy](https://ntfy.sh)
  samo za *nove* pojave. Vercel Hobby plan dozvoljava cron samo jednom dnevno, pa raspored ide preko GitHub Actions.

## Podešavanje

1. Vercel projekat → *Storage* → poveži **Upstash Redis** (besplatno).
2. Otvori stranicu → *Podešavanja i obavijesti* → postavi PIN → izaberi telefon i upiši ntfy topic → *Pošalji probnu poruku*.

GitHub Actions se na stranicu prijavljuje GitHubovim potpisanim OIDC tokenom (`id-token: write`),
pa nikakvi secreti nisu potrebni. Adresu stranice pronalazi sam; po potrebi je postavi kao Actions variable `APP_URL`.

## Lokalno

```
node scripts/notify.mjs --test   # probna poruka
node scripts/notify.mjs          # jedna provjera
```

Koristi Apple endpoint `/shop/retail/pickup-message` (`/shop/fulfillment-messages` vraća 541 sa servera). Za dijagnostiku pokreni workflow sa „diag“.

Ako Apple promijeni stranicu pa skripta ne nađe part brojeve, postavi varijablu `PARTS` (npr. `MXXXXLL/A,MYYYYLL/A`).
