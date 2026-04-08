const MESSAGE_BUFFER_SELECTOR = "#messagebuffer";
const NUKE_OVERLAY_ID = "nuke-overlay";
const NUKE_TARGETING_CLASS = "nuke-targeting";
const NUKE_DISINTEGRATING_CLASS = "nuke-disintegrating";
const NUKE_PENDING_DATA_KEY = "nukePending";
const NUKE_MISSILE_IMAGE_URL =
  "https://mikobotecdn.win/emotes/imissilefauna.png";
const NUKE_COMMAND_REGEX = /^(?:!|\/|\.\/)nuke\b/i;
const NUKE_COMMAND_WITH_TARGET_REGEX = /^(?:!|\/|\.\/)nuke\s+(.+)$/i;
const NUKE_COOLDOWN_MS = 15000;
const NUKE_FLIGHT_DURATION_MS = 3800;
const NUKE_IMPACT_DELAY_MS = 3500;
const NUKE_DISINTEGRATION_DURATION_MS = 1350;
const NUKE_ROW_REMOVAL_DELAY_MS =
  NUKE_IMPACT_DELAY_MS + NUKE_DISINTEGRATION_DURATION_MS;
const NUKE_CLEANUP_DELAY_MS = NUKE_ROW_REMOVAL_DELAY_MS + 250;
const NUKE_COMMAND_ALLOWED_USERS = [];
const NUKE_MISSILE_ROTATION_OFFSET_DEG = 200;
const NUKE_COMMAND_MIN_RANK =
  typeof Rank !== "undefined" && Rank && Rank.Moderator != null
    ? Rank.Moderator
    : 2;

let isNukeEnabled = true;
let isNukeMessageHandlerAttached = false;
let nukeCooldownUntilMs = 0;
const activeNukeShots = new Set();

export function normalizeNukeCommandTarget(rawTarget) {
  const trimmedTarget = String(rawTarget || "").trim();
  if (!trimmedTarget) {
    return "";
  }

  const emoteWrappedTargetMatch = trimmedTarget.match(/^:([^:\s]+):$/);
  if (emoteWrappedTargetMatch) {
    return String(emoteWrappedTargetMatch[1] || "").trim();
  }

  return trimmedTarget.replace(/^@+/, "").trim();
}

export function parseNukeCommand(messageText, messageRootElement = null) {
  const candidateMessages = [
    String(messageText || ""),
    getTextWithEmoteTitlesIfAvailable(messageRootElement),
  ];

  for (const rawCandidate of candidateMessages) {
    const trimmedMessage = String(rawCandidate || "").trim();
    if (!trimmedMessage) {
      continue;
    }

    const commandMatch = trimmedMessage.match(NUKE_COMMAND_WITH_TARGET_REGEX);
    if (!commandMatch) {
      continue;
    }

    const commandArgument = String(commandMatch[1] || "").trim();
    if (!commandArgument) {
      continue;
    }

    const firstToken = commandArgument.split(/\s+/)[0];
    const targetUsername = normalizeNukeCommandTarget(firstToken);
    if (!targetUsername) {
      continue;
    }

    return {
      targetUsername,
    };
  }

  return null;
}

export function isNukeCommandAttempt(messageText, messageRootElement = null) {
  const candidateMessages = [
    String(messageText || ""),
    getTextWithEmoteTitlesIfAvailable(messageRootElement),
  ];

  return candidateMessages.some((rawCandidate) =>
    NUKE_COMMAND_REGEX.test(String(rawCandidate || "").trim()),
  );
}

export function formatNukeCooldownRemaining(remainingMs) {
  const roundedTenths = Math.ceil(Math.max(0, Number(remainingMs) || 0) / 100);
  return `${(roundedTenths / 10).toFixed(1)}s`;
}

function getChatModuleUtils() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.CHAT_MODULE_UTILS || null;
}

function getTextWithEmoteTitlesIfAvailable(messageRootElement) {
  const ChatModuleUtils = getChatModuleUtils();
  if (
    !ChatModuleUtils ||
    typeof ChatModuleUtils.getTextWithEmoteTitles !== "function" ||
    !messageRootElement
  ) {
    return "";
  }

  return ChatModuleUtils.getTextWithEmoteTitles(messageRootElement);
}

