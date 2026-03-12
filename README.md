# BlinkSpeak 👁️

> A browser-based communication system that translates eye blinks into text and speech.

---

## The Problem

Over **5 lakh Indians** live fully conscious but completely unable to speak or move due to ALS, locked-in syndrome, or severe spinal injuries. They are often mistaken for cognitively impaired simply because they cannot communicate.

- Commercial eye-tracking devices cost **₹5–15 lakhs** — out of reach for most families
- Caregivers spend hours daily guessing needs through primitive yes/no blinks
- This causes exhaustion and miscommunication on both sides

## The Solution

BlinkSpeak gives patients a **full alphabet** through blink-mapped Morse code using a standard webcam — restoring dignified, independent communication at **zero cost**.

```
Short blink  →  dot   ( · )
Long blink   →  dash  ( — )
Pause 1.5s   →  letter committed
Pause 3s     →  word space
```

---

## Demo

| Patient View | How it works |
|---|---|
| Blink short = dot | `·` |
| Blink long = dash | `—` |
| Pause = letter | `·— = A` |
| Press 🔊 Speak | Text read aloud |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Backend | Node.js + Express |
| Computer Vision | TensorFlow.js + MediaPipe FaceMesh |
| Face Detection | 468 facial landmarks, Eye Aspect Ratio (EAR) |
| Text to Speech | Web Speech API (built-in browser) |

---

## How It Works

1. **Webcam captures** your face in real time
2. **MediaPipe FaceMesh** maps 468 landmarks across your face
3. **Eye Aspect Ratio (EAR)** is calculated every frame using eyelid landmark distances
4. When EAR drops below threshold → **blink detected**
5. Blink duration determines **dot or dash**
6. After 1.5s pause → **letter is committed** from Morse buffer
7. Hit 🔊 **Speak** → browser reads the full message aloud

---

## Run Locally

### Prerequisites
- Node.js v18+
- A webcam
- Good front lighting

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/blinkspeak.git
cd blinkspeak

# Start the backend
cd server
npm install
node index.js

# In a new terminal, start the frontend
cd client
npm install
npm start
```

Open `http://localhost:3000` in your browser.

### Usage
1. Click **Start Camera** and allow webcam access
2. Wait ~10 seconds for the AI model to load
3. **Blink short** (under 200ms) for a dot
4. **Blink long** (over 400ms) for a dash
5. **Pause 1.5 seconds** to commit the letter
6. Hit **🔊 Speak** to read your message aloud

---

## Morse Code Reference

| Letter | Code | Letter | Code |
|--------|------|--------|------|
| A | `.-` | N | `-.` |
| B | `-...` | O | `---` |
| C | `-.-.` | P | `.--.` |
| D | `-..` | Q | `--.-` |
| E | `.` | R | `.-.` |
| F | `..-.` | S | `...` |
| G | `--.` | T | `-` |
| H | `....` | U | `..-` |
| I | `..` | V | `...-` |
| J | `.---` | W | `.--` |
| K | `-.-` | X | `-..-` |
| L | `.-..` | Y | `-.--` |
| M | `--` | Z | `--..` |

---

## Project Structure

```
blinkspeak/
├── client/                 # React frontend
│   ├── public/
│   └── src/
│       ├── App.js          # Main app — blink detection + Morse engine
│       └── index.js        # Entry point
└── server/                 # Express backend
    ├── index.js            # API server
    └── package.json
```

---

## Roadmap

- [ ] MongoDB integration — save and retrieve message history
- [ ] Caregiver dashboard — real-time message view via Socket.io
- [ ] Auto-calibration — set EAR threshold per user on first launch
- [ ] Word prediction — reduce number of blinks needed
- [ ] Mobile support — works on phone camera for bedside use
- [ ] Multilingual Morse — support for Indian language characters
