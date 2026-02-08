# Read Me

An AI-powered reading comprehension companion that turns Google Blog articles into interactive quizzes. Get instant, intelligent feedback on your answers through text or voice.

## Motivation

After long days staring at screens and exhausting gym sessions, I wanted a way to stay current with AI news without sacrificing my health. The idea: lay down, close your eyes, and learn — completely device-free, controlled entirely by voice.

This project explores the question: *"How can I become knowledgeable and keep up with the AI news without sacrificing my health?"*

## Features

- **Smart Article Discovery** — Automatically monitors Google Blog's RSS feed and notifies you of new articles
- **AI-Generated Questions** — Creates 5 thoughtful comprehension questions per article using Gemini 2.0 Flash
- **Intelligent Feedback** — Evaluates your answers with detailed explanations and improvement suggestions
- **Voice Quiz Mode** — Answer questions by speaking with real-time speech transcription via ElevenLabs
- **Unread Badge** — Red badge displays unread article count (for OCD-driven motivation)
- **Cross-Device Sync** — Articles sync across devices via Chrome storage
- **Smart Scoping** — Non-tracked URLs show "not tracked" to keep the project contained

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Chrome Extension                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ background  │    │  side_panel │    │ annotation  │    │    voice    │  │
│  │    .js      │    │     .js     │    │    .js      │    │    .js      │  │
│  │             │    │             │    │             │    │             │  │
│  │ RSS polling │    │  Quiz UI    │    │  Extract    │    │  STT via    │  │
│  │ + badge     │    │  + state    │    │  article    │    │  WebSocket  │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │         │
│         └──────────────────┴────────┬─────────┴──────────────────┘         │
│                                     │                                       │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │ HTTP / WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Flask Backend                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  /articles  │    │  /feedback  │    │    /tts     │    │  /stt-token │  │
│  │             │    │             │    │             │    │             │  │
│  │  Generate   │    │  Evaluate   │    │  Text to    │    │  Get token  │  │
│  │  questions  │    │  answers    │    │  speech     │    │  for STT    │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └─────────────┘  │
│         │                  │                  │                             │
│         ▼                  ▼                  ▼                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         External APIs                                │   │
│  │         Google Gemini 2.0 Flash  •  ElevenLabs TTS/STT              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

**Extension (Frontend)**
- Vanilla JavaScript (ES6 modules)
- Chrome Extension Manifest V3
- Web Audio API

**Server (Backend)**
- Python / Flask
- LangChain + Google Generative AI
- ElevenLabs (TTS & real-time STT)

## Challenges & Learnings

Building this taught me a lot about the rough edges of browser extensions and API limitations:

- **RSS feeds return XML, not JSON** — Google's blog feed required XML parsing, which was a throwback
- **Chrome forbids auto-opening side panels** — Had to rethink the UX around manual triggers
- **Massive HTML payloads** — Blog pages are bloated; had to aggressively clean HTML before sending to Gemini to reduce token usage
- **Inconsistent blog HTML structure** — Google Blog doesn't use consistent markup, so extraction logic had to be resilient
- **Side panel lifecycle quirks** — Understanding when the panel mounts/unmounts and managing state across navigations was tricky
- **Rate limits killed RAG** — Originally planned to use in-memory vector store with LangChain for smarter retrieval, but Gemini's embedding rate limits made it impractical. Switched to direct context passing instead
- **Permission popups don't work from side panels** — Known Chrome bug; microphone permissions required workarounds

## Roadmap

| Stage | Feature | Status |
|-------|---------|--------|
| 1 | Track progression in consuming blogs | Done |
| 1 | Auto-fetch blog updates + badge notification | Done |
| 1 | Visualize progression in side panel | Done |
| 2 | AI-generated comprehension questions | Done |
| 2 | AI-powered answer feedback | Done |
| 3 | Text-to-speech for questions | Done |
| 3 | Voice input for answers (STT) | Done |
| 3 | Full podcast mode (narrate entire article) | Planned |
| 3 | Voice barge-in (interrupt to ask questions) | Planned |

## Prerequisites

- Python 3.11+
- Google Chrome
- [Google AI API Key](https://aistudio.google.com/apikey)
- [ElevenLabs API Key](https://elevenlabs.io/) (for voice features)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/read-me.git
cd read-me
```

### 2. Set up the backend

```bash
cd server

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
```

Edit `.env` with your API keys:

```env
GOOGLE_API_KEY=your_google_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### 3. Start the server

```bash
python main.py
```

The server runs on `http://localhost:5001` by default.

### 4. Load the Chrome extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension` folder from this repository

### 5. Use the extension

1. Navigate to any article on [blog.google](https://blog.google)
2. Click the extension icon to open the side panel
3. Click on an article to generate questions
4. Answer the questions and submit for AI feedback
5. (Optional) Click the microphone icon to use voice mode

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/model` | GET | Returns current LLM model name |
| `/articles` | POST | Generates comprehension questions from article text |
| `/feedback` | POST | Evaluates user answers and returns feedback |
| `/tts` | POST | Converts text to speech (base64 MP3) |
| `/stt-token` | GET | Returns a token for real-time speech-to-text |

## Project Structure

```
read-me/
├── extension/
│   ├── manifest.json        # Extension configuration
│   ├── side_panel.html      # Main UI
│   └── scripts/
│       ├── api.js           # Server communication
│       ├── background.js    # RSS polling & badge updates
│       ├── annotation.js    # Article text extraction
│       ├── side_panel.js    # UI controller
│       ├── voice.js         # Speech-to-text WebSocket
│       ├── voice-session.js # Voice quiz orchestration
│       └── views/           # View controllers
├── server/
│   ├── main.py              # Flask app & routes
│   ├── questions.py         # Question generation
│   ├── feedback.py          # Answer evaluation
│   ├── tts.py               # Text-to-speech
│   ├── config.py            # Model configuration
│   └── cache.py             # Question caching
└── README.md
```

## License

MIT License — see [LICENSE](LICENSE) for details.
