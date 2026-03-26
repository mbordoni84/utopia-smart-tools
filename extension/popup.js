document.getElementById('openEowcf').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('home-data/index.html') });
});

document.getElementById('openSimulator').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('simulator/index.html') });
});

document.getElementById('openPumping').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('cf-pumping/index.html') });
});

const debugBtn = document.getElementById('openDebugExport');
if (debugBtn) {
  debugBtn.addEventListener('click', () => {
    const url = chrome.runtime.getURL('tests/debug_export.html');
    console.log('Opening debug export:', url);
    chrome.tabs.create({ url: url });
  });
} else {
  console.error('Debug Export button not found!');
}
