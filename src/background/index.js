// Background service worker

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translate") {
        handleTranslation(request.text, request.context, request.sourceLang, request.targetLang)
            .then(result => sendResponse({ result: result }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep channel open for async response
    }
});

async function handleTranslation(text, context, sourceLang, targetLang) {
    const data = await chrome.storage.sync.get(['apiKey', 'apiProvider']);
    const apiKey = data.apiKey;
    const provider = data.apiProvider || 'openai';

    if (!apiKey) {
        throw new Error("No API Key found. Please check Extension Settings.");
    }

    if (provider === 'openai') {
        return await translateOpenAI(text, context, targetLang, apiKey);
    } else {
        return await translateGemini(text, context, targetLang, apiKey);
    }
}

async function translateOpenAI(text, context, targetLang, apiKey) {
    const prompt = context
        ? `Translate only the word "${text}" to ${targetLang} as it is used in this sentence: "${context}". Return ONLY the ${targetLang} translation of the word, nothing else.`
        : `Translate "${text}" to ${targetLang}. Return only the translation.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a translation assistant. Provide concise, accurate translations." },
                { role: "user", content: prompt }
            ]
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content.trim();
}

async function translateGemini(text, context, targetLang, apiKey) {
    const prompt = context
        ? `Translate only the word "${text}" to ${targetLang} as it is used in this sentence: "${context}". Return ONLY the ${targetLang} translation of the word, nothing else.`
        : `Translate "${text}" to ${targetLang}. Return only the translation.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text.trim();
}
