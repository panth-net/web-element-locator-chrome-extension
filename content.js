(() => {
  const CONTENT_READY_KEY = "__aiElementLocatorContentReady";
  const ROOT_ID = "web-element-locator-root";
  const ACTIVE_CLASS = "web-element-locator-active";
  const COPY_SUCCESS_MS = 1800;
  const MAX_TEXT_LENGTH = 48;
  const MAX_ATTRIBUTE_LENGTH = 80;
  const MAX_HTML_LENGTH = 300;

  const DATA_ATTRIBUTES = ["data-testid", "data-cy", "data-qa", "data-ai", "data-component"];
  const ROLE_ATTRIBUTES = ["aria-label", "role", "name"];
  const OWNER_ROLE_VALUES = new Set(["navigation", "complementary", "main", "dialog", "toolbar", "tablist"]);
  const LANDMARK_TAGS = new Set(["aside", "nav", "main", "header", "footer", "section", "dialog"]);
  const SENSITIVE_TEXT_SELECTOR = "input, textarea, select, [contenteditable]";
  const INTERACTIVE_SELECTOR = [
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "summary",
    "[role='button']",
    "[role='link']",
    "[role='menuitem']",
    "[role='tab']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='switch']",
    "[role='option']",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  const GENERIC_CLASS_TOKENS = new Set([
    "active",
    "block",
    "container",
    "flex",
    "grid",
    "group",
    "hidden",
    "inline",
    "inline-block",
    "items-center",
    "justify-between",
    "justify-center",
    "lucide",
    "peer",
    "relative",
    "absolute",
    "fixed",
    "sticky",
    "sr-only",
    "transition"
  ]);

  const SEMANTIC_CLASS_PATTERN =
    /(avatar|banner|button|btn|card|content|dialog|drawer|field|footer|form|header|icon|input|item|layout|link|list|logo|main|menu|modal|nav|navbar|panel|popover|project|rail|search|section|settings|sidebar|tab|toolbar|topbar|user)/i;

  if (window[CONTENT_READY_KEY]) {
    return;
  }

  window[CONTENT_READY_KEY] = true;

  const state = {
    active: false,
    fields: null,
    root: null,
    outline: null,
    label: null,
    banner: null,
    lastElement: null,
    stopTimer: 0,
    copyInProgress: false
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "AI_LOCATOR_START") {
      return;
    }

    startInspector(message.fields);
  });

  function startInspector(fields) {
    state.fields = normalizeFields(fields);
    window.clearTimeout(state.stopTimer);
    window.removeEventListener("click", suppressFinishedClick, true);
    state.copyInProgress = false;

    if (state.active) {
      setBannerText("Web Element Locator active - hover an element");
      return;
    }

    state.active = true;
    document.documentElement.classList.add(ACTIVE_CLASS);
    createOverlay();

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("scroll", syncOutline, true);
    window.addEventListener("resize", syncOutline, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pointerdown", blockPagePointerEvent, true);
    window.addEventListener("pointerup", handleSelectEvent, true);
    window.addEventListener("mousedown", blockPagePointerEvent, true);
    window.addEventListener("mouseup", blockPagePointerEvent, true);
    window.addEventListener("dblclick", blockPagePointerEvent, true);
    window.addEventListener("contextmenu", blockPagePointerEvent, true);
    window.addEventListener("click", handleClick, true);
  }

  function stopInspector() {
    window.removeEventListener("click", suppressFinishedClick, true);
    deactivateInspector();

    state.root?.remove();
    state.root = null;
    state.outline = null;
    state.label = null;
    state.banner = null;
  }

  function deactivateInspector() {
    if (!state.active) {
      return;
    }

    state.active = false;
    state.lastElement = null;
    state.copyInProgress = false;
    window.clearTimeout(state.stopTimer);
    document.documentElement.classList.remove(ACTIVE_CLASS);

    window.removeEventListener("mousemove", handleMouseMove, true);
    window.removeEventListener("scroll", syncOutline, true);
    window.removeEventListener("resize", syncOutline, true);
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("pointerdown", blockPagePointerEvent, true);
    window.removeEventListener("pointerup", handleSelectEvent, true);
    window.removeEventListener("mousedown", blockPagePointerEvent, true);
    window.removeEventListener("mouseup", blockPagePointerEvent, true);
    window.removeEventListener("dblclick", blockPagePointerEvent, true);
    window.removeEventListener("contextmenu", blockPagePointerEvent, true);
    window.removeEventListener("click", handleClick, true);

    if (state.outline) {
      state.outline.style.display = "none";
    }

    if (state.label) {
      state.label.style.display = "none";
    }
  }

  function createOverlay() {
    document.getElementById(ROOT_ID)?.remove();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.all = "initial";
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.pointerEvents = "none";
    root.style.zIndex = "2147483647";

    const shadow = root.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        pointer-events: none;
      }

      .banner,
      .outline,
      .label {
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
        pointer-events: none;
        position: fixed;
        z-index: 2147483647;
      }

      .banner {
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        max-width: min(440px, calc(100vw - 24px));
        border: 1px solid rgba(21, 23, 28, 0.12);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.16);
        color: #161719;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.35;
        padding: 9px 12px;
      }

      .outline {
        display: none;
        border: 2px solid #0a84ff;
        border-radius: 6px;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9), 0 8px 24px rgba(10, 132, 255, 0.24);
      }

      .label {
        display: none;
        max-width: min(520px, calc(100vw - 24px));
        overflow: hidden;
        border-radius: 6px;
        background: #161719;
        color: #ffffff;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.3;
        padding: 5px 7px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;

    const banner = document.createElement("div");
    banner.className = "banner";
    banner.textContent = "Web Element Locator active - hover an element";

    const outline = document.createElement("div");
    outline.className = "outline";

    const label = document.createElement("div");
    label.className = "label";

    shadow.append(style, banner, outline, label);
    (document.body || document.documentElement).append(root);

    state.root = root;
    state.outline = outline;
    state.label = label;
    state.banner = banner;
  }

  function handleMouseMove(event) {
    if (!state.active) {
      return;
    }

    const target = getElementFromPoint(event.clientX, event.clientY);
    if (!target || target === state.lastElement) {
      return;
    }

    state.lastElement = target;
    syncOutline();
  }

  function syncOutline() {
    if (!state.active || !state.lastElement || !state.outline || !state.label) {
      return;
    }

    const rect = state.lastElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      state.outline.style.display = "none";
      state.label.style.display = "none";
      return;
    }

    state.outline.style.display = "block";
    state.outline.style.left = `${Math.max(0, rect.left)}px`;
    state.outline.style.top = `${Math.max(0, rect.top)}px`;
    state.outline.style.width = `${rect.width}px`;
    state.outline.style.height = `${rect.height}px`;

    state.label.textContent = describeTarget(state.lastElement);
    state.label.style.display = "block";
    state.label.style.left = "8px";

    const labelWidth = state.label.offsetWidth;
    const labelHeight = state.label.offsetHeight;
    const left = clamp(rect.left, 8, Math.max(8, window.innerWidth - labelWidth - 8));
    const top = rect.top > labelHeight + 10 ? rect.top - labelHeight - 6 : rect.bottom + 6;

    state.label.style.left = `${left}px`;
    state.label.style.top = `${clamp(top, 8, Math.max(8, window.innerHeight - labelHeight - 8))}px`;
  }

  function handleKeyDown(event) {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    stopInspector();
  }

  function blockPagePointerEvent(event) {
    if (!state.active) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  async function handleClick(event) {
    await handleSelectEvent(event);
  }

  async function handleSelectEvent(event) {
    if (!state.active) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }

    if (state.copyInProgress) {
      return;
    }

    const target = getElementFromPoint(event.clientX, event.clientY) || state.lastElement;
    if (!target) {
      return;
    }

    state.copyInProgress = true;

    try {
      const payload = buildPayloadForElement(target, state.fields);
      await copyText(payload);
      setBannerText("Copied to clipboard.");
      if (event.type !== "click") {
        window.addEventListener("click", suppressFinishedClick, true);
      }
      deactivateInspector();
      state.stopTimer = window.setTimeout(stopInspector, COPY_SUCCESS_MS);
    } catch (error) {
      console.warn("Web Element Locator could not copy.", error);
      setBannerText("Copy failed. Press Esc to cancel.");
      state.copyInProgress = false;
    }
  }

  function suppressFinishedClick(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.removeEventListener("click", suppressFinishedClick, true);
  }

  function getElementFromPoint(x, y) {
    const element = document.elementFromPoint(x, y);

    if (!element || state.root?.contains(element)) {
      return null;
    }

    return element instanceof Element ? element : null;
  }

  function buildPayloadForElement(element, fields) {
    const normalizedFields = normalizeFields(fields);
    const targetInfo = getTargetInfo(element);
    const owner = findOwner(targetInfo.ownerSearchElement || targetInfo.primaryElement, targetInfo.primaryElement);

    return buildPayload({
      fields: normalizedFields,
      page: getSafePage(),
      target: targetInfo.description,
      owner: normalizedFields.owner && owner ? describeElement(owner, { includeText: false }) : "",
      selector: normalizedFields.selector ? buildStableSelector(targetInfo.primaryElement, owner) : "",
      html: normalizedFields.html ? getHtmlSnippet(targetInfo.primaryElement) : "",
      position: normalizedFields.position ? getPosition(targetInfo.primaryElement) : ""
    });
  }

  function buildPayload({ fields, page, target, owner, selector, html, position }) {
    const normalizedFields = normalizeFields(fields);
    const lines = [];
    const targetValue = normalizeLineValue(target);

    if (normalizedFields.page && page) {
      lines.push(`page: ${normalizeLineValue(page)}`);
    }

    lines.push(`target: ${targetValue}`);

    if (normalizedFields.owner && owner) {
      lines.push(`owner: ${normalizeLineValue(owner)}`);
    }

    if (normalizedFields.selector && selector) {
      lines.push(`selector: ${normalizeLineValue(selector)}`);
    }

    if (normalizedFields.html && html) {
      lines.push(`html: ${capString(normalizeLineValue(html), MAX_HTML_LENGTH)}`);
    }

    if (normalizedFields.position && position) {
      lines.push(`position: ${normalizeLineValue(position)}`);
    }

    return lines.join("\n");
  }

  function describeTarget(element) {
    return getTargetInfo(element).description;
  }

  function getTargetInfo(element) {
    const svg = findNearestSvg(element);
    const interactiveParent = findInteractiveParent(element);

    if (svg && interactiveParent && interactiveParent !== svg) {
      return {
        primaryElement: interactiveParent,
        ownerSearchElement: interactiveParent.parentElement,
        description: `${describeElement(svg, { includeText: false })} inside ${describeElement(interactiveParent)}`
      };
    }

    if (isSvgLowSignalElement(element) && svg) {
      return {
        primaryElement: svg,
        ownerSearchElement: svg.parentElement,
        description: describeElement(svg, { includeText: false })
      };
    }

    return {
      primaryElement: element,
      ownerSearchElement: element.parentElement,
      description: describeElement(element)
    };
  }

  function findNearestSvg(element) {
    return element.closest?.("svg") || null;
  }

  function isSvgLowSignalElement(element) {
    const tag = element.tagName.toLowerCase();
    return ["path", "circle", "line", "polyline", "polygon", "rect", "g", "use"].includes(tag);
  }

  function findInteractiveParent(element) {
    const interactive = element.closest?.(INTERACTIVE_SELECTOR);

    if (!interactive || interactive === document.documentElement || interactive === document.body) {
      return null;
    }

    return interactive;
  }

  function describeElement(element, options = {}) {
    const includeText = options.includeText !== false;
    const tag = element.tagName.toLowerCase();
    const selectorParts = [tag];

    const id = element.getAttribute("id");
    if (id && isStableToken(id)) {
      selectorParts.push(`#${cssEscape(id)}`);
    }

    for (const attr of DATA_ATTRIBUTES) {
      const value = element.getAttribute(attr);
      if (isUsableAttributeValue(value)) {
        selectorParts.push(`[${attr}="${escapeAttribute(value)}"]`);
      }
    }

    const href = getSafeHref(element);
    if (href) {
      selectorParts.push(`[href="${escapeAttribute(href)}"]`);
    }

    if (element instanceof HTMLInputElement) {
      const type = element.getAttribute("type");
      if (isUsableAttributeValue(type)) {
        selectorParts.push(`[type="${escapeAttribute(type.toLowerCase())}"]`);
      }
    }

    for (const attr of ROLE_ATTRIBUTES) {
      const value = element.getAttribute(attr);
      if (isUsableAttributeValue(value)) {
        selectorParts.push(`[${attr}="${escapeAttribute(value)}"]`);
      }
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const placeholder = element.getAttribute("placeholder");
      if (isUsableAttributeValue(placeholder)) {
        selectorParts.push(`[placeholder="${escapeAttribute(placeholder)}"]`);
      }
    }

    for (const token of getUsefulClassTokens(element).slice(0, 2)) {
      selectorParts.push(`.${cssEscape(token)}`);
    }

    const text = includeText ? getShortText(element) : "";
    const textPart = text ? ` text="${escapeAttribute(text)}"` : "";

    return `${selectorParts.join("")}${textPart}`;
  }

  function findOwner(startElement, targetElement) {
    if (!startElement) {
      return null;
    }

    const targetRect = (targetElement || startElement).getBoundingClientRect();
    const targetArea = Math.max(1, targetRect.width * targetRect.height);
    let best = null;
    let depth = 0;

    for (let element = startElement; element && element !== document.body && element !== document.documentElement; element = element.parentElement) {
      const score = scoreOwnerCandidate(element, targetArea, depth);

      if (score >= 35 && isUsefulOwnerCandidate(element) && (!best || score > best.score)) {
        best = { element, score };
      }

      depth += 1;
    }

    return best?.element || null;
  }

  function isUsefulOwnerCandidate(element) {
    const tag = element.tagName.toLowerCase();
    return tag !== "section" || hasStrongOwnerSignal(element);
  }

  function scoreOwnerCandidate(element, targetArea, depth) {
    const tag = element.tagName.toLowerCase();
    const rect = element.getBoundingClientRect();
    const area = Math.max(1, rect.width * rect.height);
    const usefulClasses = getUsefulClassTokens(element);
    let score = 0;

    if (DATA_ATTRIBUTES.some((attr) => isUsableAttributeValue(element.getAttribute(attr)))) {
      score += 45;
    }

    if (LANDMARK_TAGS.has(tag)) {
      score += 35;
    }

    const role = element.getAttribute("role");
    if (role && OWNER_ROLE_VALUES.has(role.toLowerCase())) {
      score += 30;
    }

    if (isUsableAttributeValue(element.getAttribute("aria-label"))) {
      score += 16;
    }

    const id = element.getAttribute("id");
    if (id && isStableToken(id)) {
      score += 12;
    }

    const semanticClassCount = usefulClasses.filter((token) => SEMANTIC_CLASS_PATTERN.test(token)).length;
    score += Math.min(24, semanticClassCount * 12);

    const areaRatio = area / targetArea;
    if (areaRatio >= 1.5 && areaRatio <= 2000) {
      score += Math.min(12, Math.log2(areaRatio) * 2);
    }

    score -= depth * 1.5;
    return score;
  }

  function hasStrongOwnerSignal(element) {
    if (DATA_ATTRIBUTES.some((attr) => isUsableAttributeValue(element.getAttribute(attr)))) {
      return true;
    }

    const role = element.getAttribute("role");
    if (role && OWNER_ROLE_VALUES.has(role.toLowerCase())) {
      return true;
    }

    const id = element.getAttribute("id");
    return (
      isUsableAttributeValue(element.getAttribute("aria-label")) ||
      Boolean(id && isStableToken(id)) ||
      getUsefulClassTokens(element).some((token) => SEMANTIC_CLASS_PATTERN.test(token))
    );
  }

  function buildStableSelector(element, owner) {
    const ownerSelector = owner ? buildElementSelector(owner, { preferDataOnly: true }) : "";
    const targetSelector = buildElementSelector(element);

    if (!targetSelector) {
      return "";
    }

    if (ownerSelector && owner !== element && owner.contains(element)) {
      return `${ownerSelector} ${targetSelector}`;
    }

    return targetSelector;
  }

  function buildElementSelector(element, options = {}) {
    const tag = element.tagName.toLowerCase();
    const dataSelector = getDataSelector(element);

    if (dataSelector) {
      return options.preferDataOnly ? dataSelector : `${tag}${dataSelector}`;
    }

    const id = element.getAttribute("id");
    if (id && isStableToken(id)) {
      return `${tag}#${cssEscape(id)}`;
    }

    const ariaLabel = element.getAttribute("aria-label");
    if (isUsableAttributeValue(ariaLabel)) {
      return `${tag}[aria-label="${escapeSelectorAttribute(ariaLabel)}"]`;
    }

    const name = element.getAttribute("name");
    if (isUsableAttributeValue(name)) {
      return `${tag}[name="${escapeSelectorAttribute(name)}"]`;
    }

    const href = getSafeHref(element);
    if (href) {
      return `${tag}[href="${escapeSelectorAttribute(href)}"]`;
    }

    const classToken = getUsefulClassTokens(element)[0];
    if (classToken) {
      return `${tag}.${cssEscape(classToken)}`;
    }

    return "";
  }

  function getDataSelector(element) {
    for (const attr of DATA_ATTRIBUTES) {
      const value = element.getAttribute(attr);
      if (isUsableAttributeValue(value)) {
        return `[${attr}="${escapeSelectorAttribute(value)}"]`;
      }
    }

    return "";
  }

  function getUsefulClassTokens(element) {
    const tokens = Array.from(element.classList || []).filter(isUsefulClassToken);
    const semantic = tokens.filter((token) => SEMANTIC_CLASS_PATTERN.test(token));
    const fallback = tokens.filter((token) => !SEMANTIC_CLASS_PATTERN.test(token));

    return [...semantic, ...fallback].slice(0, 4);
  }

  function isUsefulClassToken(token) {
    if (!token || token.length > 36 || GENERIC_CLASS_TOKENS.has(token) || token.includes(":")) {
      return false;
    }

    if (isKnownUtilityClassToken(token)) {
      return false;
    }

    if (/^\d/.test(token)) {
      return false;
    }

    if (SEMANTIC_CLASS_PATTERN.test(token)) {
      return true;
    }

    return /[a-zA-Z]/.test(token);
  }

  function isKnownUtilityClassToken(token) {
    if (/^(items|justify|content|self|place|place-items|place-content)-(start|end|center|between|around|evenly|stretch|baseline|normal)$/.test(token)) {
      return true;
    }

    if (/^(top|right|bottom|left|inset|z|opacity)-(\d|px|auto|full|\[|-)/.test(token)) {
      return true;
    }

    return /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|min-w|max-w|min-h|max-h|text|bg|border|rounded|shadow|gap|space|grid-cols|col|row|overflow|truncate|font|leading|tracking|ring|outline|divide|translate|scale|rotate|skew|object|aspect)-/.test(token);
  }

  function getShortText(element) {
    if (isSensitiveTextElement(element)) {
      return "";
    }

    const text = getSanitizedText(element);
    if (!text || text.length > MAX_TEXT_LENGTH) {
      return "";
    }

    return text;
  }

  function isSensitiveTextElement(element) {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element.isContentEditable ||
      Boolean(element.closest?.("[contenteditable=''], [contenteditable='true']"))
    );
  }

  function getSanitizedText(element) {
    const textParts = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if (isInsideSensitiveDescendant(textNode, element)) {
        continue;
      }

      const text = textNode.nodeValue?.replace(/\s+/g, " ").trim();
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join(" ").replace(/\s+/g, " ").trim();
  }

  function isInsideSensitiveDescendant(node, root) {
    for (let element = node.parentElement; element && element !== root; element = element.parentElement) {
      if (isSensitiveTextElement(element)) {
        return true;
      }
    }

    return false;
  }

  function getSafeHref(element) {
    if (!(element instanceof HTMLAnchorElement) && !element.hasAttribute("href")) {
      return "";
    }

    const rawHref = element.getAttribute("href")?.trim();
    if (!rawHref) {
      return "";
    }

    if (rawHref.startsWith("#")) {
      return capString(rawHref, MAX_ATTRIBUTE_LENGTH);
    }

    const lowerHref = rawHref.toLowerCase();
    const isRoutePath = rawHref.startsWith("/") && !rawHref.startsWith("//");
    const isHttpUrl = lowerHref.startsWith("http://") || lowerHref.startsWith("https://");
    if (!isRoutePath && !isHttpUrl) {
      return "";
    }

    try {
      const url = new URL(rawHref, location.href);
      return `${url.pathname}${url.hash}`;
    } catch {
      return "";
    }
  }

  function getSafePage() {
    return `${location.pathname}${location.hash}`;
  }

  function getHtmlSnippet(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === "script" || tag === "style") {
      return `<${tag}>`;
    }

    const attributes = getSafeHtmlAttributes(element);
    const openingTag = `<${tag}${attributes ? ` ${attributes}` : ""}>`;
    const text = getShortText(element);
    const html = text && ["button", "a", "span", "label"].includes(tag)
      ? `${openingTag}${escapeHtml(text)}</${tag}>`
      : openingTag;

    return html.length > MAX_HTML_LENGTH ? `${html.slice(0, MAX_HTML_LENGTH - 3)}...` : html;
  }

  function getSafeHtmlAttributes(element) {
    const attributes = [];
    const id = element.getAttribute("id");

    if (id && isStableToken(id)) {
      attributes.push(`id="${escapeHtmlAttribute(id)}"`);
    }

    for (const attr of [...DATA_ATTRIBUTES, "aria-label", "role", "name", "type", "placeholder"]) {
      const value = element.getAttribute(attr);
      if (isUsableAttributeValue(value)) {
        attributes.push(`${attr}="${escapeHtmlAttribute(value)}"`);
      }
    }

    const href = getSafeHref(element);
    if (href) {
      attributes.push(`href="${escapeHtmlAttribute(href)}"`);
    }

    const className = Array.from(element.classList || []).slice(0, 8).join(" ");
    if (className) {
      attributes.push(`class="${escapeHtmlAttribute(className.slice(0, 140))}"`);
    }

    return attributes.join(" ");
  }

  function getPosition(element) {
    const rect = element.getBoundingClientRect();
    return `x=${Math.round(rect.left)} y=${Math.round(rect.top)} w=${Math.round(rect.width)} h=${Math.round(rect.height)}`;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        fallbackCopyText(text);
        return;
      }
    }

    fallbackCopyText(text);
  }

  function fallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    document.body.append(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("Fallback copy failed.");
    }
  }

  function isUsableAttributeValue(value) {
    return Boolean(value && value.trim() && value.length <= MAX_ATTRIBUTE_LENGTH);
  }

  function normalizeLineValue(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function capString(value, maxLength) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
  }

  function isStableToken(value) {
    return value.length <= 48 && !/(^|[-_])[0-9a-f]{8,}([-_]|$)/i.test(value) && !/^\d+$/.test(value);
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return CSS.escape(value);
    }

    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function escapeAttribute(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim();
  }

  function escapeSelectorAttribute(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeHtmlAttribute(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function setBannerText(text) {
    if (state.banner) {
      state.banner.textContent = text;
    }
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
})();
