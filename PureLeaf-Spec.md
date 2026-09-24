# PureLeaf — Master Specification
> Give this document to Claude whenever you want to build a new website using the PureLeaf platform.

---

## What Is PureLeaf?

PureLeaf is a **zero-backend, zero-framework static website platform** built with:
- Pure **HTML5** for structure
- Pure **CSS3** for styling
- Vanilla **JavaScript (fetch API)** for dynamic content loading
- Plain **.txt files** for all page and blog content
- A **posts.json manifest** as the blog engine index

No PHP. No Node. No database. No build tools. No CMS login.  
Works on any static host: cPanel shared hosting, Netlify, GitHub Pages, Cloudflare Pages.

---

## Folder Structure

```
yoursite/
├── index.html              ← Homepage
├── blog.html               ← Blog index (lists all posts)
├── post.html               ← Single post template (reused for ALL articles)
├── about.html              ← About / static info page
├── posts.json              ← Blog manifest (the "table of contents")
├── LICENSE                 ← MIT license
├── htaccess.txt            ← Apache/cPanel pretty-URL rules (rename to .htaccess on deploy)
├── _redirects              ← Netlify/Cloudflare Pages pretty-URL rules (deploy as-is)
│
├── css/
│   └── main.css            ← All styles (shared across every page)
│
├── js/
│   └── engine.js           ← The PureLeaf content engine
│
├── posts/
│   ├── my-first-post.txt   ← Blog post content files
│   ├── second-article.txt
│   └── images/             ← (optional) post images
│       └── my-cover.jpg
│
├── pages/
│   ├── home.txt            ← Homepage body content (below the hero)
│   └── about.txt           ← Static page content files
│
└── assets/
    ├── favicon.svg          ← SVG favicon, linked from every page's <head>
    └── images/
        ├── hero-[sitename].jpg   ← Homepage full-bleed background photo
        └── README.txt            ← Instructions for whoever adds photos later
```

---

## How Content Works

### Static pages (About, Contact, etc.)
Each page's content lives in a `.txt` file under `/pages/`.  
The HTML file contains zero content — it just calls the engine:
```javascript
PureLeaf.render('pages/about.txt', document.getElementById('page-content'));
```
To update the page → edit the `.txt` file. No HTML needed.

### Blog posts
Every article is a `.txt` file under `/posts/`.  
A **single `post.html` template** serves ALL articles.  
It reads `?slug=` from the URL, finds metadata in `posts.json`, fetches the matching `.txt` file, and renders it.

URL pattern: `post.html?slug=my-article-slug`

### Homepage content
The homepage body content can also live in a `.txt` file — specifically `pages/home.txt`.
This keeps the homepage editable without touching HTML, exactly like any other static page:

```javascript
PureLeaf.render('pages/home.txt', document.getElementById('home-content'));
```

This is separate from the hero section (which is hardcoded in HTML with stats and headlines).
`home.txt` holds the descriptive body content that appears *below* the hero.

### Pretty URLs
Blog links in the HTML (`blog.html` and `index.html`) point to clean paths like:
```
blog/my-article-slug
```
instead of `post.html?slug=my-article-slug`. Two config files at the site root translate
these clean paths back to the real `post.html?slug=` request, depending on host:

| File | Host | Notes |
|---|---|---|
| `htaccess.txt` | Apache / cPanel | Rename to `.htaccess` on upload — dotfiles can't be committed as-is in some tools/repos |
| `_redirects` | Netlify / Cloudflare Pages | Deploy as-is, no renaming needed |

Both also rewrite `/blog`, `/about`, and `/home` to their respective `.html` files.
If a host supports neither (e.g. a bare static file server with no rewrite engine), fall
back to linking directly to `post.html?slug=...` instead.

### ⚠️ Pretty URL slug bug — always use `getSlugFromPath()`
`htaccess.txt`'s rewrite rule (`RewriteRule ^blog/([a-z0-9-]+)/?$ post.html?slug=$1 [L,QSA]`)
only appends `?slug=...` to the **internal, server-side** request. The browser's address bar
— and therefore `window.location.search` — still shows the clean `blog/my-article-slug` URL,
with no query string at all. So `post.html` (or any per-item template like `service.html`)
calling `PureLeaf.getParam('slug')` returns `null` on any host using this rewrite rule, even
though the exact same code works fine when testing locally with `post.html?slug=...` directly.

Fix: `post.html` (and any similar single-item template) must read the slug from the visible
URL path first, falling back to the query string for local/no-rewrite testing:
```javascript
const slug = PureLeaf.getSlugFromPath('blog'); // reads /blog/my-slug/ → 'my-slug'
```
This is implemented as `PureLeaf.getSlugFromPath(prefix)` in `js/engine.js` — see the Engine
table below. Use this everywhere a single-item template reads its slug; `getParam('slug')`
alone is only safe for hosts with no rewrite rule at all.

