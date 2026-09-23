# MamieSafe — PRD

## Original problem statement
Application (FR) pour surveiller la sécurité d'une grand-mère âgée à risque de chute. Elle garde son téléphone sur elle. Besoins : gros boutons ultra simples, SOS, "Je me couche", "Je me douche", check-in régulier, détection de chute (accéléromètre), détection de bruit, commandes vocales ("à l'aide"), notifications push répétées, dashboard famille (statut temps réel, historique d'alertes léger/moyen/dangereux, carte GPS Leaflet/OSM, contacts, appeler Mamie), planification d'activités avec confirmation (piscine/douche), demande de photo (Accepter/Refuser). Une seule app, 2 modes (Mamie + Dashboard PIN), version web.

## Architecture
- **Frontend**: Expo (React Native, expo-router), mobile + web.
  - Modes: `app/onboarding.tsx`, `app/mamie.tsx`, `app/unlock.tsx` (PIN), `app/dashboard/*` (tabs: Statut, Alertes, Carte, Réglages), `app/activities.tsx`.
  - Thème senior haute lisibilité (`src/theme.ts`), Phosphor icons, react-query.
  - Capteurs/temps réel: `useFallDetection` (expo-sensors), `useLocationSharing` (expo-location), `useVoiceCommand` (web SpeechRecognition + stub natif), `SoundMonitor` (expo-audio, natif), `PhotoRequestModal` (expo-camera).
  - Carte: `LeafletMap` (WebView Leaflet natif / iframe OSM web).
- **Backend**: FastAPI + MongoDB (`backend/server.py`), routes `/api/*`, single-household config.
  - Background scheduler (`activity_monitor`) : scheduled → awaiting_confirmation → escalated (+ alerte + push).
  - Push via l'API Expo (Python) : `notify_dashboard` / `notify_mamie`.
  - Photos: Emergent Managed Object Storage (init/put/get), servies via `/api/photos/{id}`.
- **DB collections**: config, events, alerts, locations, heartbeats, push_tokens, activities, photo_requests.

## User personas
1. **Mamie** (80+): 3 gros boutons, tutoriel forcé, banner de confirmation, photo Accepter/Refuser.
2. **Aidant** (petit-fils): dashboard PIN, statut, alertes, carte, activités, photo, réglages.

## Implemented
### 2026-09-23 — MVP
- Onboarding forcé, mode Mamie (Je me couche / SOS), détection de chute + escalade, GPS + carte, unlock PIN, dashboard (Statut/Alertes/Carte/Réglages), notifications locales, push register.
### 2026-09-23 — Itération 2
- Bouton "Je me douche" + activité minutée (15 min) → confirmation.
- Banner urgent persistant + vibration en boucle tant que non confirmé (bouton "J'ai fini").
- Planification d'activités (dashboard, ex: piscine 9h-12h) + moteur serveur : awaiting → escalade automatique en alerte urgente.
- SMS aux contacts en 1 tap sur SOS (expo-sms).
- Bouton "Appeler Mamie" (carte) + champ `mamie_phone` (Réglages).
- Demande de photo : dashboard demande → Mamie Accepter/Refuser → caméra → upload Object Storage → affichage dashboard.
- Détection de bruit V1 (niveau sonore, expo-audio) activable dans Réglages (build natif requis).
### 2026-09-23 — Itération 3
- **Check-in insistant** : quand un check-in est dû, écran plein « Tout va bien, Mamie ? » qui **sonne + vibre en boucle** (`useInsistentAlarm`) jusqu'au tap « Oui, tout va bien » ; après ~20 sonneries sans réponse → alerte urgente + appel automatique du 1ᵉʳ contact. Le minuteur se réarme à chaque interaction (coucher/douche/SOS/confirmation).
- **Bruits précis** : `SoundMonitor` classe désormais eau/douche (bruit steady medium, ignoré), bruit fort inhabituel (moyen) et bruit violent cri/chute (dangereux) via niveau + variance sur fenêtre glissante.
### 2026-09-23 — Itération 4
- **Mode nuit** : pendant la fenêtre nuit (défaut 22h–7h, réglable), la détection de bruit devient moins sensible (seul un bruit très violent alerte, le « fort inhabituel » est ignoré). En-tête Mamie affiche « Mode nuit 🌙 ». Config: `night_mode`, `night_start`, `night_end`.
- **Réveil anti-silence** : `useInactivityWatch` suit le mouvement (accéléromètre) + les interactions ; si aucun mouvement ET aucune interaction pendant X heures **le jour** (nuit ignorée), déclenche le check-in insistant (qui escalade en alerte + appel si pas de réponse). Config: `inactivity_watch`, `inactivity_hours`.

## Backlog (prioritized)
### P0
- Push distant réel activé au build (FCM google-services.json fourni par l'utilisateur).
- Reconnaissance vocale native ("à l'aide") — module STT + build.
### P1
- Classification fine des bruits (douche/cri/chute) via ML embarqué.
- Ring insistant en arrière-plan (x20) + appel auto d'un contact.
- Visio temps réel (WebRTC) si souhaité plus tard.
### P2
- Historique de localisation, géofence maison, réglage taille de police.

## Next tasks
1. Publier + générer build iOS/Android pour push, caméra, micro, vocal.
2. Ring insistant arrière-plan + appel contact automatique.
3. Classification des bruits.
