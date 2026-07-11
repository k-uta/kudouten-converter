const sourceText = document.querySelector("#sourceText");
const convertedText = document.querySelector("#convertedText");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const directionInputs = document.querySelectorAll("[name='conversionDirection']");
const sentenceLineBreaks = document.querySelector("#sentenceLineBreaks");
const charCount = document.querySelector("#charCount");
const noLineBreakCount = document.querySelector("#noLineBreakCount");
const noWhitespaceCount = document.querySelector("#noWhitespaceCount");
const lineCount = document.querySelector("#lineCount");
const manuscriptCount = document.querySelector("#manuscriptCount");
const variantCount = document.querySelector("#variantCount");
const utf8Bytes = document.querySelector("#utf8Bytes");
const utf16Bytes = document.querySelector("#utf16Bytes");
const shiftJisBytes = document.querySelector("#shiftJisBytes");
const eucJpBytes = document.querySelector("#eucJpBytes");
const jisBytes = document.querySelector("#jisBytes");
const replacementCount = document.querySelector("#replacementCount");
const copyStatus = document.querySelector("#copyStatus");

const conversions = {
  forward: {
    label: "変換",
    rules: [
      ["、", "，"],
      ["。", "．"],
    ],
    pattern: /[、。]/g,
  },
  reverse: {
    label: "逆変換",
    rules: [
      ["，", "、"],
      ["．", "。"],
    ],
    pattern: /[，．]/g,
  },
};

const textEncoder = new TextEncoder();
const graphemeSegmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;
let legacyByteMaps = null;
let triedLegacyByteMaps = false;

const formatNumber = (number) => number.toLocaleString("ja-JP");

const countMatches = (text, pattern) => (text.match(pattern) || []).length;
const isAsciiOnly = (text) => /^[\x00-\x7f]*$/.test(text);
const sentenceEndPattern = /([。．][」』）】〕〉》\]\)]*)(?:[ \t]+)?(?=[^\n])/g;
const protectedLinePattern =
  /^\s*(?:%|>|[-*+]\s+|\d+[.)]\s+|\\(?:begin|end|documentclass|usepackage|section|subsection|subsubsection|chapter|part|title|author|date|maketitle|tableofcontents|bibliography|bibliographystyle|item)\b|\\\[|\\\]|\\\(|\\\)|\$\$)/;
const explicitLatexBreakPattern = /\\\\\s*(?:%.*)?$/;
const protectedBlockStartPattern =
  /^\s*(?:\\\[\s*$|\$\$\s*$|\\begin\{(?:equation|align|alignat|flalign|gather|multline|split|cases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|array|tabular|tabularx|table|figure|tikzpicture|lstlisting|verbatim|itemize|enumerate|description)\*?\})/;
const protectedBlockEndPattern =
  /^\s*(?:\\\]\s*$|\$\$\s*$|\\end\{(?:equation|align|alignat|flalign|gather|multline|split|cases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|array|tabular|tabularx|table|figure|tikzpicture|lstlisting|verbatim|itemize|enumerate|description)\*?\})/;

const getDirection = () => {
  const checkedDirection = document.querySelector(
    "[name='conversionDirection']:checked",
  );

  return checkedDirection ? checkedDirection.value : "forward";
};

const convertKutenTouten = (text, direction) =>
  conversions[direction].rules.reduce(
    (converted, [from, to]) => converted.split(from).join(to),
    text,
  );

const shouldInsertAsciiSpace = (previous, next) =>
  /[A-Za-z0-9]$/.test(previous) && /^[A-Za-z0-9]/.test(next);

const joinWrappedLines = (previous, next) => {
  const trimmedPrevious = previous.replace(/[ \t]+$/, "");
  const trimmedNext = next.replace(/^[ \t]+/, "");

  if (!trimmedPrevious) {
    return trimmedNext;
  }

  if (!trimmedNext) {
    return trimmedPrevious;
  }

  return `${trimmedPrevious}${
    shouldInsertAsciiSpace(trimmedPrevious, trimmedNext) ? " " : ""
  }${trimmedNext}`;
};

const addSentenceLineBreaks = (text) =>
  text.replace(sentenceEndPattern, "$1\n");

const isProtectedLine = (line) =>
  protectedLinePattern.test(line) || explicitLatexBreakPattern.test(line);

