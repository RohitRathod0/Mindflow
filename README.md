# FlowMind AI

An intelligent AI-powered task manager that prioritizes your day based on your persona, energy levels, and goals.

## Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **AI**: Google Gemini 2.0 Flash
- **Auth**: Firebase Admin SDK (Day 2)

## Getting Started

### Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in your keys
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### `backend/.env`
```
GEMINI_API_KEY=
MONGODB_URI=
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
PORT=5000
```

### `frontend/.env.local`
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```
