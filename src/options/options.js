document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const providerSelect = document.getElementById('apiProvider');
  const saveButton = document.getElementById('save');
  const toggleShowBtn = document.getElementById('toggleShow');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  chrome.storage.sync.get(['apiKey', 'apiProvider'], (items) => {
    if (items.apiKey) apiKeyInput.value = items.apiKey;
    if (items.apiProvider) providerSelect.value = items.apiProvider;
  });

  if (toggleShowBtn) {
    toggleShowBtn.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleShowBtn.textContent = 'Hide';
      } else {
        apiKeyInput.type = 'password';
        toggleShowBtn.textContent = 'Show';
      }
    });
  }

  // Save settings
  saveButton.addEventListener('click', () => {
    chrome.storage.sync.set({
      apiKey: apiKeyInput.value,
      apiProvider: providerSelect.value
    }, () => {
      statusDiv.style.display = 'block';
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 2000);
    });
  });
});
