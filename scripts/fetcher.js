const fetch = require('node-fetch');
const cheerio = require('cheerio');

const FETCH_OPTIONS = {
  headers: {
    'User-Agent': 'AnthropicNewsBot/1.0 (news portal aggregator)'
  },
  timeout: 15000
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchArticle(url) {
  const res = await fetch(url, FETCH_OPTIONS);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Extract metadata from meta tags
  const title = $('meta[property="og:title"]').attr('content')
    || $('h1').first().text().trim()
    || '';
  let description = $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || '';
  // Date: try multiple sources
  let date = '';
  const fullHtml = $.html();

  // 1. Sanity/Next.js _createdAt (Anthropic uses Sanity CMS)
  if (!date) {
    const createdAtMatch = fullHtml.match(/_createdAt[^0-9]*(\d{4}-\d{2}-\d{2})/);
    if (createdAtMatch) date = createdAtMatch[1];
  }

  // 2. JSON-LD structured data
  if (!date) {
    $('script[type="application/ld+json"]').each(function() {
      if (date) return;
      try {
        const json = JSON.parse($(this).html());
        const d = json.datePublished || json.dateCreated;
        if (d) date = d;
      } catch {}
    });
  }

  // 3. Meta tags
  if (!date) {
    date = $('meta[property="article:published_time"]').attr('content')
      || $('meta[name="publish-date"]').attr('content')
      || $('meta[name="date"]').attr('content')
      || '';
  }

  // 4. Time element
  if (!date) {
    date = $('time').attr('datetime')
      || $('time').first().text().trim()
      || '';
  }

  // 5. Month-name date pattern in first 5000 chars
  if (!date) {
    const headText = fullHtml.substring(0, 5000);
    const dateMatch = headText.match(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i)
      || headText.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i);
    if (dateMatch) date = dateMatch[1];
  }

  // Normalize to ISO date
  if (date && !date.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      date = parsed.toISOString().split('T')[0];
    }
  }

  const image = $('meta[property="og:image"]').attr('content') || '';

  // Extract main content
  let contentHtml = '';
  const articleEl = $('article').first();
  if (articleEl.length) {
    contentHtml = articleEl.html();
  } else {
    // Fallback: try main content area
    const mainEl = $('main').first();
    if (mainEl.length) {
      contentHtml = mainEl.html();
    }
  }

  // Clean content: convert to plain text paragraphs
  const contentText = htmlToPlainText($, contentHtml);

  // Generate summary from first 300 chars of content
  const summary = contentText.substring(0, 300).replace(/\s+/g, ' ').trim();

  // Fix generic boilerplate description — extract from content if needed
  const genericPhrases = [
    'AI safety and research company',
    'working to build reliable',
    'Anthropic is an AI safety'
  ];
  const isGeneric = genericPhrases.some(p => description.includes(p));
  if (isGeneric && contentText) {
    // Try "Summary:" prefix first
    const summaryMatch = contentText.match(/Summary:\s*(.+?)(?:\n|$)/);
    if (summaryMatch && summaryMatch[1].length > 20) {
      description = summaryMatch[1].trim();
    } else {
      // Fallback: first meaningful sentence from content
      const firstSentence = contentText.replace(/\s+/g, ' ').match(/^[^.!?]+[.!?]/);
      if (firstSentence && firstSentence[0].length > 20) {
        description = firstSentence[0].trim();
      }
    }
  }

  return {
    id: url.split('/').filter(Boolean).pop() || url,
    url,
    title: title.trim(),
    description: description.trim(),
    summary,
    contentHtml,
    contentText,
    date,
    image,
    scrapedAt: new Date().toISOString()
  };
}

function htmlToPlainText($, html) {
  if (!html) return '';
  const $content = $('<div>').html(html);
  // Remove scripts, styles, nav
  $content.find('script, style, nav, header, footer, .share, .social').remove();
  // Convert block elements to paragraphs
  let text = $content.text();
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await fetchArticle(url);
      if (i > 0) await sleep(1000);
      return result;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`  Retry ${i + 1} for ${url}`);
      await sleep(2000);
    }
  }
}

module.exports = { fetchArticle: fetchWithRetry, sleep };