### ⚠️ Relative paths break under pretty URLs — use root-relative (`/`) paths everywhere
This is the single most disruptive pretty-URL bug and easy to miss because **every page
looks and works fine when tested directly** (`post.html`, `index.html`, etc. all sit at the
site root, so relative paths like `css/main.css` resolve correctly). It only breaks once a
*pretty* URL adds a path segment: on `blog/my-article-slug`, the browser resolves any
relative path against `blog/my-article-slug/`, not against the site root — so `css/main.css`
actually requests `blog/my-article-slug/css/main.css`, which 404s. The symptom is a page
that loads with **no CSS, a broken logo/favicon, and content stuck on "Loading…"** (because
`js/engine.js` also 404s, `PureLeaf` is undefined, and the inline script throws before it
ever calls its loader function) — easy to mistake for a `.htaccess`/server problem when it's
actually a client-side path bug.

Fix: every `<link>`, `<script src>`, `<img src>`, in-page `<a href>`, `fetch()` call, and
`PureLeaf.render()`/`PureLeaf.fetchText()` call must use a **root-relative path — one that
starts with `/`** — not a bare relative path:
```html
<link rel="stylesheet" href="/css/main.css">
<script src="/js/engine.js"></script>
<img src="/assets/images/logo.png">
<a href="/about.html">About</a>
```
```javascript
fetch('/posts.json');
PureLeaf.render('/pages/home.txt', el);
await PureLeaf.render(`/posts/${slug}.txt`, content, { skipTitle: true });
```
This applies to **every page**, not just the single-item template — `index.html`,
`blog.html`, `about.html`, etc. all need it too, since any of them could theoretically be
linked to or tested from a nested path. Root-relative paths always resolve against the
domain root regardless of how deep the current URL is, so this is safe on every host
(cPanel with `.htaccess`, Netlify with `_redirects`, or no rewrite support at all).

### ⚠️ `.htaccess`/`_redirects` alone won't hide `.html` in the address bar
The rewrite rules only control what the *server* does with an incoming request — they have
no effect on what the browser displays, which is determined purely by the `href` actually
used to navigate there. If nav links still point to `/about.html`, the address bar will
keep showing `.html` even with a perfectly correct `.htaccess`, because nothing ever asked
the browser to go to `/about` in the first place. Once the rewrite rules exist, update every
in-page link to the extensionless path too:
```html
<a href="/about">About</a>      <!-- not href="/about.html" -->
<a href="/blog">Blog</a>        <!-- not href="/blog.html" -->
```
The homepage doesn't need this — `href="/"` already has no extension, and Apache/Netlify
both serve `index.html` for `/` by default.

---

## The TXT File Format

Plain text with a simple convention the engine understands:

```
Title of the Article (first line — used as H1, skipped in body)

This is a normal paragraph. Just write naturally.
Empty lines create paragraph breaks.

## This Becomes an H2 Heading

- This is a list item
- Another list item
- One more

[image: posts/images/my-photo.jpg | Caption text here]

Back to normal paragraph text.
```

### Supported syntax:
| Syntax | Renders as |
|---|---|
| First line | Page title (used by JS, not rendered in body) |
| `## Text` | `<h2>` heading |
| `- Text` | `<ul><li>` list item |
| `[image: url \| alt]` | `<figure>` with `<img>` and `<figcaption>` |
| Empty line | Paragraph break |
| Everything else | `<p>` paragraph |

---

## posts.json — The Blog Manifest

Every blog post needs one entry here. This is the only file you touch to "publish" a post.

```json
[
  {
    "slug": "my-article-slug",
    "title": "Full Article Title Here",
    "date": "2026-06-15",
    "category": "Marketing",
    "image": "posts/images/cover.jpg",
    "excerpt": "A short summary shown on the blog card. 1-2 sentences."
  }
]
```

### Fields:
| Field | Required | Notes |
|---|---|---|
| `slug` | ✅ | Must match the `.txt` filename exactly |
| `title` | ✅ | Shown in card, article header, browser tab |
| `date` | ✅ | ISO format: `YYYY-MM-DD` |
| `category` | ✅ | Short label shown above title |
| `excerpt` | ✅ | Shown on blog/homepage cards |
| `image` | ⬜ Optional | Cover image — shown on card AND as article hero |

---

## How to Publish a New Blog Post

**3 steps only:**

1. Create `/posts/your-slug.txt` and write content using the txt format above
2. Add one entry to `posts.json` with the matching slug
3. Upload both files to your server

Done. No code touched. No rebuild needed.

---

## Images — Two Ways

### 1. Cover image (card thumbnail + article hero)
Add `"image"` field to the post entry in `posts.json`:
```json
"image": "posts/images/seo-cover.jpg"
```
Shows automatically on the blog card AND as the wide hero image at the top of the article.

### 2. Inline image inside article
Add this line anywhere in the `.txt` file:
```
[image: posts/images/diagram.jpg | A description of what the image shows]
```
Renders as a styled `<figure>` block with a caption below.

