# WilloBarber 💈

> Application mobile de réservation et de gestion pour salon de coiffure — React Native (Expo) + Django REST Framework + PostgreSQL

## 📱 Aperçu

WilloBarber est une application complète destinée aux salons de coiffure. Elle propose deux espaces distincts :

- **Espace Client** — réservation en ligne, suivi des rendez-vous, programme de fidélité, galerie "Mes coupes"
- **Espace Coiffeur** — dashboard de gestion, planning, gestion des clients, statistiques, exports

## 🏗️ Stack Technique

| Couche | Technologie |
|---|---|
| Mobile | React Native (Expo SDK 52) + TypeScript |
| Navigation | Expo Router (file-based) |
| Backend | Django 5 + Django REST Framework |
| Base de données | PostgreSQL |
| Hébergement backend | Railway |
| Paiement | Stripe (carte bancaire) |
| Médias | Cloudinary |
| Email | SendGrid |
| Auth | JWT (SimpleJWT) + OAuth (Google, Outlook) |
| Internationalisation | i18n custom (FR / NL / EN) |

## ✨ Fonctionnalités

### Espace Client
- 🔐 Inscription / Connexion (email, téléphone, Google, Outlook)
- 📅 Réservation en ligne (choix service → barbier → date → paiement Stripe)
- 🔁 Mode FastBook — rebooker la même coupe en 1 clic
- 📋 Historique des rendez-vous
- ⭐ Programme de fidélité (0 → 500 pts → coupe offerte)
- 💬 Avis et notes sur les prestations
- ✂️ Galerie "Mes coupes" (photos partagées par le coiffeur via Cloudinary)
- 🌍 Multilingue (FR / NL / EN)
- 🔒 RGPD complet (consentement, suppression de compte, politique de confidentialité)
- 🔑 Réinitialisation de mot de passe par email

### Espace Coiffeur / Dashboard
- 📊 Dashboard — CA, RDV, taux de remplissage, top prestations
- 📆 Planning (vue Jour / Semaine / Mois) avec filtres par barbier
- 👥 Gestion des clients (recherche, filtres, archivage, restauration)
- 👨‍💼 Gestion de l'équipe (disponibilités, stats, spécialités)
- 🔔 Notifications (nouveau RDV, annulation, avis)
- 📤 Export PDF et Excel des données
- 📸 Upload photos/vidéos clients (Cloudinary)
- 📱 QR code de check-in client
- ⚙️ Paramètres (notifications, paiement, sécurité)
- 🌐 Landing page web + QR code dynamique

## 🚀 Installation

### Prérequis
- Node.js 20+
- Python 3.11+
- Expo CLI
- PostgreSQL

### Backend (Django)

\`\`\`bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
\`\`\`

### Mobile (Expo)

\`\`\`bash
cd mobile
npm install
npx expo start
\`\`\`

## 🌐 Déploiement

URL production : https://willobarber-production-6951.up.railway.app

Landing page : https://willobarber-production-6951.up.railway.app/

QR code dynamique : https://willobarber-production-6951.up.railway.app/qr/

## 🔐 Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| Coiffeur | willo@willobarber.fr | Willo2026! |
| Client | masamba.randy@gmail.com | Test1234! |

Carte Stripe test : 4242 4242 4242 4242 / 12/26 / 123

## 🛡️ RGPD

WilloBarber est conforme au RGPD (UE) 2016/679 :
- Consentement explicite à l'inscription
- Droit à l'effacement (suppression de compte avec anonymisation)
- DPO : privacy@willobarber.be
- Autorité de contrôle : APD belge — www.autoriteprotectiondonnees.be

## 🗓️ Roadmap post-lancement

- [ ] Build EAS (.ipa) — soumission App Store
- [ ] Google OAuth natif
- [ ] Multi-établissements
- [ ] Rappels SMS (Twilio)

## 👨‍💻 Auteur

Développé par **Randy Masamba** — Projet de fin d'études 2026

## 📄 Licence

Projet privé — tous droits réservés © 2026 WilloBarber
