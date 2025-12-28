# YouTube to Anki Vocab Deck

A Chromium-based browser extension that extracts vocabulary words from YouTube video transcripts and generates Anki flashcards with context-aware translations.

**Currently only translates Portuguese to English**

## Requirements

- OpenAI or Gemini API Key (minimal cost for typical usage)

## Features

- Uses NLP and stopword filtering to extract meaningful vocabulary
- Translates words based on sentence context for accurate meanings
- Generates CSV files ready for import into Anki

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

- `npm i && npm run build`
- Open `chrome://extensions/`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the `dist/` folder
- Add your API key

## Usage

- Navigate to a YouTube video that has a transcript in your target language
- Click the extension icon, click **Generate**
- Download the generated CSV file
- Import into Anki
