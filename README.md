# Silicon From Scratch — Website

Source code for the **Silicon From Scratch** website — a learning hub for anyone
curious about how the processors inside modern devices are designed and built.

This repository contains only the website (static HTML/CSS, with a tiny bit of
vanilla JavaScript for the mobile menu). The hardware designs themselves live in a
separate repository: **[Silicon-From-Scratch](https://github.com/estaresinic05/Silicon-From-Scratch)**.

## Live site

https://estaresinic05.github.io/silicon-from-scratch-site

## Structure

```
index.html        Page markup
styles/main.css   Design tokens, layout, components, responsive + motion rules
scripts/main.js   Mobile navigation toggle (the only JavaScript)
assets/           Logo and images
```

## Running locally

No build step. Just open `index.html` in a browser.

## Notes

- All internal links are relative, so the site is ready for a custom domain later
  with no file changes.
- Motion is restrained and fully disabled under `prefers-reduced-motion`.
