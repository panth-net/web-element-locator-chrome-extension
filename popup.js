const STORAGE_KEY = "copyFields";

const DEFAULT_FIELDS = {
  page: true,
  target: true,
  owner: true,
  selector: false,
  html: false,
  position: false
};

const FIELD_ORDER = ["page", "target", "owner", "selector", "html", "position"];
const FIELD_LABELS = {
  page: "Page",
  target: "Target",
  owner: "Owner",
  selector: "Selector",
  html: "HTML",
  position: "Position"
};

const SHORTCUT_COMMAND = "start-identifying";
const SHORTCUTS_URL = "chrome://extensions/shortcuts";

const MODIFIER_ORDER = ["Control", "Alt", "Shift", "Command"];

const SYMBOL_TOKENS = {
  "⌘": "Command",
  "⇧": "Shift",
  "⌥": "Alt",
  "⌃": "Control"
};

const WORD_TOKENS = {
  command: "Command",
  cmd: "Command",
  meta: "Command",
  super: "Command",
  macctrl: "Control",
  ctrl: "CtrlAmbiguous",
  control: "CtrlAmbiguous",
  alt: "Alt",
  option: "Alt",
  opt: "Alt",
  shift: "Shift"
};

const KEY_SYMBOL_NAMES = {
  "↑": "Up",
  "↓": "Down",
  "←": "Left",
  "→": "Right",
  "⌫": "Backspace",
  "⌦": "Delete",
  "⏎": "Enter",
  "↵": "Enter",
  "⇥": "Tab",
  "⎋": "Esc",
  "␣": "Space"
};

const MAC_CAPS = { Control: "⌃", Alt: "⌥", Shift: "⇧", Command: "⌘" };
const MAC_NAMES = { Control: "Control", Alt: "Option", Shift: "Shift", Command: "Command" };
const OTHER_CAPS = { Control: "Ctrl", Alt: "Alt", Shift: "Shift", Command: "Meta" };
const OTHER_NAMES = { Control: "Control", Alt: "Alt", Shift: "Shift", Command: "Meta" };

const EDIT_LABELS = {
  set: { text: "Edit", aria: "Edit keyboard shortcut" },
  unset: { text: "Set shortcut", aria: "Set keyboard shortcut" },
  open: { text: "Cancel", aria: "Cancel editing keyboard shortcut" }
};

const fieldsButton = document.querySelector("#fieldsButton");
const fieldsMenu = document.querySelector("#fieldsMenu");
const fieldsSummary = document.querySelector("#fieldsSummary");
const fieldsDropdown = document.querySelector("#fieldsDropdown");
const identifyButton = document.querySelector("#identifyButton");
const statusMessage = document.querySelector("#statusMessage");
const shortcutBlock = document.querySelector("#shortcutBlock");
const shortcutKeys = document.querySelector("#shortcutKeys");
const shortcutEditButton = document.querySelector("#shortcutEditButton");
const shortcutPanel = document.querySelector("#shortcutPanel");
const openShortcutsButton = document.querySelector("#openShortcutsButton");
let fieldsTouched = false;
let shortcutIsSet = false;

init();

function init() {
  applyFields(DEFAULT_FIELDS);
  updateFieldDisplay(DEFAULT_FIELDS);
  loadFields().then((fields) => {
    if (fieldsTouched) {
      return;
    }

    applyFields(fields);
    updateFieldDisplay(fields);
  });

  fieldsButton.addEventListener("click", () => {
    toggleMenu();
  });

  fieldsButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu({ focusFirst: true });
    }
  });

  fieldsMenu.addEventListener("change", async (event) => {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    const nextFields = collectFields();
    fieldsTouched = true;
    applyFields(nextFields);
    updateFieldDisplay(nextFields);
    await saveFields(nextFields);
  });

  fieldsMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });

  document.addEventListener("click", (event) => {
    if (!fieldsDropdown.contains(event.target)) {
      closeMenu();
    }
  });

  identifyButton.addEventListener("click", startIdentifying);

  shortcutEditButton.addEventListener("click", toggleShortcutPanel);

  shortcutBlock.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shortcutPanel.hidden) {
      event.preventDefault();
      closeShortcutPanel({ restoreFocus: true });
    }
  });

  openShortcutsButton.addEventListener("click", openShortcutsPage);

  initShortcut();
}

