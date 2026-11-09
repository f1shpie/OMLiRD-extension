// Use the polyfilled browser object
const browser = window.browser || chrome;

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "open-in-real-debrid",
    title: "Open magnet in Real-Debrid",
    contexts: ["link"],
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-in-real-debrid") {
    if (info.linkUrl && info.linkUrl.startsWith("magnet:")) {
      browser.tabs.create({ 
        url: "https://real-debrid.com/torrents", 
        active: true 
      }).then((newTab) => {
        // Wait for the tab to load completely
        const onUpdated = (tabId, changeInfo) => {
          if (tabId === newTab.id && changeInfo.status === "complete") {
            browser.tabs.onUpdated.removeListener(onUpdated);
            
            // Execute the script to inject the magnet link
            browser.tabs.executeScript(newTab.id, {
              code: `(${injectScript.toString()})(${JSON.stringify(info.linkUrl)});`
            }).catch((error) => {
              console.error("Error injecting magnet link:", error);
            });
          }
        };
        browser.tabs.onUpdated.addListener(onUpdated);
      }).catch((error) => {
        console.error("Error creating tab:", error);
      });
    } else {
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Invalid Link",
        message: "This isn't a magnet link!",
      });
    }
  }
});

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