### Image folder convention:
```
posts/images/        ← article images
pages/images/        ← static page images
assets/images/       ← global/shared images (logo, icons, etc.)
```

---

## The Engine (js/engine.js)

The core JS object `PureLeaf` exposes these methods:

| Method | What it does |
|---|---|
| `PureLeaf.render(txtPath, el, options)` | Fetches a .txt file and renders it into an element. `options.skipTitle` (default `true`) controls whether the first line is treated as a title and excluded from the body |
| `PureLeaf.fetchText(path)` | Raw fetch of any .txt file |
| `PureLeaf.parseContent(raw, skipTitle)` | Converts raw txt into structured tokens; `skipTitle` (default `true`) skips the first line |
| `PureLeaf.renderTokens(tokens)` | Converts tokens into HTML string |
| `PureLeaf.extractTitle(raw)` | Gets the first line (title) from a txt file |
| `PureLeaf.getParam(name)` | Reads a URL query parameter (used for `?slug=`) |
| `PureLeaf.getSlugFromPath(prefix)` | Reads a slug from a pretty URL path (e.g. `getSlugFromPath('blog')` on `/blog/my-slug/` → `'my-slug'`), falling back to `getParam('slug')`. **Use this, not `getParam` alone, in any single-item template** — see the Pretty URL slug bug note above |
| `PureLeaf.formatDate(isoDate)` | Formats `2026-06-15` → `June 15, 2026`. On multi-language sites, read `document.documentElement.lang` and map to a locale (`fa`→`fa-IR` for Jalali, `en`→`en-US`, `zh`→`zh-CN`) — see Multi-language Sites below |
| `PureLeaf.escape(str)` | HTML-escapes strings to prevent XSS |

Every call site in the current codebase still relies on the default `skipTitle: true`, so
this is a non-breaking option to keep in mind if a future page needs to render a title
back into the body (e.g. a page that has no separate `<h1>` in its HTML).

`PureLeaf.render()`'s loading and "not found" text also read `document.documentElement.lang`
(via small `PL_LOADING_TEXT`/`PL_NOTFOUND_TEXT` dictionaries at the top of `engine.js`) so a
single-language English site and a multi-language site both get correctly-localized loading
states with zero extra call-site code — see Multi-language Sites below.

`engine.js` also carries an MIT license header comment at the top of the file:
```javascript
/*
 * PureLeaf Engine
 * Copyright (c) 2026 MehrAfzar TD LTD
 * Licensed under the MIT License — see LICENSE for details.
 */
```

---

## CSS Architecture (css/main.css)

All styles live in one file. Key CSS custom properties (design tokens):

```css
:root {
  --bg           /* page background */
  --surface      /* card / element background */
  --surface2     /* secondary surface */
  --border       /* border color */
  --accent       /* primary accent color */
  --accent2      /* secondary accent */
  --text         /* primary text */
  --muted        /* secondary / faded text */
  --danger       /* error color */

  --font-display /* heading font (e.g. Playfair Display) */
  --font-body    /* body font (e.g. Inter) */

  --radius       /* border radius base unit */
  --max-w        /* narrow content column (760px) */
  --max-w-wide   /* wide layout (1100px) */
  --accent-glow    /* semi-transparent version of accent for glow effects (e.g. rgba(accent, 0.15)) */

  --article-p          /* body-copy color used in article/page/home content blocks */
  --nav-bg             /* translucent nav background (differs per theme, blurs content behind it) */
  --hero-overlay-top    /* top color stop of the hero gradient overlay */
  --hero-overlay-bottom /* bottom color stop of the hero gradient overlay */
  --icon-sun     /* 0 or 1 — opacity switch for the sun icon in the theme toggle */
  --icon-moon    /* 0 or 1 — opacity switch for the moon icon in the theme toggle */
}
```

### Light / Dark theme toggle
Every PureLeaf site now ships with a light/dark mode toggle, not just a single fixed
dark theme. This works entirely in CSS + a few lines of vanilla JS — no new dependency:

- The `:root` block holds the **dark** (default) token values.
- An `html.light { ... }` block overrides the subset of tokens that need to change for
  light mode (`--bg`, `--surface`, `--text`, `--muted`, overlay colors, icon opacities, etc.)
- A `.theme-toggle` button in the nav (sun/moon SVG icons, cross-faded via the
  `--icon-sun` / `--icon-moon` opacity variables) toggles the `light` class on `<html>`
  and persists the choice to `localStorage.setItem('theme', 'light' | 'dark')`.
- An inline anti-flash script in `<head>`, **before** `main.css` loads, applies the
  saved theme immediately so there's no flash of the wrong theme on page load:
  ```html
  <script>if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light');</script>
  ```
- The toggle-click handler (identical on every page) lives in a small inline `<script>`
  block near the bottom of the page, right after `js/engine.js` is loaded:
  ```javascript
  const toggle = document.getElementById('theme-toggle');
  toggle.addEventListener('click', () => {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });
  ```

