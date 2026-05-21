# kudouten-converter

A tiny, dependency-free web tool that converts Japanese punctuation in plain
text. It replaces the Japanese comma (`、`) with a full-width comma (`，`) and
the Japanese period (`。`) with a full-width period (`．`).

This punctuation style is commonly required for academic papers and research
grant applications in Japan.

> The user interface is in Japanese; this README and the source code comments
> are in English.

## Features

- Instant conversion as you type
- One-click copy of the result as plain text
- Live character count and replacement count
- Runs entirely in the browser — no text leaves your device
- No build step and no dependencies

## Conversion rules

| Input | Output |
| ----- | ------ |
| `、`  | `，`   |
| `。`  | `．`   |

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

## Deployment (GitHub Pages)

This is a static site with relative asset paths, so it can be hosted on
GitHub Pages as-is:

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and the `/ (root)` folder, then save.

The site will be published at
`https://<username>.github.io/kudouten-converter/`.

The empty `.nojekyll` file disables Jekyll processing so the files are served
exactly as committed.

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
