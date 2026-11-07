# Västtrafik Delays PWA

En progressiv webbapp (PWA) som övervakar Västtrafiks trafiksituationer i realtid och skickar push-notiser till din enhet när nya förseningar uppstår.

## Filer

```
vasttrafik-pwa/
├── index.html        ← Huvud-UI
├── sw.js             ← Service Worker (caching + notiser)
├── manifest.json     ← PWA-manifest (installerbar app)
├── icon-192.png      ← App-ikon
├── icon-512.png      ← App-ikon (stor)
└── generate_icons.py ← Hjälpskript för att regenerera ikoner
```

## Driftsättning (HTTPS krävs för Service Workers)

### Alternativ 1 – Netlify Drop
1. Gå till https://app.netlify.com/drop
2. Dra hela mappen dit
3. Klart – du får en HTTPS-URL direkt

### Alternativ 2 – GitHub Pages
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create vasttrafik-pwa --public --push --source=.
# Aktivera GitHub Pages under Settings → Pages → main branch
```

### Alternativ 3 – Lokal testning med HTTPS
```bash
# Använd npx serve med SSL eller mkcert
npx serve . -p 3000
# OBS: localhost fungerar utan HTTPS för Service Workers
```

## Funktioner

- **Realtidsövervakning** – Hämtar `https://www.vasttrafik.se/api/trafficsituations/all` var 1–30 minut
- **Push-notiser** – Systemnotiser när nya förseningar uppstår den senaste timmen
- **Service Worker** – Caching för offline-stöd + bakgrundssynkronisering
- **Installerbar** – Kan installeras som app på Android/iOS via webbläsarens "Lägg till på startskärm"
- **Periodic Background Sync** – Om webbläsaren stöder det pollas API:t i bakgrunden automatiskt

## CORS-hantering

Västtrafiks API tillåter normalt inte direkta webbläsar-anrop (CORS). Appen försöker:
1. Direktanrop till Västtrafik API
2. Fallback via `corsproxy.io`

För produktion rekommenderas en egen backend-proxy eller att använda Västtrafiks officiella API-portal med API-nyckel.

## Bakgrundssynkronisering

För att aktivera polling i bakgrunden (när appen är stängd) behöver du i Chrome/Edge:
1. Installera appen som PWA
2. Tillåt "Periodic Background Sync" i webbläsarinställningar
