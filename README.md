# iPhone Stock – Apple Store pickup alerts

Live: https://iphone-stock-checker-hazel.vercel.app

Prati dostupnost iPhonea za preuzimanje (pickup) u Apple Storeovima blizu US ZIP koda i šalje push obavijest (ntfy) kad se traženi model pojavi.

- **Više korisnika** – prijava Googleom; svaki korisnik ima svoj telefon, ZIP, udaljenost i obavijesti.
- **Tabovi:** Stock · Compare · Guide · Settings · Admin (samo vlasnik).
- **Admin:** brojač posjeta (pregledi, jedinstveni posjetioci, 30 dana), lista korisnika, Google Client ID.
- **EN/BS** – engleski je zadani jezik.

## Arhitektura

| Dio | Gdje |
|---|---|
| Stranica + API (`/api/auth`, `settings`, `check`, `admin`, `track`, `jobs`) | Vercel |
| Podaci (korisnici, podešavanja, statistika, rezultati po ZIP-u) | Upstash Redis (Vercel Storage) |
| Provjera svakih 15 min + obavijesti | `/api/cron` na Vercelu; okidač: cron-job.org (glavni) + GitHub Actions (rezerva) |

GitHub Actions se na `/api/jobs` prijavljuje GitHubovim potpisanim OIDC tokenom (bez secreta). Apple se pita jednom po ZIP-u,
a svaki korisnik dobija obavijest po svojim filterima. Sesije su HttpOnly kolačići potpisani tajnim ključem iz baze.

## Podešavanje (vlasnik)

1. Vercel → Storage → **Upstash Redis**.
2. Google Cloud Console → OAuth client ID (Web), *Authorized JavaScript origins* = adresa stranice.
3. Na stranici: Client ID + PIN u žutom okviru → prijava Googleom → Settings → **Become owner** (PIN).

Detaljno uputstvo je u tabu **Guide**.

Apple endpoint: `/shop/retail/pickup-message` (`/shop/fulfillment-messages` vraća 541 sa servera).
