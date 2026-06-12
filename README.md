# AI Debate Arena ⚔️🗣️

> A Premium, Local-First Multi-Agent Debate Simulator & Cinematic Simulation Arena.

AI Debate Arena is an ultra-premium Single Page Application (SPA) designed to let you watch up to 6 AI models debate each other in real-time. Built with a dark, esports-inspired design language, powered by an offline-capable WebGL `<SideRays />` background engine, and supporting direct browser-to-LLM integration across 10 API providers, it acts as a neutral simulation environment right in your browser.

---

## ⚡ Core Features

### 1. Cinematic Esports Viewport & Atmosphere
*   **SideRays WebGL Background:** Smooth, moving gold-and-blue light rays overlaying a pure black backdrop, powered locally by a custom-integrated offline `ogl.js` engine.
*   **Esports Stage Pods:** Symmetrical portrait layouts for debaters, featuring rotating holographic conic-gradient borders on active speaker cards.
*   **Theater Mode Dimming:** Non-speaking player cards automatically dim, blur, and scale down, keeping visual focus centered around the active speaker.
*   **Victory Scorecard & Confetti:** Neutral AI judge synthesizes a final structured scorecard with a dynamic confetti victory trigger.

### 2. Symmetrical Matchup Console & Rules
*   **Up to 6 Simultaneous Agents:** Configure team faceoffs (1v1, 2v2, 3v3) with customizable models, temperatures, and custom system personas.
*   **Teammate Defense & Cooperation:** Models automatically support their teammates' arguments, avoid internal contradictions, and counter opponent positions.
*   **Private Team Strategy Sessions:** Optional round-end private discussions where team members coordinate tactics (completely hidden from opponent models).
*   **Presets Library:** Instantly load preset topics and premises (e.g. *AI Consciousness*, *Universal Basic Income*).

### 3. Local-First Security & Integrations
*   **10 LLM Providers:** Google Gemini, OpenAI, Anthropic, OpenRouter, Groq, xAI Grok, DeepSeek, Hugging Face, Qwen, and Ollama (Local).
*   **localStorage Key Sandbox:** Keys are saved strictly in your browser's local sandbox and sent directly to provider APIs—zero middleman servers.
*   **Interactive Onboarding Stepper:** Progressive 3-step startup wizard that checks setup parameters (Topic, Model Configs, Credentials) reactively.
*   **Markdown Export:** Download complete debate transcripts, structured arguments, and the final scorecard verdict.

---

## 📁 File Structure

```text
ai-debate-arena/
├── index.html        # Main app entry point & UI structure
├── style.css         # Custom cinema-themed stylesheet & animations
├── app.js            # Reactive state management, simulator loop, & API integration
├── presets.js        # Default debate topics & system prompts
├── sideRays.js       # Vanilla JS WebGL SideRays background controller
├── ogl.js            # Locally bundled OGL WebGL engine (100% offline support)
├── LICENSE           # Open-source MIT License
└── README.md         # Documentation & setup guide
```

---

## 🔒 Security Architecture (Local-First)

Your API credentials are handled with the highest security standards:
1.  **Direct Transmissions**: Transmissions go straight from your browser to the provider's API endpoint (e.g., Google, OpenAI, Anthropic). No proxy backend or middleman servers are involved.
2.  **Browser Storage**: Keys are saved strictly in your browser's local `localStorage` sandbox.
3.  **Control**: You can clear your keys at any time by resetting your settings or clearing your browser data.

---

## 🛠️ Quick Start

### 1. Clone the Repository
Clone the codebase to your local machine and navigate into the project folder:
```bash
git clone https://github.com/DaivikOPX/AI-Debate-Arena.git
cd AI-Debate-Arena
```

### 2. Run the App Locally
Because modern browsers enforce strict CORS policies on local modules and direct API calls, the app must be run through a local web server (instead of double-clicking the `index.html` file).

**Using Python**:
```bash
python -m http.server 8000
```

**Using Node.js**:
```bash
npx serve
```

Open your browser to **`http://localhost:8000`**.

### 3. Configure Settings
1.  Click the **⚙️ Settings** button in the header.
2.  Input your API key for your chosen provider.
3.  Add/remove AI debaters, assign their models, teams, and temperatures.
4.  Set optional system instructions or select a pre-made persona preset (e.g. *Socratic Inquirer*, *Techno-Optimist*).
5.  Click **Save Settings**.

### 4. Initiate Debate
1.  Fill in a **Title** and **Premise** in the sidebar topic card.
2.  Choose your **Moderator Style** and **Rounds per model**.
3.  Click **Start Debate** to watch the faceoff!

---

## 🤖 Ollama (Local Model) Setup

To connect a local Ollama instance, you must configure it to allow browser cross-origin requests.

### Windows (PowerShell)
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

### macOS / Linux
```bash
OLLAMA_ORIGINS="*" ollama serve
```

In the settings panel, select **Ollama (Local)** as the provider, specify your model identifier (e.g. `llama3:8b`), and ensure the host is set to your local url (defaults to `http://localhost:11434`).

---

## ⚠️ Troubleshooting

### CORS Errors
*   **Symptom**: Red transmission error stating "CORS policy block" or "Connection failed".
*   **Solution**: Ensure you are running the project via `localhost` using `python -m http.server` rather than opening `file:///`. If you encounter blocks connecting directly to Anthropic or OpenAI due to browser restrictions, try using **OpenRouter** as it is specifically structured to handle browser-direct requests.

### Empty Scorecard / Parsing Failures
*   **Symptom**: Debate completes but the Judge scorecard displays an error.
*   **Solution**: Ensure your Moderator/Judge model is a reasoning-capable model (like `gemini-1.5-pro` or `gpt-4o`) rather than a lightweight model, as generating structured JSON verdicts requires high reasoning capabilities.

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).