When designing a new theme, pick dark-mode token values first (as before), then decide
the light-mode overrides for the same token names inside `html.light`.

### Key layout classes:
| Class | Purpose |
|---|---|
| `.nav` / `.nav-inner` | Sticky top navigation |
| `.hero` | Homepage hero section |
| `.posts-grid` | Blog card grid |
| `.post-card` | Individual blog card |
| `.article-header` | Article title/meta area |
| `.article-hero-wrap` | Hero image container |
| `.article-hero-image` | Hero image itself |
| `.article-body` | Article reading area |
| `.article-content` | Rendered txt content |
| `.article-figure` | Inline image block |
| `.page-header` / `.page-body` | Static page layout |
| `.loading` | Animated loading state |
| `.fade-in` | Fade-in animation |
| `.btn-primary` / `.btn-ghost` | Button styles |
| `.power-line` | Full-width glowing accent divider between sections (signature element) |
| `.stats-strip` / `.stats-strip-inner` | Full-width band of 4 key figures below the hero |
| `.stat-item-value` / `.stat-item-label` | Number + label pair inside the stats strip |
| `.hero-eyebrow` | Small uppercase label above the hero H1 |
| `.hero-stats` / `.hero-stat` | Inline stat group at the bottom of the hero |
| `.section` / `.section-header` / `.section-eyebrow`/ `.section-title`| Inline stat group at the bottom of the hero |
| `.theme-toggle` | Light/dark mode toggle button in the nav (sun/moon icon swap) |
| `.container` / `.container--narrow` | Generic max-width wrappers (`--max-w-wide` / `--max-w`) for content outside the hero |
| `.home-content-section` | Wraps the rendered `home.txt` body content below the hero on the homepage |
| `.blog-header` | Title/intro block at the top of `blog.html` |
| `.post-card-image` | Cover-image container inside a `.post-card`, with hover zoom on the `img` |
| `.back-link` | "← Back to Blog" link at the top of an article's body on `post.html` |



### Hero photo pattern
The homepage hero uses a layered technique to display a full-bleed background photo
with a dark gradient overlay so text remains readable:

```html
<section class="hero">
  <div class="hero-bg">
    <img src="assets/images/hero-solar.jpg" alt="...">
  </div>
  <div class="hero-content">
    <!-- text, stats, CTAs -->
  </div>
</section>
```

The `.hero-bg` is `position: absolute; inset: 0` with its `img` set to
`object-fit: cover`. A CSS `::after` pseudo-element on `.hero-bg` provides
the gradient fade from transparent at the top to ~92% dark at the bottom,
keeping foreground text always legible regardless of the photo.

Hero photo placement: `assets/images/hero-[sitename].jpg`
Recommended: 1920×1080px minimum, JPG optimised under 400KB.
Dark or silhouette-style photos work best with text overlay.

### Hero pattern without a photo
When the client has no usable photography yet (common for new B2B/trading sites), don't
reach for an unrelated stock photo — replace `.hero-bg`'s `img` with a CSS-only background
instead, keeping the same markup contract (`.hero-content` still sits on top, z-indexed above):
```css
.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse 900px 500px at 15% 20%, rgba(ACCENT, 0.35), transparent 60%),
    radial-gradient(ellipse 700px 500px at 85% 80%, rgba(ACCENT2, 0.22), transparent 60%),
    linear-gradient(160deg, #0c1a10 0%, #0a1310 55%, var(--bg) 100%);
}
.hero-bg::before {   /* faint dot-grid texture, reads as "network" not "empty" */
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px);
  background-size: 26px 26px;
  opacity: 0.5;
}
```
Keep the existing `.hero-bg::after` gradient-overlay rule too — it still adds depth on top
of the pattern. `.hero-content h1`/`p` colors can stay hardcoded light (they already assume
a dark backdrop), since this gradient is dark by design regardless of theme toggle. Swap to
a real photo later just by restoring the `<img>` and removing the CSS `background`.

