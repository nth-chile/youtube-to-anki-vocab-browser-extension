# YouTube to Anki - Vocabulary Mode

A Chrome extension that extracts vocabulary words from YouTube video transcripts and generates Anki flashcards with context-aware translations.

## Features

- 🌍 **Auto-Language Detection**: Automatically switches to Portuguese (or other target languages)
- 🧹 **Smart Filtering**: Uses NLP and stopword filtering to extract meaningful vocabulary
- 🎯 **Context-Aware Translation**: Translates words based on sentence context for accurate meanings
- 📝 **Anki-Ready Output**: Generates CSV files ready for import into Anki

## Card Format

**Front:**
```
Word

[Full sentence with <b>word</b> highlighted]
```

**Back:**
```
English translation
```

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key
1. Build the extension (see below)
2. Load into Chrome
3. Right-click extension icon → **Options**
4. Choose provider: **OpenAI** or **Gemini**
5. Enter your API key
6. Save

### 3. Build the Extension
```bash
npm run build
```

### 4. Load in Chrome
1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

## Usage

1. Navigate to any YouTube video
2. Click the extension icon
3. Click **Generate**
4. Wait for translation to complete
5. Download the generated CSV file
6. Import into Anki

## Tech Stack

- **Build**: Vite + CRXJS
- **NLP**: Compromise.js
- **Stopwords**: stopword package
- **Translation**: OpenAI GPT-3.5 / Google Gemini

## Project Structure

```
yt2anki/
├── src/
│   ├── background/     # Background service worker (API calls)
│   ├── content/        # Content script (YouTube DOM scraping)
│   ├── popup/          # Extension popup UI
│   ├── options/        # Settings page
│   └── utils/          # Vocab extraction & CSV generation
├── public/             # Static assets
└── dist/               # Built extension (git-ignored)
```

## Translation API

The extension sends context-aware translation requests:

```javascript
{
  word: "pais",
  context: "Ela vivia com seus pais...",
  targetLang: "English"
}
```

This ensures accurate translations (e.g., "parents" not "country").

## Development

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev
```

## Important Notes

- ⚠️ **API Key Required**: You must provide your own OpenAI or Gemini API key
- 🔒 **Never commit API keys**: They're excluded via `.gitignore`
- 💰 **API Costs**: Translation uses paid APIs (minimal cost for typical usage)

## License

MIT
