const fs = require('fs');
const path = require('path');
const { parseSitemap } = require('./sitemap');
const { fetchArticle, sleep } = require('./fetcher');
const { translateArticle } = require('./translate');

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');
const CONCURRENCY = 1;
const MAX_NEW_PER_TYPE = 10;

function loadExisting(type) {
  const file = path.join(DATA_DIR, `${type}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { lastUpdated: null, articles: [] };
  }
}

function saveData(type, data) {
  const file = path.join(DATA_DIR, `${type}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function findNewArticles(sitemapEntries, existing) {
  const existingMap = new Map(existing.articles.map(a => [a.url, a.lastmod || a.scrapedAt]));
  return sitemapEntries.filter(e => {
    const existingMod = existingMap.get(e.url);
    if (!existingMod) return true;
    if (!e.lastmod) return false;
    return new Date(e.lastmod) > new Date(existingMod);
  });
}

async function processQueue(queue) {
  const results = [];
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (entry) => {
      console.log(`  Fetching: ${entry.url}`);
      try {
        const article = await fetchArticle(entry.url);
        article.lastmod = entry.lastmod;
        article.type = entry.type;
        console.log(`  Translating: ${article.id}`);
        const translated = await translateArticle(article);
        return { success: true, article: translated };
      } catch (err) {
        console.error(`  Failed ${entry.url}: ${err.message}`);
        return { success: false, url: entry.url, error: err.message };
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    if (i + CONCURRENCY < queue.length) {
      await sleep(1000);
    }
  }
  return results;
}

async function main() {
  console.log('Starting Anthropic scraper...');
  console.log('Parsing sitemap...');

  const sitemapEntries = await parseSitemap();
  console.log(`Found ${sitemapEntries.length} article URLs in sitemap`);

  const types = ['blog', 'research', 'institute'];

  for (const type of types) {
    console.log(`\n--- ${type.toUpperCase()} ---`);
    const typeEntries = sitemapEntries.filter(e => e.type === type);
    const existing = loadExisting(type);
    const newEntries = findNewArticles(typeEntries, existing)
      .sort((a, b) => (b.lastmod || '').localeCompare(a.lastmod || ''))
      .slice(0, MAX_NEW_PER_TYPE);

    console.log(`  Total: ${typeEntries.length}, New/Updated: ${newEntries.length}`);

    if (newEntries.length === 0) {
      console.log('  Nothing to update.');
      continue;
    }

    const results = await processQueue(newEntries);
    const newArticles = results.filter(r => r.success).map(r => r.article);
    const failures = results.filter(r => !r.success);

    if (failures.length > 0) {
      console.log(`  ${failures.length} articles failed.`);
    }

    // Merge: update existing or append new
    const articleMap = new Map();
    for (const a of existing.articles) articleMap.set(a.url, a);
    for (const a of newArticles) articleMap.set(a.url, a);

    const merged = {
      lastUpdated: new Date().toISOString(),
      articles: Array.from(articleMap.values())
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    };

    saveData(type, merged);
    console.log(`  Saved ${merged.articles.length} articles (${newArticles.length} new)`);
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