### Placeholder photos when the client *does* want image slots filled
Different from the no-photo pattern above: sometimes the client wants every photo slot
(hero, page banners, product/service images) visibly filled now, to be replaced with real
photography later, rather than left as a CSS gradient. In that case use
[Lorem Picsum](https://picsum.photos) — free, no API key, stable URLs, works purely as a
client-side `<img src>` with no build step:
```html
<img src="https://picsum.photos/seed/SITENAME-hero/1920/1080" alt="...">
```
Give every slot a distinct `seed` (`sitename-hero`, `sitename-about`, `sitename-svc-X`) so
photos differ across the site. These are random stock photos with **no topical relevance**
— document this clearly for the client (e.g. an `assets/images/README.txt` listing every
placeholder's location and the exact `src`/`image` field to edit) so it's obvious they're
temporary and where to swap each one.

---

## Important CSS Rules (Learned from Debug)

These must always be present to avoid layout bugs:

```css
/* Hero image — must have these to render full width */
.article-hero-wrap {
  width: 100%;
  max-width: var(--max-w);   /* caps the hero to the reading column, not the full viewport */
  margin: 0 auto;
  box-sizing: border-box;
}

.article-hero-image {
  width: 100%;
  aspect-ratio: 16 / 7;       /* fixed ratio avoids layout shift while the image loads */
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--surface); /* placeholder color visible before the image paints */
}

.article-hero-image:empty { display: none; }  /* posts with no cover image collapse cleanly */

.article-hero-image img {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;  /* defeats the global img reset */
  object-fit: cover;
}
```

The global `img { max-width: 100%; }` reset fights the hero image width.  
The `!important` overrides are intentional and required.

Note this differs from the article's inline hero *background* photo (the homepage
`.hero-bg` pattern below) — `.article-hero-wrap`/`.article-hero-image` is specifically
the per-post cover image shown at the top of `post.html`.

### ⚠️ Don't forget the post-card thumbnail markup
`css/main.css` ships `.post-card-image` styling (rounded thumbnail, hover zoom) expecting
each post card to include a thumbnail block when `post.image` is set — but this is JS you
write per-site (in `blog.html`'s and `index.html`'s card-rendering template), not something
`engine.js` provides automatically. It's easy to build a post-card template that renders
category/title/excerpt/date and forget the image block entirely, since the page still looks
fine without it — just check every `posts.json` image never actually appears on any card.
Always include it conditionally:
```javascript
${post.image ? `<div class="post-card-image"><img src="${PureLeaf.escape(post.image)}" alt="${PureLeaf.escape(post.title)}" loading="lazy"></div>` : ''}
```

---

## RTL & Farsi Sites (Learned from Debug)

Established across the HSI (هماهنگ سامان ایرانیان) and Rohani (بازرگانی روحانی) builds.
Apply all of these together whenever a site is Farsi/Arabic or otherwise RTL — they're
cheap to add up front and easy to miss individually during review. **If the site also needs
a second, LTR language (see Multi-language Sites below), don't hardcode direction as done
here — use the dynamic version described there instead; this section is for RTL-only sites.**

**HTML**
```html
<html lang="fa" dir="rtl">
```
Set on every page, not just the homepage.

**Font**
Swap the Google Fonts import to Vazirmatn (or another RTL-native family) for *both*
`--font-display` and `--font-body` — don't keep a Latin display font for headings on an
otherwise-Farsi page:
```css
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap');
--font-display: 'Vazirmatn', Tahoma, sans-serif;
--font-body:    'Vazirmatn', Tahoma, sans-serif;
```

**⚠️ Negative letter-spacing breaks Persian letter joining**
The base PureLeaf stylesheet uses small negative `letter-spacing` values on several
headings/labels for a tighter Latin look. On Arabic-script text this visibly breaks glyph
joining (letters that should connect render disconnected). Rather than hunting down every
individual rule, neutralize it globally at the end of the stylesheet:
```css
* { letter-spacing: normal !important; }
```
This is harmless for Latin/Chinese text too, so it's safe to apply even on a multi-language
site — no need to scope it to `[lang="fa"]`.

**Mirror direction-sensitive decorative elements — or better, use logical properties**
The stylesheet is mostly symmetric/centered, but a couple of rules assume LTR:
- `.article-body::before` (the signature reading-line accent) — assumes `left: 0`
- `.page-content ul` / `.article-content ul,ol` — the indent margin assumes `margin-left`

For an RTL-only site, flip these once (`right: 0`; `margin: 1rem 1.5rem 1.35rem 0;`). But
prefer the **logical-property** version from the start — `inset-inline-start: 0` and
`margin-inline: 1.5rem 0;` — since it auto-flips with `dir` and costs nothing extra even on
a site that will only ever be RTL. See Multi-language Sites below for why this matters once
a second, LTR language is added later. Always grep the stylesheet for `left`/`right`/
`margin-left`/`padding-left` etc. before shipping — the two rules above reflect what's
needed today, not a guarantee against new physical-direction rules added later.

**Dates**
Use the `fa-IR` locale (renders the Jalali/Persian calendar) instead of `en-US` in
`PureLeaf.formatDate`:
```javascript
formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
}
```

**Phone numbers and other LTR fragments inside RTL text**
Wrap them so they don't visually reverse or reorder mid-line:
```html
<a href="tel:+98..." dir="ltr">۰۹۱۲۱۲۴۹۲۸۸</a>
```
Put `dir="ltr"` on the specific inline element carrying the digits, not on the surrounding
block — that keeps the block's own text-alignment following the page's natural direction
(important once a second language is involved; see below) while only the digits stay
unmirrored.

**Nav/footer brand mark**
When the client has a real logo (not just a wordmark), prefer an `<img>` in `.nav-logo`
over a styled text lockup — added `.nav-logo-mark` / `.footer-brand` classes for this.

---

## Multi-language (i18n) Sites

Established on the Rohani build (بازرگانی روحانی), which added English and Chinese
alongside Farsi with a switcher, no page reload. This section supersedes the "mirror
direction-sensitive elements" advice above with the dynamic equivalent — read this instead
of that if the site supports more than one direction.

### Content: one file per language, not one page per language
Keep a single set of HTML pages. Every content file gets a language suffix instead:
```
pages/home.fa.txt   pages/home.en.txt   pages/home.zh.txt
pages/about.fa.txt  pages/about.en.txt  pages/about.zh.txt
posts.fa.json       posts.en.json       posts.zh.json
posts/my-slug.fa.txt   posts/my-slug.en.txt   posts/my-slug.zh.txt
```
Each language's `posts.json` uses the **same slugs, dates, and `image` fields** — only
`title`/`category`/`excerpt` (and the linked `.txt` body) are translated — so a single-item
template doesn't need a language-specific URL; it just fetches the matching-language file
for whatever slug is already in the URL.

### `js/i18n.js` — a new, site-specific companion file
Unlike `engine.js` (generic, copy as-is), `i18n.js` holds the actual translated UI strings,
so it's written fresh per site. Its shape is reusable though:
```javascript
const LANG_META = { fa: { dir: 'rtl' }, en: { dir: 'ltr' }, zh: { dir: 'ltr' } };
const I18N = {
  fa: { nav_home: 'خانه', /* ...every static UI string... */ },
  en: { nav_home: 'Home', /* ... */ },
  zh: { nav_home: '首页', /* ... */ }
};

function getLang() { return localStorage.getItem('lang') || 'fa'; }

function applyStaticI18n(lang) {
  const dict = I18N[lang] || I18N.fa;
  document.documentElement.lang = lang;
  document.documentElement.dir = (LANG_META[lang] || LANG_META.fa).dir;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {   // for strings needing <em>/<br>
    const key = el.getAttribute('data-i18n-html');
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
}

function setLang(lang) {
  if (!I18N[lang]) return;
  localStorage.setItem('lang', lang);
  applyStaticI18n(lang);
  window.dispatchEvent(new CustomEvent('pl:langchange', { detail: { lang } }));
}
```
Every static UI string in the HTML (nav labels, buttons, hero copy, footer, contact labels)
gets a `data-i18n="key"` attribute instead of hardcoded text. Any string needing inline
markup (e.g. a hero `<h1>` with an `<em>` for accent color) uses `data-i18n-html` instead,
which sets `innerHTML` rather than `textContent`.

### Dynamic content reloads on language change
Each page's own inline script fetches its language-specific content on load, and again
whenever the switcher fires:
```javascript
function loadPosts(lang) { fetch(`/posts.${lang}.json`).then(...); }
loadPosts(getLang());
window.addEventListener('pl:langchange', (e) => loadPosts(e.detail.lang));
```
This is also where `PureLeaf.render()` calls pick up the right file:
`PureLeaf.render(`/pages/home.${lang}.txt`, el)`.

### Anti-flash script covers language + direction too, not just theme
The existing `<head>` anti-flash script (dark/light theme, see below) must also set `lang`
and `dir` before first paint, or the page flashes the wrong direction on load:
```html
<script>
(function () {
  if (localStorage.getItem('theme') === 'light') document.documentElement.classList.add('light');
  var lang = localStorage.getItem('lang') || 'fa';
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'fa') ? 'rtl' : 'ltr';
})();
</script>
```

### ⚠️ Direction must be dynamic, not hardcoded — use logical CSS properties
The RTL section above says to hardcode `html { direction: rtl; }` and to manually mirror a
couple of physical-direction rules. That's correct for an RTL-*only* site, but breaks the
moment English/Chinese needs to render LTR from the same stylesheet: the hardcoded rule
would force RTL on every language, and a rule manually mirrored for RTL would now be
mirrored *wrong* for LTR. Fix both by switching to logical properties, which auto-flip with
whatever `dir` JS sets on `<html>`, so one stylesheet serves every direction with no
duplication:
```css
/* Don't: */
html { direction: rtl; }
.article-body::before { right: 0; }
.page-content ul { margin: 1rem 1.5rem 1.35rem 0; }

/* Do: */
/* (no hardcoded html direction rule at all — dir attribute drives it) */
.article-body::before { inset-inline-start: 0; }
.page-content ul { margin-block: 1rem 1.35rem; margin-inline: 1.5rem 0; }
```
Also drop any hardcoded `text-align: right` used to align an RTL-specific value (e.g. a
contact phone number) — let it inherit the page's natural start-alignment instead, and keep
only `dir="ltr"` on the inline element carrying the actual digits (see the RTL section
above). A hardcoded `text-align` fixed for RTL will misalign the same element once the page
renders LTR.

### Fonts per language
```css
html[lang="en"] { --font-display: 'Inter', system-ui, sans-serif; --font-body: 'Inter', system-ui, sans-serif; }
html[lang="zh"] { --font-display: 'Noto Sans SC', 'PingFang SC', sans-serif; --font-body: 'Noto Sans SC', 'PingFang SC', sans-serif; }
```
Default (no override) stays whatever the site's primary language font is. Import all needed
font families in one `@import` line rather than one per language.

### `engine.js` is already language-aware
`PureLeaf.render()`'s loading/error text and `PureLeaf.formatDate()` both read
`document.documentElement.lang` — see the Engine table above. No call-site changes needed;
just make sure `<html lang="...">` is being set correctly (via the anti-flash script and
`applyStaticI18n`).

### Translation quality
Draft translations (including Chinese) can be produced directly, but flag to the client that
business-critical copy — pricing terms, product specifications, legal/contact info — should
get a native-speaker or professional review pass before going live, especially for Chinese.

---

## Mobile Navigation

The base template has no mobile nav collapse — on narrow screens the full `.nav-links` list
just stays inline and wraps or overflows. Add a hamburger toggle:
```html
<button class="nav-hamburger" id="nav-hamburger" aria-label="Open menu">
  <span></span><span></span><span></span>
</button>
```
```css
.nav-hamburger { display: none; flex-direction: column; justify-content: center; align-items: center; gap: 5px; width: 34px; height: 34px; background: transparent; border: none; cursor: pointer; }
.nav-hamburger span { display: block; width: 20px; height: 2px; background: var(--text); border-radius: 2px; transition: transform 0.25s ease, opacity 0.2s ease; }
.nav-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.nav-hamburger.open span:nth-child(2) { opacity: 0; }
.nav-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

@media (max-width: 760px) {
  .nav-hamburger { display: flex; }
  .nav-links {
    position: fixed; top: 60px; inset-inline: 0; z-index: 99;
    flex-direction: column; gap: 0;
    background: var(--surface); border-bottom: 1px solid var(--border);
    max-height: 0; overflow: hidden; opacity: 0; padding: 0 2rem;
    transition: max-height 0.3s ease, opacity 0.25s ease, padding 0.3s ease;
  }
  .nav-links.open { max-height: 320px; opacity: 1; padding: 0.5rem 2rem 1rem; }
  .nav-links a { display: block; width: 100%; padding: 0.9rem 0; border-bottom: 1px solid var(--border); }
}
```
```javascript
const hamburger = document.getElementById('nav-hamburger');
const navLinks = document.getElementById('nav-links');
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  hamburger.classList.remove('open');
  navLinks.classList.remove('open');
}));
```
Use `position: fixed` (not `absolute`) for the dropdown panel — it sidesteps containing-block
issues with the sticky nav bar and reliably spans the full viewport width regardless of
ancestor positioning. `inset-inline: 0` (not `left/right: 0`) keeps this correct under RTL
too. If the site also has the language switcher above, this logic can live in the same
shared script (e.g. inside `i18n.js`'s auto-init) since both are present in every page's nav.

---

## SEO Notes

- Each page has a `<title>` and `<meta name="description">` set statically in HTML
- On `post.html`, the `<title>` is updated dynamically by JS: `document.title = post.title`
- Google crawls JS-rendered content — the fetch-based approach works fine for SEO
- For best results, keep `posts.json` excerpts well-written (they can be used as meta descriptions)
- All URLs are clean and descriptive. With `htaccess.txt`/`_redirects` deployed, the
  public-facing URL is `blog/seo-basics-for-beginners`; the underlying request is still
  `post.html?slug=seo-basics-for-beginners` on hosts without rewrite support

---

## Hosting Requirements

- **Any static host** works: cPanel, Netlify, GitHub Pages, Cloudflare Pages
- Must be served over HTTP/HTTPS — `fetch()` does NOT work when opening HTML files directly from the filesystem (`file://`)
- HTTPS recommended (free via Let's Encrypt on most hosts) — improves SEO and trust

### ⚠️ `Options -Indexes` in `.htaccess` causes 500 errors on many cPanel hosts
Many shared cPanel hosts restrict `AllowOverride` so that the `Options` directive can't be
changed from `.htaccess` at all (must be set in the server's main config). When that's the
case, **any** `.htaccess` containing `Options -Indexes` — even alongside otherwise-correct
rewrite rules — causes an Internal Server Error for the whole file, not just that line. This
is a very common real-world cause of "the `.htaccess` you gave me breaks the site," and easy
to misdiagnose as a rewrite-rule problem. `htaccess.txt` should not include `Options
-Indexes`; directory-listing prevention isn't essential (most hosts disable it by default
anyway) and isn't worth the risk. If a host's error log confirms `Options` actually is
allowed there, it can be added back for that specific deployment — just don't ship it by
default.

---

## Licensing & Attribution

- PureLeaf itself (the engine, spec, and boilerplate) is released under the **MIT License**.
  A `LICENSE` file belongs at the root of every PureLeaf-based repo, and `js/engine.js`
  carries a short MIT header comment.
- Every HTML page includes `<meta name="generator" content="PureLeaf">` in the `<head>`.
  This is a standard convention (the same one WordPress/Squarespace/etc. use) that lets
  tools like Wappalyzer identify a site as PureLeaf-built without any tracking or
  phone-home behavior — it's just a static meta tag.
- Client sites built *on top of* PureLeaf (e.g. a specific business's website) are
  separate works from the platform itself — the MIT license covers the reusable
  engine/boilerplate, not necessarily a given client's content or branding. Confirm
  copyright attribution per project.

---

## Instructions for Claude: Building a New PureLeaf Site

When Hassan gives you this document and asks for a new website, here is what to do:

### Step 1 — Clarify the design brief
Ask for (or infer from context):
- **Site name and topic** (e.g. "fitness blog", "law firm", "tech tutorials")
- **Language(s) & direction** — single language (LTR by default) vs. RTL (Farsi/Arabic) vs.
  multi-language with a switcher. See "RTL & Farsi Sites" and "Multi-language (i18n) Sites"
  below — apply the relevant pattern as a full set, not piecemeal
- **Color palette preference** (dark/light/colorful, or a specific accent color)
- **Font mood** (editorial/serif, clean/modern, bold/display)
- **Number of pages** (homepage, blog, about — or more?)
- **Sample content topics** for the 3 starter blog posts

### Step 2 — Design the theme
Choose:
- CSS token values (`--bg`, `--accent`, `--font-display`, etc.)
- Google Fonts pairing (display + body)
- Signature visual element (the original PureLeaf used a left reading-line gradient)

### Step 3 — Build in this order
1. `posts.json` — 3 sample posts with slugs, titles, dates, categories, excerpts, images
2. `posts/*.txt` — content for all 3 posts using the txt format
2b. `pages/home.txt` — homepage body content (descriptive text below the hero)
3. `pages/about.txt` — about page content
4. `css/main.css` — full stylesheet with new theme tokens, including `html.light` overrides
5. `js/engine.js` — copy engine as-is (no changes needed unless adding features)
6. `index.html` — homepage
7. `blog.html` — blog index
8. `post.html` — single post template (use `PureLeaf.getSlugFromPath('blog')`, not `getParam`
   alone — see Pretty URL slug bug above)
9. `about.html` — about page
9b. If multi-language: `js/i18n.js` (dictionary + switcher — see Multi-language Sites above),
    plus a `.{lang}.txt`/`.{lang}.json` file per language for every content file from steps
    1–3, and `data-i18n`/`data-i18n-html` attributes on every static string in steps 6–9
10. `assets/favicon.svg` — themed favicon (reuse an existing one, or design a new SVG mark
    matching the site's accent color)
11. `htaccess.txt` and `_redirects` — pretty-URL rules (copy as-is, no per-site changes needed)
12. `LICENSE` — MIT license file
13. Package as `.zip` and deliver

### Step 4 — Always include
- Sticky nav with active link highlighting
- **Mobile hamburger menu** on every page (see Mobile Navigation above) — the base template
  has no nav collapse, so this needs adding every time, not just responsive font/spacing tweaks
- Responsive mobile layout
- Loading states for all async content
- `fade-in` animation on content load
- Footer with site name
- The hero image CSS fix (`!important` overrides) — always include this
- Light/dark theme toggle (`.theme-toggle` button + `html.light` CSS overrides + the
  anti-flash inline script in `<head>`) — include on every page, not just the homepage
- **Every `<link>`/`<script src>`/`<img src>`/`<a href>`/`fetch()`/`PureLeaf.render()` path
  starts with `/`** (root-relative) — not a bare relative path. See the "Relative paths
  break under pretty URLs" note above; this bites every single-item template otherwise.
  Once `.htaccess`/`_redirects` define pretty routes for a page, nav/internal links to it
  should use the extensionless path too (`/about`, not `/about.html`) — the rewrite rule
  doesn't change what's in the address bar, only the `href` does
- `assets/favicon.svg` linked via `<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">`
- `<meta name="generator" content="PureLeaf">` in every page's `<head>` — lets tech-detection
  tools like Wappalyzer identify the platform
- `htaccess.txt` and `_redirects` at the site root for pretty blog URLs (`/blog/slug`
  instead of `post.html?slug=slug`) — deliver both regardless of which host the client
  ends up on, since renaming is a one-line fix but a missing file isn't; make sure
  `htaccess.txt` does **not** include `Options -Indexes` (see below)
- `LICENSE` file (MIT) at the site root

---

## What Can Be Extended Later

| Feature | How |
|---|---|
| Search | JS that filters `posts.json` by keyword |
| Tags/categories | Filter `posts.json` by `category` field |
| Reading time | Count words in txt, estimate at 200wpm |
| RSS feed | A static `feed.xml` updated manually |
| Contact form | Use Formspree or similar (no backend needed) |
| Comments | Embed Disqus or Utterances (GitHub-based) |
| Analytics | Drop in Plausible or Google Analytics script |
| New page types | Add HTML + matching txt file in `/pages/` |

---

*PureLeaf — No backend. No database. Just files.*
