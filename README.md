# kudouten-converter

Published page: <https://k-uta.github.io/kudouten-converter/>

A tiny, dependency-free web tool for Japanese manuscript text. It converts the
Japanese comma (`、`) and period (`。`) to full-width comma (`，`) and period
(`．`) or back, reformats LaTeX sources into one sentence per line with
structural indentation, and highlights every change it made.

## Features

- Instant conversion as you type
- Forward and reverse punctuation conversion
- Optional LaTeX reformatting into one sentence per line — Japanese and English
  — with structural indentation, enabled automatically when LaTeX source is
  pasted
- Every change highlighted in the result: converted punctuation, inserted line
  breaks, added indentation, and joined lines
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

## LaTeX formatting

Enable `LaTeX整形` to rewrite a LaTeX source for readability and line-by-line
diffs. The checkbox turns itself on when the pasted text looks like LaTeX;
toggling it by hand keeps your choice for the rest of the session. Plain text
without LaTeX markup is simply broken into one sentence per line.

- One sentence per line: a line break is inserted after every `．`/`。`, and
  hard-wrapped lines of the same paragraph are joined back together first
- English sentences break after `.`, `!` or `?` when the next sentence starts
  with a capital letter, a command, math or a Japanese character — with or
  without a space after the period, so `…per control step.At $N=8192$…` is
  split as well. When a space follows, an opening quote or bracket also counts
  as a sentence start
- Abbreviations (`Fig.`, `No.`, `Nos.`, `Eq.`, `Sec.`, `e.g.`, `et al.`, …),
  initials and initialisms (`K. Sawada`, `U.S.`), decimals (`12.9`), version
  numbers (`1.5.1`), file names (`fig.pdf`), domains (`example.org`) and email
  addresses are left alone, while a unit that ends a sentence (`for at least
  5 s.`) still breaks
- Joining restores the space that a line break represents in Latin text and
  drops it between Japanese characters, matching how LaTeX itself reads the
  source
- Blank lines are kept, because a paragraph break in the rendered PDF needs two
  line breaks; runs of blank lines collapse into one
- Quoted lines (`>`) and list items (`- `, `1. `) stay on their own line and
  keep their own indentation
- Trailing whitespace is dropped

LaTeX sources are indented on top of that:

- Bodies of `\begin{...}`/`\end{...}` are indented by four spaces per nesting
  level, `document` excepted
- `\section`, `\subsection`, `\subsubsection`, `\paragraph` and their
  siblings indent everything that follows them, one level per heading level
- Lines that must stay on their own line are only re-indented, never merged:
  comments, lines ending in `%` or `\\`, structural commands such as
  `\label{...}`, and standalone URLs. A hard-wrapped line that happens to hold
  only an inline command (`\texttt{...}`, `\cite{...}`, a custom macro) is
  joined back into the sentence it belongs to
- Math and table environments (`equation`, `align`, `tabular`, `tikzpicture`,
  …) and `\[ ... \]` blocks keep their line structure and are only re-indented
- `verbatim`, `lstlisting` and similar environments are copied through
  untouched

Running the formatter again on its own output changes nothing, so re-pasting a
formatted file is safe.

## Diff highlighting

The result pane colours what the tool changed, so a formatted file can be
reviewed before it is pasted back:

| Highlight | Meaning |
| --------- | ------- |
| Amber, underlined character | Punctuation converted (`、` → `，`) |
| Teal block | Line break or indentation inserted |
| Teal `↵` | A line break was added at that point |
| Amber dotted bar | Two hard-wrapped lines were joined there |

The status bar counts each kind. The `↵` and dotted markers are drawn with CSS
pseudo-elements, so copying the result — with the copy button or by selecting
the text — yields the plain formatted source without any marker characters.

## Usage

Open the published page, paste your text into the left panel, and the converted
text appears on the right with the changes highlighted. Use the copy button to
copy the result to the clipboard as plain text; the panel headers stay pinned to
the top of the viewport while scrolling, so the copy button is always reachable.

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
