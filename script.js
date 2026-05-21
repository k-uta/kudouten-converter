const sourceText = document.querySelector("#sourceText");
const convertedText = document.querySelector("#convertedText");
const copyButton = document.querySelector("#copyButton");
const clearButton = document.querySelector("#clearButton");
const charCount = document.querySelector("#charCount");
const replacementCount = document.querySelector("#replacementCount");
const copyStatus = document.querySelector("#copyStatus");

const convertKutenTouten = (text) => text.replace(/、/g, "，").replace(/。/g, "．");

const countMatches = (text, pattern) => (text.match(pattern) || []).length;

const updateText = () => {
  const source = sourceText.value;
  const converted = convertKutenTouten(source);
  const replacements = countMatches(source, /[、。]/g);

  convertedText.value = converted;
  charCount.textContent = `${source.length.toLocaleString("ja-JP")}文字`;
  replacementCount.textContent = `置換 ${replacements.toLocaleString("ja-JP")}件`;
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

sourceText.addEventListener("input", updateText);

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
