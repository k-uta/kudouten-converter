# kudouten-converter

A tiny, dependency-free web tool that converts Japanese punctuation in plain
text. It can convert the Japanese comma (`、`) and period (`。`) to full-width
comma (`，`) and period (`．`), or reverse them back.

## Features

- Instant conversion as you type
- Forward and reverse punctuation conversion
- One-click copy of the result as plain text
- Live character, line, manuscript-page, variant-selector, and byte counts
- Runs entirely in the browser — no text leaves your device
- No build step and no dependencies

## Conversion rules

| Input | Output |
| ----- | ------ |
| `、`  | `，`   |
| `。`  | `．`   |

Reverse conversion swaps the same pairs in the opposite direction.

## Usage

Open the published page, paste your text into the left panel, and the converted
text appears on the right. Use the copy button to copy the result to the
clipboard as plain text.

## Local development

No build step is required. Open `index.html` directly in a browser, or serve
the folder with any static file server, for example:

```bash
python -m http.server 8000
```

Then visit <http://localhost:8000>.

## Project structure

```
index.html    Markup and page structure
styles.css    Styling
script.js     Conversion logic and UI behavior
favicon.svg   Site icon
.nojekyll     Disables Jekyll on GitHub Pages
```

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).
