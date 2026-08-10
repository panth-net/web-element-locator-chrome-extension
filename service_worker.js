const STORAGE_KEY = "copyFields";

const DEFAULT_FIELDS = {
  page: true,
  target: true,
  owner: true,
  selector: false,
  html: false,
  position: false
};

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "start-identifying") {
    return;
  }

  const targetTab = tab?.id ? tab : await getActiveTab();
  if (!targetTab?.id) {
    return;
  }

  const fields = await getStoredFields();
  await startInspector(targetTab.id, fields);
});

async function startInspector(tabId, fields) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });

    await chrome.tabs.sendMessage(tabId, {
      type: "AI_LOCATOR_START",
      fields
    });
  } catch (error) {
    console.warn("Web Element Locator could not start on this page.", error);
  }
}

function getStoredFields() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_FIELDS }, (result) => {
      if (chrome.runtime.lastError) {
        resolve({ ...DEFAULT_FIELDS });
        return;
      }

      resolve(normalizeFields(result?.[STORAGE_KEY]));
    });
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab;
}

function normalizeFields(fields) {
  return {
    page: Boolean(fields?.page),
    target: true,
    owner: Boolean(fields?.owner),
    selector: Boolean(fields?.selector),
    html: Boolean(fields?.html),
    position: Boolean(fields?.position)
  };
}
