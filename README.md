# ⚔️ AI Debate Arena

A premium, local-first multi-agent debate simulator. Configure up to 6 AI models across two teams (Affirmative vs Negative), customize moderation rules, enable private strategy discussions, and watch them face off in real-time, evaluated by a neutral AI judge.

---

## 🚀 Key Features

* **Up to 6 Simultaneous Agents**: Create complex team matchups (e.g., 3v3, 2v2, 1v1).
* **Teammate Defense**: Agents automatically defend team members, build upon their arguments, and avoid contradictions.
* **Private Team Strategy Sessions**: Optional round-end private discussions where team members coordinate tactics (completely hidden from opponent models).
* **10 Integrated LLM Providers**: Google Gemini, OpenAI, Anthropic, OpenRouter, Groq, xAI Grok, DeepSeek, Hugging Face, Qwen, and Ollama (Local).
* **Interactive Onboarding**: Step-by-step guided checklist on startup.
* **Esports-Inspired UI**: Beautiful glassmorphic design, floating ambient background orbs, live speaking pod highlights, and confetti victory indicators.
* **Markdown Export**: Download complete debate transcripts and scorecard verdict.

---

## 🔒 Security Architecture (Local-First)

Your API credentials are handled with the highest security standards:
1. **Direct Transmissions**: Transmissions go straight from your browser to the provider's API endpoint (e.g., Google, OpenAI, Anthropic). No proxy backend or middleman servers are involved.
2. **Browser Storage**: Keys are saved strictly in your browser's local `localStorage` sandbox.
3. **Control**: You can clear your keys at any time by resetting your settings or clearing your browser data.

---

## 🛠️ Quick Start

### 1. Launch the Server
For some providers (especially local Ollama instances), browsers enforce CORS security policies. Running the project through a local web server resolves these issues.

Using **Python**:
```bash
python -m http.server 8000
```

Using **Node.js** (via npx):
```bash
npx serve
```

Open your browser to `http://localhost:8000`.

### 2. Configure Settings
1. Click the **⚙️ Settings** button in the header.
2. Input your API key for your chosen provider.
3. Add/remove AI debaters, assign their models, teams, and temperatures.
4. Set optional system instructions or select a pre-made persona preset (e.g. *Socratic Inquirer*, *Techno-Optimist*).
5. Click **Save Settings**.

### 3. Initiate Debate
1. Fill in a **Title** and **Premise** in the sidebar.
2. Choose your **Moderator Style** and **Rounds per model**.
3. Click **Start Debate** to watch the faceoff!

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
* **Symptom**: Red transmission error stating "CORS policy block" or "Connection failed".
* **Solution**: Browsers restrict direct connections to certain endpoints when running from raw `file://` files. Ensure you are running the project via `localhost` using `python -m http.server` or a similar local dev server. If you encounter blocks connecting directly to Anthropic or OpenAI, try using **OpenRouter** as it is specifically structured to handle browser-direct requests.

### Empty Scorecard / Parsing Failures
* **Symptom**: Debate completes but the Judge scorecard displays an error.
* **Solution**: Ensure your Moderator/Judge model is a reasoning-capable model (like `gemini-1.5-pro` or `gpt-4o`) rather than a lightweight model, as generating structured JSON verdicts requires high reasoning capabilities.

---

## 📄 License
This project is open-source and free to use. All code runs entirely in your local browser sandbox.
