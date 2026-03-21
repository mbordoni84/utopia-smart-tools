document.getElementById('openEowcf').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('eowcf/index.html') });
});

document.getElementById('openSimulator').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('simulator/index.html') });
});

document.getElementById('openPumping').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('cf-pumping/index.html') });
});