const startsProtectedBlock = (line) =>
  protectedBlockStartPattern.test(line) && !/\\end\{/.test(line);

const formatLineBreakBlock = (block) => {
  const lines = block.split("\n");
  const formattedLines = [];
  let paragraph = "";
  let inProtectedBlock = false;

  const flushParagraph = () => {
    if (!paragraph) {
      return;
    }

    formattedLines.push(...addSentenceLineBreaks(paragraph).split("\n"));
    paragraph = "";
  };

  for (const line of lines) {
    if (inProtectedBlock) {
      formattedLines.push(line);
      inProtectedBlock = !protectedBlockEndPattern.test(line);
      continue;
    }

    if (isProtectedLine(line)) {
      flushParagraph();
      formattedLines.push(line);
      inProtectedBlock = startsProtectedBlock(line);
      continue;
    }

    paragraph = paragraph ? joinWrappedLines(paragraph, line) : line.trimEnd();
  }

  flushParagraph();
  return formattedLines.join("\n");
};

const formatSentenceLineBreaks = (text) =>
  text
    .replace(/\r\n|\r/g, "\n")
    .split(/(\n[ \t]*\n(?:[ \t]*\n)*)/)
    .map((block) =>
      /^\n[ \t]*\n(?:[ \t]*\n)*$/.test(block)
        ? block
        : formatLineBreakBlock(block),
    )
    .join("");

const countGraphemes = (text) => {
  if (!text) {
    return 0;
  }

  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)].length;
  }

  return [...text].length;
};

const countLines = (text) => {
  if (!text) {
    return 0;
  }

  return text.split(/\r\n|\r|\n/).length;
};

const isVariationSelector = (codePoint) =>
  (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
  (codePoint >= 0xe0100 && codePoint <= 0xe01ef);

const isHalfWidthKatakana = (codePoint) =>
  codePoint >= 0xff61 && codePoint <= 0xff9f;

const isLegacyDoubleByte = (codePoint) =>
  (codePoint >= 0x3000 && codePoint <= 0x30ff) ||
  (codePoint >= 0x3400 && codePoint <= 0x9fff) ||
  (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
  (codePoint >= 0xff01 && codePoint <= 0xff60) ||
  (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
  (codePoint >= 0x0391 && codePoint <= 0x03c9) ||
  (codePoint >= 0x0401 && codePoint <= 0x0451) ||
  (codePoint >= 0x2010 && codePoint <= 0x203e) ||
  (codePoint >= 0x2103 && codePoint <= 0x223d) ||
  (codePoint >= 0x2460 && codePoint <= 0x266f);

const decodeBytes = (decoder, bytes) => {
  try {
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    return "";
  }
};

const addDecodedCharacter = (map, decoder, bytes, byteLength = bytes.length) => {
  const decoded = decodeBytes(decoder, bytes);

  if (
    decoded &&
    !decoded.includes("\ufffd") &&
    [...decoded].length === 1 &&
    (!map.has(decoded) || map.get(decoded) > byteLength)
  ) {
    map.set(decoded, byteLength);
  }
};

const buildShiftJisMap = () => {
  const decoder = new TextDecoder("shift-jis", { fatal: true });
  const map = new Map();

  for (let byte = 0xa1; byte <= 0xdf; byte += 1) {
    addDecodedCharacter(map, decoder, [byte]);
  }

  const leadBytes = [
    ...Array.from({ length: 0x9f - 0x81 + 1 }, (_, index) => 0x81 + index),
    ...Array.from({ length: 0xfc - 0xe0 + 1 }, (_, index) => 0xe0 + index),
  ];
  const trailBytes = [
    ...Array.from({ length: 0x7e - 0x40 + 1 }, (_, index) => 0x40 + index),
    ...Array.from({ length: 0xfc - 0x80 + 1 }, (_, index) => 0x80 + index),
  ];

  for (const leadByte of leadBytes) {
    for (const trailByte of trailBytes) {
      addDecodedCharacter(map, decoder, [leadByte, trailByte]);
    }
  }

  return map;
};

const buildEucJpMap = () => {
  const decoder = new TextDecoder("euc-jp", { fatal: true });
  const map = new Map();

  for (let byte = 0xa1; byte <= 0xdf; byte += 1) {
    addDecodedCharacter(map, decoder, [0x8e, byte]);
  }

  for (let firstByte = 0xa1; firstByte <= 0xfe; firstByte += 1) {
    for (let secondByte = 0xa1; secondByte <= 0xfe; secondByte += 1) {
      addDecodedCharacter(map, decoder, [firstByte, secondByte]);
      addDecodedCharacter(map, decoder, [0x8f, firstByte, secondByte]);
    }
  }

  return map;
};

const buildJisDoubleByteMap = () => {
  const decoder = new TextDecoder("iso-2022-jp", { fatal: true });
  const map = new Map();

  for (let firstByte = 0x21; firstByte <= 0x7e; firstByte += 1) {
    for (let secondByte = 0x21; secondByte <= 0x7e; secondByte += 1) {
      addDecodedCharacter(
        map,
        decoder,
        [0x1b, 0x24, 0x42, firstByte, secondByte, 0x1b, 0x28, 0x42],
        2,
      );
    }
  }

  return map;
};

const getLegacyByteMaps = () => {
  if (triedLegacyByteMaps) {
    return legacyByteMaps;
  }

  triedLegacyByteMaps = true;

  if (typeof TextDecoder === "undefined") {
    return legacyByteMaps;
  }

  try {
    legacyByteMaps = {
      shiftJis: buildShiftJisMap(),
      eucJp: buildEucJpMap(),
      jisDoubleByte: buildJisDoubleByteMap(),
    };
  } catch {
    legacyByteMaps = null;
  }

  return legacyByteMaps;
};

const getFallbackShiftJisByteLength = (text) => {
  let bytes = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    bytes +=
      codePoint <= 0x7f || isHalfWidthKatakana(codePoint)
        ? 1
        : isLegacyDoubleByte(codePoint) && !isVariationSelector(codePoint)
          ? 2
          : 1;
  }

  return bytes;
};

const getFallbackEucJpByteLength = (text) => {
  let bytes = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    bytes +=
      codePoint <= 0x7f
        ? 1
        : isHalfWidthKatakana(codePoint) ||
            (isLegacyDoubleByte(codePoint) && !isVariationSelector(codePoint))
          ? 2
          : 1;
  }

  return bytes;
};

const getShiftJisByteLength = (text) => {
  if (isAsciiOnly(text)) {
    return text.length;
  }

  const maps = getLegacyByteMaps();

  if (!maps) {
    return getFallbackShiftJisByteLength(text);
  }

  let bytes = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    bytes += codePoint <= 0x7f ? 1 : maps.shiftJis.get(char) || 1;
  }

  return bytes;
};

