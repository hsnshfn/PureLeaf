/**
 * PureLeaf Engine
 * ───────────────
 * Reads .txt files and renders them as structured HTML.
 * Parses plain text using simple conventions:
 *   - First line = page title (skipped in body, used as H1 externally)
 *   - Lines starting with ## = H2 headings
 *   - Lines starting with - = list items (groups into <ul>)
 *   - Empty line = paragraph break
 *   - Everything else = paragraph text
 */

const PureLeaf = {

  /**
   * Fetch a .txt file and return its raw text.
   */
  async fetchText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Could not load: ${path}`);
    return res.text();
  },

  /**
   * Parse raw txt content into an array of tokens.
   * Token types: heading | list | paragraph
   */
  parseContent(raw, skipTitle = true) {
    const lines = raw.split('\n').map(l => l.trimEnd());
    const tokens = [];
    let i = skipTitle ? 1 : 0; // skip first line (title) if needed
    let listBuffer = [];

    const flushList = () => {
      if (listBuffer.length > 0) {
        tokens.push({ type: 'list', items: [...listBuffer] });
        listBuffer = [];
      }
    };

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('[image:') && line.endsWith(']')) {
        // Syntax: [image: url | alt text]
        flushList();
        const inner = line.slice(7, -1).trim(); // strip "[image:" and "]"
        const [src, alt] = inner.split('|').map(s => s.trim());
        tokens.push({ type: 'image', src, alt: alt || '' });
      } else if (line.startsWith('## ')) {
        flushList();
        tokens.push({ type: 'heading', text: line.slice(3) });
      } else if (line.startsWith('- ')) {
        tokens.push({ type: 'listitem', text: line.slice(2) });
        listBuffer.push(line.slice(2));
        // peek — if next line is not also a list item, flush
        if (!lines[i + 1] || !lines[i + 1].startsWith('- ')) {
          flushList();
        }
      } else if (line.trim() === '') {
        flushList();
      } else {
        flushList();
        tokens.push({ type: 'paragraph', text: line });
      }
      i++;
    }
    flushList();
    return tokens.filter(t => t.type !== 'listitem');
  },

  /**
   * Render tokens into HTML string.
   */
  renderTokens(tokens) {
    return tokens.map(t => {
      if (t.type === 'image')     return `<figure class="article-figure"><img src="${this.escape(t.src)}" alt="${this.escape(t.alt)}" loading="lazy"><figcaption>${this.escape(t.alt)}</figcaption></figure>`;
      if (t.type === 'heading')   return `<h2>${this.escape(t.text)}</h2>`;
      if (t.type === 'paragraph') return `<p>${this.escape(t.text)}</p>`;
      if (t.type === 'list') {
        const items = t.items.map(item => `<li>${this.escape(item)}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return '';
    }).join('\n');
  },

  /**
   * Extract title (first non-empty line) from txt.
   */
  extractTitle(raw) {
    const lines = raw.split('\n');
    return lines.find(l => l.trim() !== '')?.trim() || 'Untitled';
  },

  /**
   * Full pipeline: fetch → parse → render into a target element.
   */
  async render(txtPath, targetEl, options = {}) {
    const { skipTitle = true } = options;
    targetEl.innerHTML = '<div class="loading">Loading content…</div>';
    try {
      const raw = await this.fetchText(txtPath);
      const tokens = this.parseContent(raw, skipTitle);
      targetEl.innerHTML = this.renderTokens(tokens);
      targetEl.classList.add('fade-in');
    } catch (err) {
      targetEl.innerHTML = `<p style="color:var(--danger)">Content not found.</p>`;
      console.error(err);
    }
  },

  /**
   * Simple HTML escape to prevent XSS.
   */
  escape(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /**
   * Read ?slug=xxx from the current URL.
   */
  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  /**
   * Format an ISO date string to a readable format.
   */
  formatDate(isoDate) {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
};
