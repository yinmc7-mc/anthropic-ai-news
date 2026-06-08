const fetch = require('node-fetch');
const xml2js = require('xml2js');

const SITEMAP_URL = 'https://www.anthropic.com/sitemap.xml';
const ARTICLE_PATTERNS = [/\/news\//, /\/research\//, /\/institute\//];

function classifyUrl(url) {
  if (url.includes('/news/')) return 'blog';
  if (url.includes('/research/')) return 'research';
  if (url.includes('/institute/')) return 'institute';
  return null;
}

async function parseSitemap() {
  const res = await fetch(SITEMAP_URL);
  const xml = await res.text();
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xml);

  const entries = result.urlset.url
    .map(entry => ({
      url: entry.loc[0],
      lastmod: entry.lastmod ? entry.lastmod[0] : null,
      type: classifyUrl(entry.loc[0])
    }))
    .filter(e => e.type !== null);

  return entries;
}

module.exports = { parseSitemap };
