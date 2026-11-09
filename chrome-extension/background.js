chrome.runtime.onInstalled.addListener(() => {
  // Create the context menu item for links
  chrome.contextMenus.create({
    id: "open-in-real-debrid",
    title: "Open magnet in Real-Debrid",
    contexts: ["link"],  // This will apply to links only
  });
});

// Context menu handling for links
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-in-real-debrid") {
    // Check if the clicked link is a magnet link
    if (info.linkUrl && info.linkUrl.startsWith("magnet:")) {
      // Open the Real-Debrid page
      chrome.tabs.create({ url: "https://real-debrid.com/torrents", active: true }, (newTab) => {
        // Wait for the tab to load completely
        chrome.tabs.onUpdated.addListener(function onUpdated(tabId, changeInfo) {
          if (tabId === newTab.id && changeInfo.status === 'complete') {
            // Once page is loaded, remove the listener to avoid multiple triggers
            chrome.tabs.onUpdated.removeListener(onUpdated);

            // Now inject the magnet link into the Real-Debrid form
            chrome.scripting.executeScript({
              target: { tabId: newTab.id },
              func: injectScript,
              args: [info.linkUrl]  // Pass the magnet link
            });
          }
        });
      });
    } else {
      // Show a notification saying "This isn't a magnet link!"
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",  // You can replace this with any icon
        title: "Invalid Link",
        message: "This isn't a magnet link!",
        priority: 2
      });
    }
  }
});

// Function to inject the magnet link into the Real-Debrid form
async function injectScript(magnetLink) {
  const selectors = [
    'input[name="magnet"]',
    'textarea[name="magnet"]',
    'input[name="url"]',
    'textarea[name="url"]',
  ];
  const deadline = Date.now() + 15000;
  let inputField;

  while (!inputField && Date.now() < deadline) {
    inputField = selectors.map((selector) => document.querySelector(selector)).find(Boolean);
    if (!inputField) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (!inputField) {
    console.error("Magnet input was not found on the Real-Debrid page.");
    return;
  }

  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(inputField), "value")?.set;
  if (setter) setter.call(inputField, magnetLink);
  else inputField.value = magnetLink;
  inputField.dispatchEvent(new Event("input", { bubbles: true }));
  inputField.dispatchEvent(new Event("change", { bubbles: true }));

  const form = inputField.closest("form");
  if (form) {
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.submit();
    return;
  }

  const submitButton = document.querySelector('button[type="submit"], input[type="submit"]');
  if (submitButton) submitButton.click();
  else console.error("Magnet form submit control was not found on the Real-Debrid page.");
}
