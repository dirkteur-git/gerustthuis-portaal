# GerustThuis Portaal

Vue 3 dashboard voor mantelzorgers — activiteit, patronen, instellingen.

> Volledige architectuur en views: [gerustthuis-docs/PORTAAL_ARCHITECTURE.md](https://github.com/dirkteur-git/gerustthuis-docs/blob/main/PORTAAL_ARCHITECTURE.md)

---

## Setup

```bash
npm install
npm run dev        # Ontwikkelserver (http://localhost:5173)
npm run build      # Productie build
npm run preview    # Preview productie build
```

---

## Views

| Route | View | Beschrijving |
|-------|------|-------------|
| `/` | Dashboard | 7-dagen heatmap, statusbanner, recente activiteit, auto-refresh |
| `/patronen` | Patronen | Dagritme, vandaag vs normaal, weekpatroon, trends |
| `/analyse` | Analyse | Z-score anomaly detection (18 features, developer view) |
| `/woning` | Woning | Kamers en devices overzicht |
| `/instellingen` | Instellingen | Hue Bridge status, huishouden beheer |
| `/hue-connect` | HueConnect | Hue koppeling starten |
| `/hue-callback` | HueCallback | OAuth callback |
| `/accept-invitation` | AcceptInvitation | Uitnodiging accepteren |
| `/login` | Login | Inloggen |

---

## Tech stack

- **Vue 3** (Composition API + `<script setup>`)
- **Vite**
- **Tailwind CSS v3**
- **Supabase JS** (auth + database)
- **Lucide Vue Next** (iconen)

---

## Environment

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_HUE_CLIENT_ID=xxx
```

---

## Documentatie

| Document | Inhoud |
|----------|--------|
| [PORTAAL_ARCHITECTURE.md](https://github.com/dirkteur-git/gerustthuis-docs/blob/main/PORTAAL_ARCHITECTURE.md) | Views, componenten, data flow, composables |
| [ANOMALY_DETECTION.md](https://github.com/dirkteur-git/gerustthuis-docs/blob/main/ANOMALY_DETECTION.md) | 18-feature anomaly detection algoritme |
| [DATABASE_DESIGN.md](https://github.com/dirkteur-git/gerustthuis-docs/blob/main/DATABASE_DESIGN.md) | Database schema, tabellen, RLS |
| [HUE_INTEGRATION.md](https://github.com/dirkteur-git/gerustthuis-docs/blob/main/HUE_INTEGRATION.md) | Philips Hue API, OAuth flow |
