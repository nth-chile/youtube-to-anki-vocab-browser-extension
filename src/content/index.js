import { Utils } from '../utils/index.js';

const DEV_LIMIT = null; // Limit for testing (null = unlimited)

// DOM Scraping Implementation

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extract") {
        scrapeDom(request.mode, sendResponse);
        return true; // async response
    }
});

// Helper to send logs to popup
function logToPopup(msg) {
    chrome.runtime.sendMessage({ action: "log", message: msg });
}

async function scrapeDom(mode, sendResponse) {
    try {
        logToPopup("Starting scrape...");
        console.log("YT2Anki: Starting DOM scrape...");

        // 1. Ensure Transcript Panel is Open
        logToPopup("Opening transcript panel...");
        await openTranscriptPanel();

        // 1.5. Switch Language (New Step)
        logToPopup("Checking language...");
        const currentLang = await switchLanguage("Portuguese");

        // 2. Wait for segments to render
        logToPopup("Waiting for text segments...");
        const segments = await waitForSegments();

        // 3. Extract Text
        logToPopup(`Found ${segments.length} segments. Extracting text...`);
        const rawData = extractDataFromSegments(segments);
        console.log("YT2Anki: Scraped raw segments:", rawData.length);

        if (rawData.length === 0) {
            sendResponse({ error: "Could not find any transcript text. Is the transcript panel empty?" });
            return;
        }

        // 4. Processing
        logToPopup("Stitching sentences...");
        const combinedData = Utils.combineSegments(rawData);

        logToPopup(`Extracting vocab from ${combinedData.length} sentences...`);
        let finalDeck = Utils.extractVocab(combinedData, currentLang);

        // APPLY DEV LIMIT
        if (typeof DEV_LIMIT !== 'undefined' && DEV_LIMIT > 0) {
            console.log(`YT2Anki: DEV_LIMIT applied. Truncating ${finalDeck.length} to ${DEV_LIMIT}`);
            logToPopup(`DEV MODE: Limiting to ${DEV_LIMIT} cards...`);
            finalDeck = finalDeck.slice(0, DEV_LIMIT);
        }

        logToPopup(`Extracted ${finalDeck.length} cards. Translating...`);

        // Batch Translate
        // We can reuse batchTranslate but it expects lines with .text
        // Or proper single word translation
        // Let's do a simple loop for now to be safe and robust
        const total = finalDeck.length;
        for (let i = 0; i < total; i++) {
            if (i % 5 === 0) logToPopup(`Translating ${i + 1}/${total}...`);
            try {
                // Send specific translation request with context
                const response = await chrome.runtime.sendMessage({
                    action: "translate",
                    text: finalDeck[i].word,
                    context: finalDeck[i].context,
                    sourceLang: currentLang === 'pt' ? 'Portuguese' : 'auto',
                    targetLang: 'English'
                });

                if (response && response.result) {
                    finalDeck[i].back = response.result;
                } else {
                    finalDeck[i].back = "[Translation Error]";
                }
            } catch (e) {
                console.error("Translation failed for", finalDeck[i].word, e);
                finalDeck[i].back = "[API Error]";
            }
            // Small delay to prevent rate limits if using free tier/popup
            await new Promise(r => setTimeout(r, 200));
        }

        logToPopup(`Done! Generated ${finalDeck.length} cards.`);

        const csv = Utils.generateCSV(finalDeck);

        const videoTitle = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        sendResponse({ success: true, csv: csv, count: finalDeck.length, title: videoTitle });

    } catch (e) {
        console.error("YT2Anki: Dom Scrape Error", e);
        sendResponse({ error: e.message });
    }
}

// Helper for robust clicking simulating user action
function simulateClick(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        console.warn("YT2Anki: Attempting to click invisible element (0x0)", element);
    }

    // Check if covered
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(x, y);
    if (topEl && !element.contains(topEl) && !topEl.contains(element)) {
        console.warn("YT2Anki: Element might be covered by:", topEl);
    }

    const mouseOpts = {
        bubbles: true, cancelable: true, view: window,
        clientX: x, clientY: y
    };

    console.log("YT2Anki: Dispatching robust click sequence...", element);
    element.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
    element.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
    element.click(); // Native click as fallback/final trigger
}