async function startIdentifying() {
  clearStatus();
  identifyButton.disabled = true;

  try {
    const fields = collectFields();
    fieldsTouched = true;
    saveFields(fields);

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) {
      throw new Error("No active tab available.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    await chrome.tabs.sendMessage(tab.id, {
      type: "AI_LOCATOR_START",
      fields
    });

    window.close();
  } catch (error) {
    console.warn("Web Element Locator could not start.", error);
    showError("Cannot run on this page.");
    identifyButton.disabled = false;
  }
}

function toggleMenu() {
  if (fieldsMenu.hidden) {
    openMenu();
  } else {
    closeMenu();
  }
}

function openMenu({ focusFirst = false } = {}) {
  fieldsMenu.hidden = false;
  fieldsButton.setAttribute("aria-expanded", "true");

  if (focusFirst) {
    const firstInput = fieldsMenu.querySelector("input:not(:disabled)");
    firstInput?.focus();
  }
}

function closeMenu({ restoreFocus = false } = {}) {
  fieldsMenu.hidden = true;
  fieldsButton.setAttribute("aria-expanded", "false");

  if (restoreFocus) {
    fieldsButton.focus();
  }
}

function collectFields() {
  const fields = { ...DEFAULT_FIELDS };

  for (const key of FIELD_ORDER) {
    const input = document.querySelector(`#field-${key}`);
    fields[key] = input instanceof HTMLInputElement ? input.checked : DEFAULT_FIELDS[key];
  }

  fields.target = true;
  return normalizeFields(fields);
}

function applyFields(fields) {
  const normalized = normalizeFields(fields);

  for (const key of FIELD_ORDER) {
    const input = document.querySelector(`#field-${key}`);
    const option = document.querySelector(`[data-field="${key}"]`);

    if (!(input instanceof HTMLInputElement)) {
      continue;
    }

    input.checked = normalized[key];
    input.disabled = key === "target";
    option?.classList.toggle("is-checked", normalized[key]);
    option?.setAttribute("aria-selected", String(normalized[key]));
  }
}

function updateFieldDisplay(fields) {
  const selected = FIELD_ORDER
    .filter((key) => normalizeFields(fields)[key])
    .map((key) => FIELD_LABELS[key]);

  fieldsSummary.textContent = selected.join(", ");
}

function loadFields() {
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

function saveFields(fields) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: normalizeFields(fields) }, () => {
      resolve();
    });
  });
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

function clearStatus() {
  statusMessage.textContent = "";
  statusMessage.classList.remove("is-error");
}

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add("is-error");
}

async function initShortcut() {
  const [isMac, shortcut] = await Promise.all([detectIsMac(), readShortcut()]);
  renderShortcut(shortcut, isMac);
}

function detectIsMac() {
  const uaPlatform = navigator.userAgentData?.platform || navigator.platform || "";

  if (uaPlatform) {
    return Promise.resolve(/mac/i.test(uaPlatform));
  }

  return new Promise((resolve) => {
    if (!chrome.runtime?.getPlatformInfo) {
      resolve(false);
      return;
    }

    chrome.runtime.getPlatformInfo((info) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }

      resolve(info?.os === "mac");
    });
  });
}

function readShortcut() {
  return new Promise((resolve) => {
    if (!chrome.commands?.getAll) {
      resolve("");
      return;
    }

    try {
      chrome.commands.getAll((commands) => {
        if (chrome.runtime.lastError) {
          resolve("");
          return;
        }

        const match = Array.isArray(commands)
          ? commands.find((command) => command?.name === SHORTCUT_COMMAND)
          : null;

        resolve(typeof match?.shortcut === "string" ? match.shortcut : "");
      });
    } catch (error) {
      console.warn("Web Element Locator could not read the shortcut.", error);
      resolve("");
    }
  });
}

