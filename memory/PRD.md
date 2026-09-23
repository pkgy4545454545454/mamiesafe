# MamieSafe — PRD

## Original problem statement
Application (FR) pour surveiller la sécurité d'une grand-mère âgée à risque de chute. Elle garde son téléphone sur elle. Besoins : gros boutons ultra simples, bouton SOS, "Je me couche", check-in régulier, détection de chute (accéléromètre, pas trop sensible), détection de bruit, commandes vocales ("à l'aide" = appel), notifications push répétées, dashboard côté famille avec statut temps réel, historique d'alertes (léger/moyen/dangereux), carte GPS (Leaflet/OSM), contacts d'urgence, tutoriel forcé au 1er lancement. Une seule app, 2 modes (Mamie + Dashboard protégé par code), version web incluse.

## Architecture
- **Frontend**: Expo (React Native, expo-router), fonctionne mobile + web.
  - Modes: `app/onboarding.tsx`, `app/mamie.tsx`, `app/unlock.tsx` (PIN), `app/dashboard/*` (tabs: Statut, Alertes, Carte, Réglages).
  - Thème senior haute lisibilité (`src/theme.ts`, light+dark), Phosphor icons, react-query pour toute la data.
  - Capteurs/temps réel: `useFallDetection` (expo-sensors), `useLocationSharing` (expo-location), `useVoiceCommand` (web SpeechRecognition + stub natif), `notifications.ts` (expo-notifications local + register push Expo).
  - Carte: `LeafletMap` (WebView Leaflet natif / iframe OSM web).
- **Backend**: FastAPI + MongoDB (`backend/server.py`), routes `/api/*`, single-household config. Push envoyé côté Python via l'API Expo push (`/api/push/register`).
- **DB collections**: config (singleton `household`), events, alerts, locations, heartbeats, push_tokens.

## User personas
1. **Mamie** (80+, faible vue, tape à peine): 2 gros boutons, tutoriel forcé, commandes vocales, protection passive.
2. **Aidant/famille** (petit-fils): dashboard code-protégé, statut, alertes, carte, réglages.

## Core requirements (static)
- Mode Mamie ultra simple: "Je me couche" + "J'ai besoin d'aide".
- SOS = compte à rebours 5s annulable → ouvre le dialer d'urgence + crée alerte.
- Détection de chute → "Ça va ?" 30s → escalade si pas de réponse.
- Dashboard: statut temps réel, historique alertes par sévérité, carte GPS, contacts, réglages, PIN.
- Notifications locales (check-in, coucher) + push Python (build de prod).

## Implemented (2026-09-23)
- ✅ Backend complet (config, events, alerts, location, heartbeat, summary, push register) — 16/16 tests.
- ✅ Onboarding forcé (5 étapes, exemples de test) + persistance `onboarded`.
- ✅ Mode Mamie: 2 boutons géants, SOS countdown annulable, bedtime + toast, haptics, accès dashboard par long-press.
- ✅ Détection de chute (accéléromètre, sensibilité configurable) + overlay d'escalade.
- ✅ Partage GPS + carte Leaflet/OSM (web + natif).
- ✅ Commandes vocales web (à l'aide / coucher) + stub natif.
- ✅ Unlock PIN + Dashboard (4 onglets) avec data live et polling.
- ✅ Alertes: badges de sévérité, valider / fausse alerte.
- ✅ Réglages: nom, numéro urgence, sensibilité, intervalle check-in, PIN, contacts.
- ✅ Notifications locales (check-in + coucher) + enregistrement push Expo côté Python.

## Backlog (prioritized)
### P0
- Push distant réel (nécessite build + FCM google-services.json fourni par l'utilisateur).
- Reconnaissance vocale native ("à l'aide") + micro arrière-plan (build natif, module STT).
### P1
- Détection de bruit / classification (douche, cri, silence) via micro (build natif).
- Sonnerie insistante jusqu'à réponse (répétitions x20) sur check-in manqué → escalade auto.
- Envoi SMS pré-rempli aux contacts (dialer/SMS composer) depuis SOS.
- Numéro propre de Mamie + bouton "Appeler Mamie" sur la carte.
### P2
- Historique de localisation / trajet, géofence "à la maison".
- Mode nuit auto, réglage taille de police.

## Next tasks
1. Build de prod pour activer push + vocal natif + micro.
2. Escalade check-in manqué (sonnerie répétée) et SMS contacts.
3. Détection de bruit embarquée.
