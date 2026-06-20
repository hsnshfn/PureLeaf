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
│   └── about.txt           ← Static page content files
│
└── assets/
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
| `PureLeaf.render(txtPath, el)` | Fetches a .txt file and renders it into an element |
| `PureLeaf.fetchText(path)` | Raw fetch of any .txt file |
| `PureLeaf.parseContent(raw)` | Converts raw txt into structured tokens |
| `PureLeaf.renderTokens(tokens)` | Converts tokens into HTML string |
| `PureLeaf.extractTitle(raw)` | Gets the first line (title) from a txt file |
| `PureLeaf.getParam(name)` | Reads a URL query parameter (used for `?slug=`) |
| `PureLeaf.formatDate(isoDate)` | Formats `2026-06-15` → `June 15, 2026` |
| `PureLeaf.escape(str)` | HTML-escapes strings to prevent XSS |

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
}
```

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
---

## Important CSS Rules (Learned from Debug)

These must always be present to avoid layout bugs:

```css
/* Hero image — must have these to render full width */
.article-hero-wrap {
  width: 100%;
  box-sizing: border-box;
}

.article-hero-image img {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;  /* defeats the global img reset */
  object-fit: cover;
}
```

The global `img { max-width: 100%; }` reset fights the hero image width.  
The `!important` overrides are intentional and required.

---

## SEO Notes

- Each page has a `<title>` and `<meta name="description">` set statically in HTML
- On `post.html`, the `<title>` is updated dynamically by JS: `document.title = post.title`
- Google crawls JS-rendered content — the fetch-based approach works fine for SEO
- For best results, keep `posts.json` excerpts well-written (they can be used as meta descriptions)
- All URLs are clean and descriptive: `post.html?slug=seo-basics-for-beginners`

---

## Hosting Requirements

- **Any static host** works: cPanel, Netlify, GitHub Pages, Cloudflare Pages
- Must be served over HTTP/HTTPS — `fetch()` does NOT work when opening HTML files directly from the filesystem (`file://`)
- HTTPS recommended (free via Let's Encrypt on most hosts) — improves SEO and trust

---

## Instructions for Claude: Building a New PureLeaf Site

When Hassan gives you this document and asks for a new website, here is what to do:

### Step 1 — Clarify the design brief
Ask for (or infer from context):
- **Site name and topic** (e.g. "fitness blog", "law firm", "tech tutorials")
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
4. `css/main.css` — full stylesheet with new theme tokens
5. `js/engine.js` — copy engine as-is (no changes needed unless adding features)
6. `index.html` — homepage
7. `blog.html` — blog index
8. `post.html` — single post template
9. `about.html` — about page
10. Package as `.zip` and deliver

### Step 4 — Always include
- Sticky nav with active link highlighting
- Responsive mobile layout
- Loading states for all async content
- `fade-in` animation on content load
- Footer with site name
- The hero image CSS fix (`!important` overrides) — always include this

---

## What Can Be Extended Later

| Feature | How |
|---|---|
| Search | JS that filters `posts.json` by keyword |
| Tags/categories | Filter `posts.json` by `category` field |
| Reading time | Count words in txt, estimate at 200wpm |
| Dark/light toggle | Toggle a CSS class on `<body>` |
| RSS feed | A static `feed.xml` updated manually |
| Contact form | Use Formspree or similar (no backend needed) |
| Comments | Embed Disqus or Utterances (GitHub-based) |
| Analytics | Drop in Plausible or Google Analytics script |
| New page types | Add HTML + matching txt file in `/pages/` |

---

*PureLeaf — No backend. No database. Just files.*