function parseShortcut(shortcut, isMac) {
  if (typeof shortcut !== "string" || !shortcut.trim()) {
    return [];
  }

  const parts = [];
  let buffer = "";

  const flush = () => {
    for (const chunk of buffer.split("+")) {
      const trimmed = chunk.trim();

      if (trimmed) {
        parts.push(trimmed);
      }
    }

    buffer = "";
  };

  for (const char of shortcut) {
    if (SYMBOL_TOKENS[char]) {
      flush();
      parts.push(char);
    } else {
      buffer += char;
    }
  }

  flush();

  const modifiers = new Set();
  const keys = [];
  let ambiguousCtrl = false;

  for (const part of parts) {
    const symbolToken = SYMBOL_TOKENS[part];

    if (symbolToken) {
      modifiers.add(symbolToken);
      continue;
    }

    const wordToken = WORD_TOKENS[part.toLowerCase()];

    if (wordToken === "CtrlAmbiguous") {
      ambiguousCtrl = true;
      continue;
    }

    if (wordToken) {
      modifiers.add(wordToken);
      continue;
    }

    keys.push(part);
  }

  if (ambiguousCtrl) {
    modifiers.add(isMac && !modifiers.has("Command") ? "Command" : "Control");
  }

  return MODIFIER_ORDER.filter((token) => modifiers.has(token)).concat(keys);
}

function describeToken(token, isMac) {
  const caps = isMac ? MAC_CAPS : OTHER_CAPS;
  const names = isMac ? MAC_NAMES : OTHER_NAMES;

  if (caps[token]) {
    return { cap: caps[token], label: names[token] };
  }

  const symbolName = KEY_SYMBOL_NAMES[token];

  if (symbolName) {
    return { cap: token, label: symbolName };
  }

  const label = token.length === 1
    ? token.toUpperCase()
    : token.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

  return { cap: label, label };
}

function isSymbolCap(cap) {
  return /[^\u0000-\u007F]/.test(cap);
}

function renderShortcut(shortcut, isMac) {
  const tokens = parseShortcut(shortcut, isMac);

  shortcutKeys.textContent = "";
  shortcutIsSet = tokens.length > 0;

  if (!shortcutIsSet) {
    const unset = document.createElement("span");
    unset.className = "shortcut-unset";
    unset.textContent = "Not set";
    shortcutKeys.append(unset);
    updateEditButton();
    return;
  }

  tokens.forEach((token, index) => {
    const { cap, label } = describeToken(token, isMac);
    const symbol = isSymbolCap(cap);

    if (index > 0 && !isMac) {
      const join = document.createElement("span");
      join.className = "key-join";
      join.setAttribute("aria-hidden", "true");
      join.textContent = "+";
      shortcutKeys.append(join);
    }

    const key = document.createElement("kbd");
    key.className = symbol ? "key-cap is-symbol" : "key-cap";
    key.textContent = cap;
    key.title = label;
    key.setAttribute("role", "img");
    key.setAttribute("aria-label", label);
    shortcutKeys.append(key);
  });

  updateEditButton();
}

function updateEditButton() {
  const expanded = !shortcutPanel.hidden;
  const state = expanded ? "open" : (shortcutIsSet ? "set" : "unset");
  const label = EDIT_LABELS[state];

  shortcutEditButton.textContent = label.text;
  shortcutEditButton.setAttribute("aria-label", label.aria);
  shortcutEditButton.setAttribute("aria-expanded", String(expanded));
  shortcutEditButton.classList.toggle("is-prominent", state === "unset");
}

function toggleShortcutPanel() {
  if (shortcutPanel.hidden) {
    openShortcutPanel();
  } else {
    closeShortcutPanel();
  }
}

function openShortcutPanel() {
  closeMenu();
  shortcutPanel.hidden = false;
  updateEditButton();
}

function closeShortcutPanel({ restoreFocus = false } = {}) {
  const hadFocus = shortcutPanel.contains(document.activeElement);

  shortcutPanel.hidden = true;
  updateEditButton();

  if (restoreFocus || hadFocus) {
    shortcutEditButton.focus();
  }
}

async function openShortcutsPage() {
  clearStatus();

  try {
    await chrome.tabs.create({ url: SHORTCUTS_URL });
    window.close();
  } catch (error) {
    console.warn("Web Element Locator could not open the shortcuts page.", error);
    showError("Open chrome://extensions/shortcuts manually.");
  }
}
