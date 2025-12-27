document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generateBtn');
    const statusDiv = document.getElementById('status');
    const openOptionsLink = document.getElementById('openOptions');

    const apiKeyPreview = document.getElementById('apiKeyPreview');

    // Check for API Key
    chrome.storage.sync.get(['apiKey'], (items) => {
        if (items.apiKey && items.apiKey.length > 5) {
            const visible = items.apiKey.slice(0, 3) + '...' + items.apiKey.slice(-4);
            apiKeyPreview.textContent = visible;
            apiKeyPreview.style.color = '#333';
        } else if (items.apiKey) {
            apiKeyPreview.textContent = "Key saved (too short)";
        } else {
            apiKeyPreview.textContent = "No API Key Set";
            apiKeyPreview.style.color = '#999';
        }
    });

    openOptionsLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options/index.html'));
        }
    });

    // Listen for logs from content script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "log") {
            const entry = document.createElement('div');
            entry.textContent = `> ${message.message}`;
            entry.style.fontSize = '12px';
            statusDiv.appendChild(entry);
        }
    });

    generateBtn.addEventListener('click', () => {
        statusDiv.innerHTML = 'Starting...<br>'; // Clear and start

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                statusDiv.textContent = "Error: No active tab.";
                return;
            }

            console.log("YT2Anki: Sending extract message to tab", tabs[0].id, "Mode: vocab");
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "extract",
                mode: "vocab"
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("YT2Anki: Runtime Error", chrome.runtime.lastError);
                    statusDiv.innerHTML += `<div style="color:red">Error: Cannot connect. Please REFRESH the YouTube page.</div>`;
                    return;
                }

                if (response && response.error) {
                    statusDiv.innerHTML += `<div style="color:red">Error: ${response.error}</div>`;
                } else if (response && response.success) {
                    statusDiv.innerHTML += `<div style="color:green; font-weight:bold">Success! Generated ${response.count} cards.</div>`;
                    downloadCSV(response.csv, response.title);
                }
            });
        });
    });

    function downloadCSV(csvContent, title) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const fileName = title ? `${title}_anki.csv` : "anki_deck.csv";
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
