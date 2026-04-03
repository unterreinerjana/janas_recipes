# janas_recipes

Eine persönliche Rezepte-Website, gebaut mit [Astro](https://astro.build/).

Die gehostete Version ist verfügbar unter:
**https://unterreinerjana.github.io/janas_recipes/**

---

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Die Website ist dann erreichbar unter `http://localhost:4321/`.

---

## Neue Rezepte hinzufügen

Neue Markdown-Datei im Ordner `recipes/` anlegen, z.B. `recipes/mein-rezept.md`:

```markdown
---
title: Mein Rezept
tags: [tag1, tag2]
category: Hauptgericht
created: 2026-04-03
updated: 2026-04-03
---

## Zutaten

- Zutat 1

## Zubereitung

1. Schritt 1
```

Alternativ kann das Admin-Panel unter `/admin` verwendet werden.

---

## Deployment auf GitHub Pages

Das Deployment läuft automatisch über GitHub Actions bei jedem Push auf `main`.

### Ersteinrichtung (einmalig)

1. Repo auf GitHub pushen
2. Auf GitHub im Repo zu **Settings → Pages** gehen
3. Unter **Source** die Option **GitHub Actions** auswählen
4. Speichern — fertig

Ab sofort wird die Seite bei jedem Push auf `main` automatisch gebaut und veröffentlicht.

### Manuelles Deployment auslösen

Auf GitHub unter **Actions → Deploy to GitHub Pages → Run workflow** klicken.

test