function getViewportDimensions() {
  const documentElement =
    typeof document !== "undefined" ? document.documentElement : null;

  return {
    width:
      (typeof window !== "undefined" && window.innerWidth) ||
      (documentElement && documentElement.clientWidth) ||
      0,
    height:
      (typeof window !== "undefined" && window.innerHeight) ||
      (documentElement && documentElement.clientHeight) ||
      0,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeRotationNearReference(angleDeg, referenceDeg) {
  let normalizedAngle = Number(angleDeg) || 0;
  const referenceAngle = Number(referenceDeg) || 0;

  while (normalizedAngle - referenceAngle > 180) {
    normalizedAngle -= 360;
  }

  while (normalizedAngle - referenceAngle < -180) {
    normalizedAngle += 360;
  }

  return normalizedAngle;
}

function isNodeStillConnected(node) {
  if (!node) {
    return false;
  }

  if (typeof node.isConnected === "boolean") {
    return node.isConnected;
  }

  if (document.body && typeof document.body.contains === "function") {
    return document.body.contains(node);
  }

  return Boolean(
    document.documentElement &&
    typeof document.documentElement.contains === "function" &&
    document.documentElement.contains(node),
  );
}

function addNukeEventListener(target, eventName, listener, options) {
  if (!target || typeof target.addEventListener !== "function") {
    return () => {};
  }

  target.addEventListener(eventName, listener, options);
  return () => {
    if (typeof target.removeEventListener === "function") {
      target.removeEventListener(eventName, listener, options);
    }
  };
}

function getNukeScrollableAncestorElements(node) {
  if (!node || typeof window.getComputedStyle !== "function") {
    return [];
  }

  const scrollableAncestors = [];
  const seenAncestors = new Set();
  let currentElement = node.parentElement;

  while (currentElement && currentElement !== document.documentElement) {
    const computedStyle = window.getComputedStyle(currentElement);
    const overflowValues = [
      computedStyle && computedStyle.overflow,
      computedStyle && computedStyle.overflowX,
      computedStyle && computedStyle.overflowY,
    ];

    if (
      overflowValues.some((overflowValue) =>
        /auto|scroll|overlay/i.test(String(overflowValue || "")),
      ) &&
      !seenAncestors.has(currentElement)
    ) {
      seenAncestors.add(currentElement);
      scrollableAncestors.push(currentElement);
    }

    currentElement = currentElement.parentElement;
  }

  return scrollableAncestors;
}

function getNukeShotGeometry(rowElement) {
  if (!isNodeStillConnected(rowElement)) {
    return null;
  }

  const { width: viewportWidth, height: viewportHeight } =
    getViewportDimensions();
  if (!viewportWidth || !viewportHeight) {
    return null;
  }

  const targetRect = rowElement.getBoundingClientRect();
  const targetX = clamp(
    targetRect.left + targetRect.width * 0.5,
    42,
    viewportWidth - 42,
  );
  const targetY = clamp(
    targetRect.top + targetRect.height * 0.5,
    38,
    viewportHeight - 38,
  );
  const originX = viewportWidth + 72;
  const originY = viewportHeight + 46;
  const apexX = clamp(
    targetX + (originX - targetX) * 0.46,
    88,
    viewportWidth - 88,
  );
  const apexY = clamp(
    Math.min(targetY, originY) - Math.max(150, viewportHeight * 0.38),
    32,
    Math.max(48, viewportHeight * 0.33),
  );
  const firstLegAngle =
    (Math.atan2(apexY - originY, apexX - originX) * 180) / Math.PI;
  const finalLegAngle =
    (Math.atan2(targetY - apexY, targetX - apexX) * 180) / Math.PI;

  return {
    apexX,
    apexY,
    finalLegAngle,
    firstLegAngle,
    originX,
    originY,
    targetX,
    targetY,
  };
}

function applyNukeCssVariables() {
  const rootElement =
    typeof document !== "undefined" ? document.documentElement : null;
  if (!rootElement || !rootElement.style) {
    return;
  }

  rootElement.style.setProperty(
    "--nuke-missile-image-url",
    `url("${NUKE_MISSILE_IMAGE_URL}")`,
  );
  rootElement.style.setProperty(
    "--nuke-flight-duration",
    `${NUKE_FLIGHT_DURATION_MS}ms`,
  );
  rootElement.style.setProperty(
    "--nuke-impact-delay",
    `${NUKE_IMPACT_DELAY_MS}ms`,
  );
  rootElement.style.setProperty(
    "--nuke-disintegration-duration",
    `${NUKE_DISINTEGRATION_DURATION_MS}ms`,
  );
  rootElement.style.setProperty(
    "--nuke-missile-rotation-offset",
    `${NUKE_MISSILE_ROTATION_OFFSET_DEG}deg`,
  );
}

function applyNukeShotGeometry(shotElement, shotGeometry) {
  if (!shotElement || !shotGeometry) {
    return;
  }

  const launchAngle = shotGeometry.firstLegAngle;
  const targetAngle = normalizeRotationNearReference(
    shotGeometry.finalLegAngle,
    launchAngle,
  );

  shotElement.style.setProperty("--nuke-origin-x", `${shotGeometry.originX}px`);
  shotElement.style.setProperty("--nuke-origin-y", `${shotGeometry.originY}px`);
  shotElement.style.setProperty("--nuke-apex-x", `${shotGeometry.apexX}px`);
  shotElement.style.setProperty("--nuke-apex-y", `${shotGeometry.apexY}px`);
  shotElement.style.setProperty("--nuke-target-x", `${shotGeometry.targetX}px`);
  shotElement.style.setProperty("--nuke-target-y", `${shotGeometry.targetY}px`);
  shotElement.style.setProperty("--nuke-origin-rotate", `${launchAngle}deg`);
  shotElement.style.setProperty("--nuke-apex-rotate", `${targetAngle}deg`);
  shotElement.style.setProperty("--nuke-target-rotate", `${targetAngle}deg`);
  shotElement.style.setProperty(
    "--nuke-missile-rotation-offset",
    `${NUKE_MISSILE_ROTATION_OFFSET_DEG}deg`,
  );
}

function getOrCreateNukeOverlayElement() {
  let overlayElement = document.getElementById(NUKE_OVERLAY_ID);
  if (overlayElement) {
    return overlayElement;
  }

  overlayElement = document.createElement("div");
  overlayElement.id = NUKE_OVERLAY_ID;
  document.body.appendChild(overlayElement);
  return overlayElement;
}

function removeNukeOverlayElementIfEmpty() {
  const overlayElement = document.getElementById(NUKE_OVERLAY_ID);
  if (!overlayElement || overlayElement.childElementCount) {
    return;
  }

  overlayElement.remove();
}

function clearNukeShotTimeout(handle) {
  if (handle) {
    window.clearTimeout(handle);
  }
}

function cleanupTargetRowState(rowElement) {
  if (!rowElement) {
    return;
  }

  rowElement.classList.remove(NUKE_TARGETING_CLASS, NUKE_DISINTEGRATING_CLASS);
  if (rowElement.dataset) {
    delete rowElement.dataset[NUKE_PENDING_DATA_KEY];
  }
}

function cleanupNukeShot(nukeShot) {
  if (!nukeShot || nukeShot.isCleanedUp) {
    return;
  }

  nukeShot.isCleanedUp = true;
  clearNukeShotTimeout(nukeShot.impactHandle);
  clearNukeShotTimeout(nukeShot.rowRemovalHandle);
  clearNukeShotTimeout(nukeShot.cleanupHandle);

  if (typeof nukeShot.stopTracking === "function") {
    nukeShot.stopTracking();
  }

  if (nukeShot.targetRowElement) {
    cleanupTargetRowState(nukeShot.targetRowElement);
  }

  if (nukeShot.shotElement && isNodeStillConnected(nukeShot.shotElement)) {
    nukeShot.shotElement.remove();
  }

  activeNukeShots.delete(nukeShot);
  removeNukeOverlayElementIfEmpty();
}

function cleanupAllNukeShots() {
  for (const nukeShot of Array.from(activeNukeShots)) {
    cleanupNukeShot(nukeShot);
  }
}

function createNukeShot(shotGeometry, targetRowElement) {
  const overlayElement = getOrCreateNukeOverlayElement();
  const shotElement = document.createElement("div");
  shotElement.className = "nuke-shot";
  applyNukeShotGeometry(shotElement, shotGeometry);

  const smokeElement = document.createElement("div");
  smokeElement.className = "nuke-smoke";

  const missileElement = document.createElement("div");
  missileElement.className = "nuke-missile";

  const impactElement = document.createElement("div");
  impactElement.className = "nuke-impact";

  shotElement.append(smokeElement, missileElement, impactElement);
  overlayElement.appendChild(shotElement);

  const nukeShot = {
    cleanupHandle: 0,
    impactHandle: 0,
    isCleanedUp: false,
    rowRemovalHandle: 0,
    shotElement,
    stopTracking: null,
    targetRowElement,
    trackingCleanupCallbacks: [],
    trackingFrameHandle: 0,
  };

  const syncNukeGeometry = () => {
    if (
      !isNodeStillConnected(shotElement) ||
      !targetRowElement ||
      !isNodeStillConnected(targetRowElement)
    ) {
      return;
    }

    const nextGeometry = getNukeShotGeometry(targetRowElement);
    if (nextGeometry) {
      applyNukeShotGeometry(shotElement, nextGeometry);
    }
  };

  const scheduleNukeGeometrySync = () => {
    if (
      nukeShot.trackingFrameHandle ||
      !isNodeStillConnected(targetRowElement)
    ) {
      return;
    }

    if (typeof window.requestAnimationFrame === "function") {
      nukeShot.trackingFrameHandle = window.requestAnimationFrame(() => {
        nukeShot.trackingFrameHandle = 0;
        syncNukeGeometry();
      });
      return;
    }

    nukeShot.trackingFrameHandle = window.setTimeout(() => {
      nukeShot.trackingFrameHandle = 0;
      syncNukeGeometry();
    }, 16);
  };

  nukeShot.stopTracking = () => {
    if (nukeShot.trackingFrameHandle) {
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(nukeShot.trackingFrameHandle);
      } else {
        window.clearTimeout(nukeShot.trackingFrameHandle);
      }
      nukeShot.trackingFrameHandle = 0;
    }

    for (const cleanupCallback of nukeShot.trackingCleanupCallbacks) {
      cleanupCallback();
    }
    nukeShot.trackingCleanupCallbacks = [];
  };

  const passiveListenerOptions = { passive: true };
  nukeShot.trackingCleanupCallbacks.push(
    addNukeEventListener(
      window,
      "resize",
      scheduleNukeGeometrySync,
      passiveListenerOptions,
    ),
    addNukeEventListener(
      window,
      "scroll",
      scheduleNukeGeometrySync,
      passiveListenerOptions,
    ),
  );

  for (const scrollableAncestorElement of getNukeScrollableAncestorElements(
    targetRowElement,
  )) {
    nukeShot.trackingCleanupCallbacks.push(
      addNukeEventListener(
        scrollableAncestorElement,
        "scroll",
        scheduleNukeGeometrySync,
        passiveListenerOptions,
      ),
    );
  }

  nukeShot.impactHandle = window.setTimeout(() => {
    if (!isNodeStillConnected(targetRowElement)) {
      cleanupTargetRowState(targetRowElement);
      return;
    }

    targetRowElement.classList.remove(NUKE_TARGETING_CLASS);
    targetRowElement.classList.add(NUKE_DISINTEGRATING_CLASS);
    nukeShot.stopTracking();
  }, NUKE_IMPACT_DELAY_MS);

  nukeShot.rowRemovalHandle = window.setTimeout(() => {
    cleanupTargetRowState(targetRowElement);
    if (isNodeStillConnected(targetRowElement)) {
      targetRowElement.remove();
    }
  }, NUKE_ROW_REMOVAL_DELAY_MS);

  nukeShot.cleanupHandle = window.setTimeout(() => {
    cleanupNukeShot(nukeShot);
  }, NUKE_CLEANUP_DELAY_MS);

  activeNukeShots.add(nukeShot);
  return nukeShot;
}

function getNukeCooldownRemainingMs(nowMs = Date.now()) {
  return Math.max(0, nukeCooldownUntilMs - Number(nowMs || 0));
}

function startNukeCooldown(nowMs = Date.now()) {
  nukeCooldownUntilMs = Number(nowMs || 0) + Math.max(0, NUKE_COOLDOWN_MS);
}

function postNukeStatusSystemMessage(message) {
  const ChatModuleUtils = getChatModuleUtils();
  if (
    !ChatModuleUtils ||
    typeof ChatModuleUtils.postStatusSystemMessage !== "function"
  ) {
    return;
  }

  ChatModuleUtils.postStatusSystemMessage(message, {
    messageBufferSelector: MESSAGE_BUFFER_SELECTOR,
    rowClass: "nuke-system-message",
  });
}

function findLatestMessageRowByUsername(username, options = {}) {
  const ChatModuleUtils = getChatModuleUtils();
  if (
    !ChatModuleUtils ||
    typeof ChatModuleUtils.normalizeUsername !== "function"
  ) {
    return null;
  }

  const normalizedTarget = ChatModuleUtils.normalizeUsername(username);
  if (!normalizedTarget) {
    return null;
  }

  const excludedRowElement =
    options && options.excludeRowElement ? options.excludeRowElement : null;
  const messageRows = document.querySelectorAll(
    `${MESSAGE_BUFFER_SELECTOR} > div`,
  );

  for (let index = messageRows.length - 1; index >= 0; index -= 1) {
    const rowElement = messageRows[index];
    if (!rowElement || rowElement === excludedRowElement) {
      continue;
    }

    const $row = $(rowElement);
    if (
      !$row.length ||
      ChatModuleUtils.isServerMessageRow($row) ||
      (rowElement.dataset && rowElement.dataset[NUKE_PENDING_DATA_KEY] === "1")
    ) {
      continue;
    }

    const authorUsername = ChatModuleUtils.normalizeUsername(
      ChatModuleUtils.getMessageAuthor($row),
    );
    if (authorUsername !== normalizedTarget) {
      continue;
    }

    return $row;
  }

  return null;
}

function fireNukeAtRow($targetRow) {
  if (!isNukeEnabled || !$targetRow || !$targetRow.length) {
    return false;
  }

  const rowElement = $targetRow[0];
  if (
    !isNodeStillConnected(rowElement) ||
    (rowElement.dataset && rowElement.dataset[NUKE_PENDING_DATA_KEY] === "1")
  ) {
    return false;
  }

  const shotGeometry = getNukeShotGeometry(rowElement);
  if (!shotGeometry) {
    return false;
  }

  if (rowElement.dataset) {
    rowElement.dataset[NUKE_PENDING_DATA_KEY] = "1";
  }
  rowElement.classList.add(NUKE_TARGETING_CLASS);

  const nukeShot = createNukeShot(shotGeometry, rowElement);
  if (!nukeShot) {
    cleanupTargetRowState(rowElement);
    return false;
  }

  return true;
}

function fireNukeAtUsername(username, options = {}) {
  const $targetRow = findLatestMessageRowByUsername(username, options);
  if (!$targetRow || !$targetRow.length) {
    return false;
  }

  return fireNukeAtRow($targetRow);
}

function tryTriggerNukeAtUsername(username, options = {}) {
  if (!isNukeEnabled) {
    return {
      cooldownRemainingMs: 0,
      didFire: false,
      reason: "disabled",
    };
  }

  const nowMs = Date.now();
  const cooldownRemainingMs = getNukeCooldownRemainingMs(nowMs);
  if (cooldownRemainingMs > 0) {
    return {
      cooldownRemainingMs,
      didFire: false,
      reason: "cooldown",
    };
  }

  const didFire = fireNukeAtUsername(username, options);
  if (!didFire) {
    return {
      cooldownRemainingMs: 0,
      didFire: false,
      reason: "missingTarget",
    };
  }

  startNukeCooldown(nowMs);
  return {
    cooldownRemainingMs: getNukeCooldownRemainingMs(nowMs),
    didFire: true,
    reason: "fired",
  };
}

function isAuthorAllowedForNuke(authorUsername) {
  const ChatModuleUtils = getChatModuleUtils();
  if (
    !ChatModuleUtils ||
    typeof ChatModuleUtils.isAuthorAllowed !== "function"
  ) {
    return false;
  }

  return ChatModuleUtils.isAuthorAllowed(authorUsername, {
    allowedUsers: new Set(
      NUKE_COMMAND_ALLOWED_USERS.map(ChatModuleUtils.normalizeUsername).filter(
        Boolean,
      ),
    ),
    minRank: NUKE_COMMAND_MIN_RANK,
  });
}

function handleNukeMessage($messageElement) {
  const ChatModuleUtils = getChatModuleUtils();
  if (!ChatModuleUtils || !$messageElement || !$messageElement.length) {
    return;
  }

  if (!isNukeEnabled) {
    return;
  }

  const $row = ChatModuleUtils.getMessageRow($messageElement, {
    messageBufferSelector: MESSAGE_BUFFER_SELECTOR,
  });
  if (!$row || ChatModuleUtils.isServerMessageRow($row)) {
    return;
  }

  const messageRootElement = ChatModuleUtils.getMessageContentRootElement(
    $messageElement,
    {
      $row,
      messageBufferSelector: MESSAGE_BUFFER_SELECTOR,
    },
  );
  if (!messageRootElement) {
    return;
  }

  const messageAuthor = ChatModuleUtils.getMessageAuthor($row);
  const messageText = String(messageRootElement.textContent || "");
  const parsedCommand = parseNukeCommand(messageText, messageRootElement);
  const commandAttempt = isNukeCommandAttempt(messageText, messageRootElement);

  if (parsedCommand) {
    $row.remove();

    if (!isAuthorAllowedForNuke(messageAuthor)) {
      return;
    }

    const triggerResult = tryTriggerNukeAtUsername(
      parsedCommand.targetUsername,
      {
        excludeRowElement: $row[0],
      },
    );

    if (!triggerResult.didFire && triggerResult.reason === "cooldown") {
      postNukeStatusSystemMessage(
        `Nuke silo is reloading for ${formatNukeCooldownRemaining(triggerResult.cooldownRemainingMs)}.`,
      );
      return;
    }

    if (!triggerResult.didFire) {
      postNukeStatusSystemMessage(
        `Nuke missed: no recent message from "${parsedCommand.targetUsername}".`,
      );
    }
    return;
  }

  if (commandAttempt) {
    $row.remove();

    if (isAuthorAllowedForNuke(messageAuthor)) {
      postNukeStatusSystemMessage("Usage: /nuke <username>");
    }
  }
}

function setNukeEnabled(nextEnabled) {
  const desiredEnabled = Boolean(nextEnabled);
  if (desiredEnabled === isNukeEnabled) {
    return isNukeEnabled;
  }

  isNukeEnabled = desiredEnabled;
  if (!isNukeEnabled) {
    nukeCooldownUntilMs = 0;
    cleanupAllNukeShots();
  }

  return isNukeEnabled;
}

function getNukeState() {
  return {
    activeShots: activeNukeShots.size,
    allowedUsers: NUKE_COMMAND_ALLOWED_USERS,
    commandMinRank: NUKE_COMMAND_MIN_RANK,
    cooldownMs: NUKE_COOLDOWN_MS,
    cooldownRemainingMs: getNukeCooldownRemainingMs(),
    enabled: isNukeEnabled,
  };
}

function shouldInitializeBrowserRuntime() {
  return Boolean(
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof $ === "function" &&
    window.CHAT_MODULE_UTILS &&
    window.fesFun,
  );
}

async function initializeNuke() {
  if (!shouldInitializeBrowserRuntime()) {
    return;
  }

  const fesFun = window.fesFun;
  applyNukeCssVariables();
  window.nukeCommand = {
    fireAtUser(username, options = {}) {
      return tryTriggerNukeAtUsername(username, options).didFire;
    },
    getState: getNukeState,
    toggle(on) {
      const desiredEnabled = Boolean(on);
      if (desiredEnabled && !fesFun.isEnabled()) {
        return false;
      }

      return setNukeEnabled(desiredEnabled);
    },
  };

  fesFun.registerModule({
    id: "nuke",
    setEnabled: setNukeEnabled,
    getState: getNukeState,
  });

  if (typeof window.waitForFunc === "function") {
    await window.waitForFunc("MESSAGE_PROCESSOR");
  }

  if (isNukeMessageHandlerAttached) {
    return;
  }

  fesFun.registerLiveMessageHandler(handleNukeMessage);
  isNukeMessageHandlerAttached = true;
}

initializeNuke();
