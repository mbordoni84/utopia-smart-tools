document.getElementById('openEowcf').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('eowcf/index.html') });
});