const getEucJpByteLength = (text) => {
  if (isAsciiOnly(text)) {
    return text.length;
  }

  const maps = getLegacyByteMaps();

  if (!maps) {
    return getFallbackEucJpByteLength(text);
  }

  let bytes = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    bytes += codePoint <= 0x7f ? 1 : maps.eucJp.get(char) || 1;
  }

  return bytes;
};

const getFallbackJisByteLength = (text) => {
  let bytes = 0;
  let inDoubleByteMode = false;

  const switchToAscii = () => {
    if (inDoubleByteMode) {
      bytes += 3;
      inDoubleByteMode = false;
    }
  };

  const switchToDoubleByte = () => {
    if (!inDoubleByteMode) {
      bytes += 3;
      inDoubleByteMode = true;
    }
  };

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    const isDoubleByte =
      isLegacyDoubleByte(codePoint) && !isVariationSelector(codePoint);

    if (isDoubleByte) {
      switchToDoubleByte();
      bytes += 2;
      continue;
    }

    switchToAscii();
    bytes += 1;
  }

  switchToAscii();
  return bytes;
};

const getJisByteLength = (text) => {
  if (isAsciiOnly(text)) {
    return text.length;
  }

  const maps = getLegacyByteMaps();

  if (!maps) {
    return getFallbackJisByteLength(text);
  }

  let bytes = 0;
  let mode = "ascii";

  const switchMode = (nextMode) => {
    if (mode !== nextMode) {
      bytes += 3;
      mode = nextMode;
    }
  };

  for (const char of text) {
    const codePoint = char.codePointAt(0);

    if (codePoint <= 0x7f) {
      switchMode("ascii");
      bytes += 1;
    } else if (isHalfWidthKatakana(codePoint)) {
      switchMode("katakana");
      bytes += 1;
    } else if (maps.jisDoubleByte.has(char)) {
      switchMode("double");
      bytes += 2;
    } else {
      switchMode("ascii");
      bytes += 1;
    }
  }

  switchMode("ascii");
  return bytes;
};