async function openTranscriptPanel() {
    console.log("YT2Anki: [Step 1] Checking if transcript panel is open...");
    const panel = document.querySelector('ytd-transcript-segment-renderer');
    if (panel && panel.offsetParent !== null) {
        console.log("YT2Anki: Transcript already visible.");
        return;
    }

    // 1. Expand Description
    console.log("YT2Anki: [Step 2] Finding visible expand button...");
    const expands = Array.from(document.querySelectorAll('#expand'));

    // Filter for truly visible ones
    const visibleExpand = expands.find(e => {
        const rect = e.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 &&
            window.getComputedStyle(e).visibility !== 'hidden';
    });

    if (visibleExpand) {
        console.log("YT2Anki: Found visible expand button:", visibleExpand);
        simulateClick(visibleExpand);
        await new Promise(r => setTimeout(r, 1000));
    } else {
        // Only warn if we can't find specific expanders, maybe it's already open
        console.log("YT2Anki: No visible expand button found (or description already expanded).");
    }

    // 2. Find "Show transcript" button
    console.log("YT2Anki: [Step 3] Looking for 'Show transcript' button...");

    // Use XPath for robust text search
    const xpath = "//*[contains(text(), 'Show transcript')]";
    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    let transcriptBtn = null;

    for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);

        // Safety check: is it in the DOM?
        if (!node.isConnected) continue;

        // Visual check
        const rect = node.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 &&
            window.getComputedStyle(node).visibility !== 'hidden';

        console.log(`YT2Anki: Candidate [${i}]`, {
            tag: node.tagName,
            visible: isVisible,
            rect: rect
        });

        if (isVisible) {
            // Prefer Buttons
            if (node.tagName === 'BUTTON' || node.tagName === 'YT-BUTTON-SHAPE') {
                transcriptBtn = node;
                break;
            }
            // Or closest button parent
            const btn = node.closest('button');
            if (btn) {
                transcriptBtn = btn;
                break;
            }
        }
    }

    if (transcriptBtn) {
        console.log("YT2Anki: Found transcript button:", transcriptBtn);
        simulateClick(transcriptBtn);
        await new Promise(r => setTimeout(r, 2000));
    } else {
        console.error("YT2Anki: FATAL - No visible 'Show transcript' button found.");
        throw new Error("Could not find 'Show transcript' button.");
    }
}

// Helper to switch language if possible
async function switchLanguage(targetLang = 'Portuguese') {
    console.log(`YT2Anki: Attempting to switch language to ${targetLang}...`);

    // 1. Find the language menu button (usually bottom left of transcript header)
    // Selector based on observation: 'ytd-transcript-renderer #sort-filter-menu' or similar
    const menuBtn = document.querySelector('ytd-transcript-renderer .dropdown-trigger') ||
        document.querySelector('#sort-filter-menu') ||
        findElementByText(document.querySelector('ytd-transcript-renderer'), "English")?.element?.closest('button');

    if (!menuBtn) {
        console.log("YT2Anki: No language menu found. Assuming default.");
        return;
    }

    // click to open
    simulateClick(menuBtn);
    await new Promise(r => setTimeout(r, 500));

    // 2. Find the menu items
    // usually yt-sort-filter-sub-menu-renderer or similar list
    const items = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item'));
    console.log("YT2Anki: Found language options:", items.length);

    // 3. Find target
    const targetItem = items.find(item => {
        const text = item.textContent.toLowerCase();
        return text.includes(targetLang.toLowerCase()) ||
            text.includes("português"); // Native name check
    });

    if (targetItem) {
        console.log("YT2Anki: Found target language item:", targetItem.textContent);
        logToPopup(`Switching to ${targetItem.textContent.trim()}...`);
        simulateClick(targetItem);
        // Wait for reload
        await new Promise(r => setTimeout(r, 1500));
        return 'pt';
    } else {
        console.log("YT2Anki: Target language not found. Available:", items.map(i => i.textContent.trim()).join(", "));
        logToPopup(`Language '${targetLang}' not found. Using current.`);
        // Close menu if open?
        document.body.click();
    }
}

// Helper to recursively search for text in Shadow DOMs
function findElementByText(root, text, path = []) {
    if (!root) return null;

    // Check if root is correct element
    if (root.textContent && root.textContent.trim().toLowerCase().includes(text.toLowerCase()) &&
        root.children.length === 0) { // Leaf node roughly
        return { element: root, path: path.join(' > ') };
    }

    // Traverse children
    let children = Array.from(root.children || []);
    if (root.shadowRoot) {
        children = Array.from(root.shadowRoot.children);
        path.push(`(#shadow-root)`);
    }

    for (let child of children) {
        const found = findElementByText(child, text, [...path, child.tagName]);
        if (found) return found;
    }
    return null;
}

