let mahjongModeEnabled = false;
let mahjongLurkEnabled = false;

function getTextInputBox() {
  if (typeof $ !== "function") {
    return null;
  }

  return $("#chatline");
}

function formatMJMessage($messageElement) {
  if (!$messageElement.text().startsWith('MJ:')) {
    return
  }
  let $timestampElement = $messageElement.parent().find('.timestamp')
  $($messageElement).addClass("MahjongMessage")
  $timestampElement.css("background-image", "url('https://raw.githubusercontent.com/om3tcw/r/refs/heads/emotes/eyes/nyagger.png')")
  const textNodeFromMessage = $messageElement.contents()[0];
  textNodeFromMessage.nodeValue = textNodeFromMessage.nodeValue.replace(/^MJ: /, '');
  toggleSingleMJMessage($messageElement, canReadMJMessages())
} 

function prependMessagesWithMJ(textInputBox) {
  if (textInputBox.val() && !textInputBox.val().startsWith('MJ: ')) {
      textInputBox.val('MJ: ' + textInputBox.val());
  }
}

function toggleSingleMJMessage($messageElement, canRead) {
  if (canRead) {
    $messageElement.parent().css('display', 'block');
  } else {
    $messageElement.parent().css('display', 'none');
  }
}

function toggleMJMessages(self) {
  let canRead = self && self.checkbox ? self.checkbox.prop('checked') : canReadMJMessages();
  $('#messagebuffer [class|="MahjongMessage"]').each((_, element) => {
    let $jqElement = $(element)
    toggleSingleMJMessage($jqElement, canRead);
  })
}

export const secretMJEmotes = [
  { name: ":nyaggernap:", image: "https://raw.githubusercontent.com/puchigire/r/emotes/emotes/nyaggernap.jpg"},
  { name: ":yakuless:", image: "https://raw.githubusercontent.com/puchigire/r/emotes/emotes/yakuless.gif" },
  { name: ":nightynightnyagger:", image: "https://raw.githubusercontent.com/puchigire/r/emotes/emotes/nightynightnyagger.png" },
  { name: ":chinpo:", image: "https://raw.githubusercontent.com/puchigire/r/emotes/emotes/chinpo.png" },
  { name: ":sharingiscaring:", image: "https://raw.githubusercontent.com/puchigire/r/emotes/emotes/sharingiscaring.png" },
  { name: ":pardner:", image: "https://raw.githubusercontent.com/puchigire/r/emotes/emotes/pardner.png" },
  { name: ":nyaggerfed:", image: "https://raw.githubusercontent.com/puchigire/r/emotes/emotes/nyaggerfed.png" },
  { name: ":nyaggerfish:", image: "https://raw.githubusercontent.com/puchigire/r/emotes/emotes/nyaggerfish.png" }  
]

export function sanitizeText(str) {
    str = str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;");
    return str;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createMahjongEmoteDefinition(emote) {
  const source = String(emote?.source || escapeRegExp(emote?.name || ""));
  return {
    ...emote,
    source,
    regex: new RegExp(source, "gi"),
  };
}

export function syncMahjongEmotes(channel, isEnabled, emotes = secretMJEmotes) {
  if (
    !channel ||
    !Array.isArray(channel.emotes) ||
    !channel.emoteMap ||
    typeof channel.emoteMap !== "object"
  ) {
    return false;
  }

  const mahjongKeys = new Set(
    emotes.map((emote) => sanitizeText(emote.name)),
  );

  channel.emotes = channel.emotes.filter(
    (emote) => !mahjongKeys.has(sanitizeText(emote?.name || "")),
  );

  for (const key of mahjongKeys) {
    delete channel.emoteMap[key];
  }

  if (!isEnabled) {
    return true;
  }

  for (const emote of emotes) {
    const normalizedEmote = createMahjongEmoteDefinition(emote);
    const mapKey = sanitizeText(normalizedEmote.name);
    if (channel.emoteMap[mapKey]) {
      continue;
    }

    channel.emotes.push(normalizedEmote);
    channel.emoteMap[mapKey] = normalizedEmote;
  }

  return true;
}

function refreshMahjongMessages() {
  if (typeof $ !== "function") {
    return;
  }

  toggleMJMessages();
}

function canReadMJMessages() {
  return mahjongModeEnabled || mahjongLurkEnabled;
}

function syncRuntimeMahjongEmotes() {
  if (typeof CHANNEL === "undefined") {
    return false;
  }

  return syncMahjongEmotes(CHANNEL, canReadMJMessages());
}

export function setMahjongModeEnabled(nextEnabled) {
  mahjongModeEnabled = Boolean(nextEnabled);
  const $textInputBox = getTextInputBox();

  if ($textInputBox && $textInputBox.length) {
    $textInputBox.off("input.prependMJ focus.prependMJ");

    if (mahjongModeEnabled) {
      $textInputBox.on("input.prependMJ focus.prependMJ", () =>
        prependMessagesWithMJ($textInputBox),
      );
    } else {
      $textInputBox.val($textInputBox.val().replace(/^MJ: /, ""));
    }
  }

  syncRuntimeMahjongEmotes();
  refreshMahjongMessages();
  return mahjongModeEnabled;
}

export function setMahjongLurkEnabled(nextEnabled) {
  mahjongLurkEnabled = Boolean(nextEnabled);
  syncRuntimeMahjongEmotes();
  refreshMahjongMessages();
  return mahjongLurkEnabled;
}

if (typeof window !== "undefined") {
  window.setMahjongModeEnabled = setMahjongModeEnabled;
  window.setMahjongLurkEnabled = setMahjongLurkEnabled;
}

if (typeof window !== "undefined" && typeof window.waitForFunc === "function") {
  (async () => {
    await window.waitForFunc("MESSAGE_PROCESSOR")

    MESSAGE_PROCESSOR.addTap(formatMJMessage);
    syncRuntimeMahjongEmotes();
  })();
}