const getTextStats = (text) => {
  const withoutLineBreaks = text.replace(/\r\n|\r|\n/g, "");
  const withoutWhitespace = text.replace(/[\s\u3000]/g, "");
  const visibleChars = countGraphemes(text);
  const noLineBreakChars = countGraphemes(withoutLineBreaks);

  return {
    chars: visibleChars,
    noLineBreakChars,
    noWhitespaceChars: countGraphemes(withoutWhitespace),
    lines: countLines(text),
    manuscriptPages: noLineBreakChars ? Math.ceil(noLineBreakChars / 400) : 0,
    variants: [...text].filter((char) =>
      isVariationSelector(char.codePointAt(0)),
    ).length,
    utf8: textEncoder.encode(text).length,
    utf16: text.length * 2,
    shiftJis: getShiftJisByteLength(text),
    eucJp: getEucJpByteLength(text),
    jis: getJisByteLength(text),
  };
};

const updateCountPanel = (source) => {
  const stats = getTextStats(source);

  charCount.textContent = formatNumber(stats.chars);
  noLineBreakCount.textContent = formatNumber(stats.noLineBreakChars);
  noWhitespaceCount.textContent = formatNumber(stats.noWhitespaceChars);
  lineCount.textContent = formatNumber(stats.lines);
  manuscriptCount.textContent = formatNumber(stats.manuscriptPages);
  variantCount.textContent = formatNumber(stats.variants);
  utf8Bytes.textContent = formatNumber(stats.utf8);
  utf16Bytes.textContent = formatNumber(stats.utf16);
  shiftJisBytes.textContent = formatNumber(stats.shiftJis);
  eucJpBytes.textContent = formatNumber(stats.eucJp);
  jisBytes.textContent = formatNumber(stats.jis);
};

const updateText = () => {
  const source = sourceText.value;
  const direction = getDirection();
  const convertedKutenTouten = convertKutenTouten(source, direction);
  const converted = sentenceLineBreaks.checked
    ? formatSentenceLineBreaks(convertedKutenTouten)
    : convertedKutenTouten;
  const replacements = countMatches(source, conversions[direction].pattern);
  const lineBreakLabel = sentenceLineBreaks.checked ? " / 句点改行" : "";

  convertedText.value = converted;
  updateCountPanel(source);
  replacementCount.textContent = `${conversions[direction].label} ${formatNumber(
    replacements,
  )}件${lineBreakLabel}`;
  copyStatus.textContent = "コピー待機中";
  copyStatus.dataset.state = "";
};

const writePlainText = async (text) => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return;
  }

  convertedText.focus();
  convertedText.select();
  const copied = document.execCommand("copy");
  convertedText.setSelectionRange(0, 0);

  if (!copied) {
    throw new Error("Copy command failed.");
  }
};

const inputPanel = document.querySelector(".input-panel");

if (typeof ResizeObserver !== "undefined" && inputPanel) {
  const resizeObserver = new ResizeObserver(() => {
    // ドラッグリサイズはインラインの width を設定するので、それを合図に幅を固定する
    if (sourceText.style.width) {
      inputPanel.classList.add("user-sized");
    }
  });
  resizeObserver.observe(sourceText);
}

sourceText.addEventListener("input", updateText);
directionInputs.forEach((input) => input.addEventListener("change", updateText));
sentenceLineBreaks.addEventListener("change", updateText);

clearButton.addEventListener("click", () => {
  sourceText.value = "";
  updateText();
  sourceText.focus();
});

copyButton.addEventListener("click", async () => {
  if (!convertedText.value) {
    copyStatus.textContent = "コピーする文字がありません";
    copyStatus.dataset.state = "warn";
    return;
  }

  try {
    await writePlainText(convertedText.value);
    copyStatus.textContent = "プレーンテキストでコピーしました";
    copyStatus.dataset.state = "done";
  } catch {
    copyStatus.textContent = "コピーできませんでした";
    copyStatus.dataset.state = "warn";
  }
});

updateText();