async function waitForSegments() {
    console.log("YT2Anki: Waiting for segments to render...");
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
            // Try multiple selectors
            let segments = document.querySelectorAll('ytd-transcript-segment-renderer');

            // Sometimes it's inside #segments-container
            if (segments.length === 0) {
                const container = document.querySelector('#segments-container');
                if (container) {
                    segments = container.querySelectorAll('ytd-transcript-segment-renderer');
                }
            }

            // Check specifically for the text class if renderer logic changes
            if (segments.length === 0) {
                segments = document.querySelectorAll('.segment-text'); // This returns divs, not renderers
            }

            if (segments.length > 0) {
                console.log(`YT2Anki: Found ${segments.length} segments.`);
                clearInterval(interval);
                resolve(segments); // Note: this might be a NodeList of divs now
            }
            attempts++;
            if (attempts % 5 === 0) console.log(`YT2Anki: Waiting... attempt ${attempts}`);

            if (attempts > 40) { // 20 seconds
                clearInterval(interval);
                reject(new Error("Timeout waiting for transcript segments. Please make sure the transcript panel is open."));
            }
        }, 500);
    });
}

function extractDataFromSegments(segments) {
    const lines = [];

    // Convert NodeList to Array
    const segArray = Array.from(segments);

    segArray.forEach(seg => {
        let timeDiv, textDiv;

        // Check if 'seg' is the renderer or the text div itself
        if (seg.tagName && seg.tagName.toLowerCase() === 'ytd-transcript-segment-renderer') {
            timeDiv = seg.querySelector('.segment-timestamp');
            textDiv = seg.querySelector('.segment-text');
        } else if (seg.classList && seg.classList.contains('segment-text')) {
            // If we found the text div directly
            textDiv = seg;
            // Try to find sibling timestamp? Usually in same parent container
            const parent = seg.parentElement || seg.parentNode; // .segment-start-offset or similar?
            if (parent) {
                timeDiv = parent.querySelector('.segment-timestamp'); // might be sibling
            }
        }

        if (textDiv) {
            let start = 0;
            if (timeDiv) {
                // Parse timestamp "0:05" or "1:02:30"
                const parts = timeDiv.textContent.trim().split(':').reverse();
                start += parseInt(parts[0] || 0); // seconds
                if (parts[1]) start += parseInt(parts[1]) * 60; // minutes
                if (parts[2]) start += parseInt(parts[2]) * 3600; // hours
            }

            lines.push({
                start: start,
                dur: 0, // DOM doesn't give duration clearly
                end: start, // placeholder
                text: textDiv.textContent.trim().replace(/\n/g, ' ')
            });
        }
    });

    // Deduplicate identical lines? Sometimes DOM has duplicates.
    // Let's keep raw for now.

    // Fix durations by looking at next segment
    for (let i = 0; i < lines.length; i++) {
        if (i < lines.length - 1) {
            lines[i].dur = lines[i + 1].start - lines[i].start;
            lines[i].end = lines[i + 1].start;
        } else {
            lines[i].dur = 2; // default last
            lines[i].end = lines[i].start + 2;
        }
    }

    return lines;
}

function getApiKey() {
    return new Promise(resolve => {
        chrome.storage.sync.get(['apiKey'], (items) => {
            resolve(items.apiKey);
        });
    });
}

// Re-using the batch translate from before
async function batchTranslate(sourceLines) {
    const translatedLines = [];
    const limit = Math.min(sourceLines.length, 20); // 20 lines limitation still?
    // User: "if browser scraping is not needed... just be a CLI"
    // The user *wants* the functionality. 
    // Let's stick to the 20 line limit for safety unless we implement pagination.

    for (let i = 0; i < limit; i++) {
        const line = sourceLines[i];
        try {
            const response = await chrome.runtime.sendMessage({
                action: "translate",
                text: line.text,
                sourceLang: "auto",
                targetLang: "English"
            });

            if (response.error) throw new Error(response.error);

            translatedLines.push({
                start: line.start,
                dur: line.dur,
                text: response.result
            });
        } catch (e) {
            translatedLines.push({
                start: line.start,
                dur: line.dur,
                text: "[Translation Error]"
            });
        }
    }
    return translatedLines;
}
