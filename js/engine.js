/*
 * PureLeaf Engine
 * Copyright (c) 2026 MehrAfzar TD LTD
 * Licensed under the MIT License — see LICENSE for details.
 */
const PL_LOADING_TEXT = { fa: 'در حال بارگذاری…', en: 'Loading…', zh: '加载中…' };
const PL_NOTFOUND_TEXT = { fa: 'محتوا یافت نشد.', en: 'Content not found.', zh: '未找到内容。' };

const PureLeaf = {
  async fetchText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Could not load: ${path}`);
    return res.text();
  },
  parseContent(raw, skipTitle = true) {
    const lines = raw.split('\n').map(l => l.trimEnd());
    const tokens = [];
    let i = skipTitle ? 1 : 0;
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
        flushList();
        const inner = line.slice(7, -1).trim();
        const [src, alt] = inner.split('|').map(s => s.trim());
        tokens.push({ type: 'image', src, alt: alt || '' });
      } else if (line.startsWith('## ')) {
        flushList();
        tokens.push({ type: 'heading', text: line.slice(3) });
      } else if (line.startsWith('- ')) {
        listBuffer.push(line.slice(2));
        if (!lines[i + 1] || !lines[i + 1].startsWith('- ')) flushList();
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
  extractTitle(raw) {
    return raw.split('\n').find(l => l.trim() !== '')?.trim() || 'Untitled';
  },
  async render(txtPath, targetEl, options = {}) {
    const { skipTitle = true } = options;
    const lang = document.documentElement.lang || 'en';
    targetEl.innerHTML = `<div class="loading">${PL_LOADING_TEXT[lang] || PL_LOADING_TEXT.en}</div>`;
    try {
      const raw = await this.fetchText(txtPath);
      const tokens = this.parseContent(raw, skipTitle);
      targetEl.innerHTML = this.renderTokens(tokens);
      targetEl.classList.add('fade-in');
    } catch (err) {
      targetEl.innerHTML = `<p style="color:var(--danger)">${PL_NOTFOUND_TEXT[lang] || PL_NOTFOUND_TEXT.en}</p>`;
      console.error(err);
    }
  },
  escape(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },
  // Reads a slug from a pretty URL path like /blog/my-slug/ — needed because
  // Apache/Netlify's rewrite rule (post.html?slug=$1) only rewrites the
  // internal, server-side request; the browser's visible URL — and therefore
  // window.location.search — stays the clean pretty path with no query
  // string. Falls back to ?slug= for local/no-rewrite testing.
  getSlugFromPath(prefix) {
    const path = window.location.pathname;
    const regex = new RegExp(`${prefix}/([^/]+?)/?$`);
    const match = path.match(regex);
    if (match && match[1]) return decodeURIComponent(match[1]);
    return this.getParam('slug');
  },
  formatDate(isoDate) {
    const lang = document.documentElement.lang || 'en';
    const locales = { fa: 'fa-IR', en: 'en-US', zh: 'zh-CN' };
    return new Date(isoDate).toLocaleDateString(locales[lang] || 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
};
