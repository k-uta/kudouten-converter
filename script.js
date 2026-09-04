const sourceText = document.querySelector("#sourceText");
const convertedText = document.querySelector("#convertedText");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const directionInputs = document.querySelectorAll("[name='conversionDirection']");
const latexFormat = document.querySelector("#latexFormat");
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
// ユーザーがLaTeX整形を自分で切り替えたら貼り付け時の自動判定は行わない
let latexFormatChosenByUser = false;
let statusNotice = "";

const formatNumber = (number) => number.toLocaleString("ja-JP");

const countMatches = (text, pattern) => (text.match(pattern) || []).length;
const isAsciiOnly = (text) => /^[\x00-\x7f]*$/.test(text);
const sentenceEndPattern = /([。．][」』）】〕〉》\]\)]*)(?:[ \t]+)?(?=[^\n])/g;

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

const INDENT_UNIT = "    ";
const latexSectionRanks = new Map([
  ["part", 0],
  ["chapter", 1],
  ["section", 2],
  ["subsection", 3],
  ["subsubsection", 4],
  ["paragraph", 5],
  ["subparagraph", 6],
]);
// インデントを深くしない環境
const latexTransparentEnvironments = new Set(["document"]);
// 中身を一切書き換えない環境
const latexVerbatimEnvironments = new Set([
  "verbatim",
  "Verbatim",
  "lstlisting",
  "minted",
  "alltt",
  "comment",
  "semiverbatim",
  "filecontents",
]);
// 行の並びは保ったままインデントだけ整える環境
const latexLiteralEnvironments = new Set([
  "equation",
  "eqnarray",
  "align",
  "alignat",
  "flalign",
  "gather",
  "multline",
  "split",
  "aligned",
  "alignedat",
  "gathered",
  "cases",
  "dcases",
  "array",
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
  "smallmatrix",
  "displaymath",
  "math",
  "tabular",
  "tabularx",
  "tabu",
  "longtable",
  "supertabular",
  "tikzpicture",
  "pgfpicture",
]);
const latexEnvironmentPattern = /\\(begin|end)\s*\{\s*([^}]*?)\s*\}/g;
const latexSectionPattern =
  /^\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*(?=[[{])/;
const latexItemPattern = /^\\item\b/;
const latexHardBreakPattern = /\\\\\*?(?:\s*\[[^\]]*\])?\s*$/;
const latexStandaloneUrlPattern = /^(?:https?|ftp):\/\/\S+$/;
// 引用行と箇条書き行はLaTeX以外の下書きでも独立した行として扱う
const plainStandalonePattern = /^(?:>|[-*+][ \t]+|\d+[.)][ \t]+)/;
const latexDisplayMathOpenPattern = /^(?:\\\[|\$\$)$/;
const latexDisplayMathClosePattern = /^(?:\\\]|\$\$)$/;
const latexCommandTokenPattern = /^\\(?:[a-zA-Z@]+\*?|[^a-zA-Z@\s])/;
const latexDocumentEndPattern = /\\end\s*\{\s*document\s*\}/;
const latexSignaturePattern =
  /\\(?:documentclass|usepackage|begin\s*\{|end\s*\{|(?:sub)*section\*?\s*\{|paragraph\s*\{|item\b|cite\s*\{|ref\s*\{|label\s*\{|caption\s*\{|(?:re)?newcommand|maketitle|textbf\s*\{|textit\s*\{|frac\s*\{|mathrm\s*\{)/g;

const latexEnvironmentBaseName = (name) => name.replace(/\*+$/, "");

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const looksLikeLatex = (text) =>
  (text.match(latexSignaturePattern) || []).length >= 2;

// 行末のコメントは改行を飲み込むため，その行は他の行と連結できない
const hasLatexComment = (line) => {
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\\") {
      index += 1;
      continue;
    }

    if (char === "%") {
      return true;
    }
  }

  return false;
};

const findBalancedGroupEnd = (line, start, open, close) => {
  let depth = 0;

  for (let index = start; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\\") {
      index += 1;
      continue;
    }

    if (char === open) {
      depth += 1;
      continue;
    }

    if (char === close) {
      depth -= 1;

      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return -1;
};

// コマンドと引数だけで構成された行かどうか（本文が続く行は false）
const isLatexCommandOnlyLine = (line) => {
  let index = 0;
  let sawCommand = false;

  while (index < line.length) {
    const char = line[index];

    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }

    if (char === "{" || char === "}") {
      index += 1;
      sawCommand = true;
      continue;
    }

    const command = latexCommandTokenPattern.exec(line.slice(index));

    if (!command) {
      return false;
    }

    index += command[0].length;
    sawCommand = true;

    while (index < line.length) {
      const argument = /^[ \t]*([[{])/.exec(line.slice(index));

      if (!argument) {
        break;
      }

      const groupStart = index + argument[0].length - 1;
      const groupEnd =
        argument[1] === "["
          ? findBalancedGroupEnd(line, groupStart, "[", "]")
          : findBalancedGroupEnd(line, groupStart, "{", "}");

      if (groupEnd < 0) {
        return false;
      }

      index = groupEnd;
    }
  }

  return sawCommand;
};

const countLatexIndentLevels = (stack) =>
  stack.filter((environment) => environment.indents).length;

const findLatexEnvironment = (stack, names) =>
  stack.find((environment) =>
    names.has(latexEnvironmentBaseName(environment.name)),
  );

const closesLatexEnvironment = (line, name) =>
  new RegExp(`\\\\end\\s*\\{\\s*${escapeRegExp(name)}\\s*\\}`).test(line);

// 行内の \begin / \end を順に反映し，その行を書き出すべきインデント段数を返す
const applyLatexEnvironments = (line, stack) => {
  let minLevel = countLatexIndentLevels(stack);

  latexEnvironmentPattern.lastIndex = 0;

  let match = latexEnvironmentPattern.exec(line);

  while (match) {
    const [, kind, rawName] = match;
    const name = rawName.trim();

    if (kind === "begin") {
      stack.push({ name, indents: !latexTransparentEnvironments.has(name) });
    } else if (stack.length) {
      stack.pop();
    }

    minLevel = Math.min(minLevel, countLatexIndentLevels(stack));
    match = latexEnvironmentPattern.exec(line);
  }

  return minLevel;
};

const formatLatexSource = (text) => {
  const lines = text.replace(/\r\n|\r/g, "\n").split("\n");
  const trailingNewline = /\n[ \t]*$/.test(text) ? "\n" : "";
  const formatted = [];
  const environmentStack = [];
  const sectionStack = [];
  let paragraph = "";
  let paragraphLevel = 0;
  let verbatimEnvironment = null;
  let displayMath = null;

  const currentLevel = () =>
    countLatexIndentLevels(environmentStack) + sectionStack.length;

  const pushLine = (level, content) => {
    formatted.push(
      content ? INDENT_UNIT.repeat(Math.max(level, 0)) + content : "",
    );
  };

  const pushBlankLine = () => {
    if (formatted.length && formatted[formatted.length - 1] !== "") {
      formatted.push("");
    }
  };

  const flushParagraph = () => {
    if (!paragraph) {
      return;
    }

    for (const sentence of addSentenceLineBreaks(paragraph).split("\n")) {
      pushLine(paragraphLevel, sentence.trim());
    }

    paragraph = "";
  };

  for (const line of lines) {
    if (verbatimEnvironment) {
      if (!closesLatexEnvironment(line, verbatimEnvironment)) {
        formatted.push(line);
        continue;
      }

      verbatimEnvironment = null;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      pushBlankLine();
      continue;
    }

    if (displayMath) {
      const closesDisplayMath = latexDisplayMathClosePattern.test(trimmed);
      pushLine(currentLevel() + (closesDisplayMath ? 0 : 1), trimmed);

      if (closesDisplayMath) {
        displayMath = null;
      }

      continue;
    }

    if (latexDisplayMathOpenPattern.test(trimmed)) {
      flushParagraph();
      pushLine(currentLevel(), trimmed);
      displayMath = trimmed;
      continue;
    }

    const wasLiteral = Boolean(
      findLatexEnvironment(environmentStack, latexLiteralEnvironments),
    );

    if (latexDocumentEndPattern.test(trimmed)) {
      sectionStack.length = 0;
    }

    const levelBefore = countLatexIndentLevels(environmentStack);
    const minLevel = applyLatexEnvironments(trimmed, environmentStack);
    const levelAfter = countLatexIndentLevels(environmentStack);
    const lineLevel = minLevel + sectionStack.length;
    const verbatimEntry = findLatexEnvironment(
      environmentStack,
      latexVerbatimEnvironments,
    );

    if (verbatimEntry) {
      verbatimEnvironment = verbatimEntry.name;
    }

    if (wasLiteral) {
      flushParagraph();
      pushLine(lineLevel, trimmed);
      continue;
    }

    const sectionMatch = latexSectionPattern.exec(trimmed);

    if (sectionMatch) {
      const rank = latexSectionRanks.get(sectionMatch[1]);
      flushParagraph();

      while (
        sectionStack.length &&
        sectionStack[sectionStack.length - 1] >= rank
      ) {
        sectionStack.pop();
      }

      pushLine(minLevel + sectionStack.length, trimmed);
      sectionStack.push(rank);
      continue;
    }

    if (
      levelBefore !== levelAfter ||
      minLevel !== levelBefore ||
      hasLatexComment(trimmed) ||
      latexHardBreakPattern.test(trimmed) ||
      latexStandaloneUrlPattern.test(trimmed) ||
      isLatexCommandOnlyLine(trimmed)
    ) {
      flushParagraph();
      pushLine(lineLevel, trimmed);
      continue;
    }

    if (plainStandalonePattern.test(trimmed)) {
      flushParagraph();
      // 入れ子の箇条書きを崩さないよう，環境の外では元の字下げを残す
      formatted.push(
        lineLevel
          ? INDENT_UNIT.repeat(lineLevel) + trimmed
          : line.replace(/[ \t]+$/, ""),
      );
      continue;
    }

    if (latexItemPattern.test(trimmed)) {
      flushParagraph();
      paragraph = trimmed;
      paragraphLevel = lineLevel;
      continue;
    }

    if (!paragraph) {
      paragraphLevel = lineLevel;
    }

    paragraph = paragraph ? joinWrappedLines(paragraph, trimmed) : trimmed;
  }

  flushParagraph();

  while (formatted.length && formatted[formatted.length - 1] === "") {
    formatted.pop();
  }

  return formatted.length ? `${formatted.join("\n")}${trailingNewline}` : "";
};

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
  const converted = latexFormat.checked
    ? formatLatexSource(convertedKutenTouten)
    : convertedKutenTouten;
  const replacements = countMatches(source, conversions[direction].pattern);
  const formatLabel = latexFormat.checked ? " / LaTeX整形" : "";

  convertedText.value = converted;
  updateCountPanel(source);
  replacementCount.textContent = `${conversions[direction].label} ${formatNumber(
    replacements,
  )}件${formatLabel}`;
  copyStatus.textContent = statusNotice || "コピー待機中";
  copyStatus.dataset.state = statusNotice ? "done" : "";
  statusNotice = "";
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

latexFormat.addEventListener("change", () => {
  latexFormatChosenByUser = true;
  updateText();
});

// LaTeXらしい文章が貼られたら整形を自動で有効にする（手動操作後は尊重する）
sourceText.addEventListener("paste", (event) => {
  if (latexFormat.checked || latexFormatChosenByUser) {
    return;
  }

  const pasted = event.clipboardData
    ? event.clipboardData.getData("text/plain")
    : "";

  if (!pasted || !looksLikeLatex(pasted)) {
    return;
  }

  latexFormat.checked = true;
  statusNotice = "LaTeXを検出したためLaTeX整形を有効にしました";
});

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
