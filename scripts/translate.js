const translate = require('translatte');
const { sleep } = require('./fetcher');

const DELAY_MS = 600;

async function translateText(text, to = 'zh-CN') {
  if (!text || text.trim().length === 0) return text;
  try {
    const result = await translate(text, { to });
    await sleep(DELAY_MS);
    return result.text;
  } catch {
    return text;
  }
}

function extractKeyPoints(text) {
  if (!text) return [];
  const sentences = text
    .replace(/\n+/g, '. ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && s.length < 350);

  // Noise patterns — skip generic boilerplate
  const noisePatterns = [
    /^(?:this|the|our|we)\s+(?:article|post|paper|report|blog|page|section)/i,
    /^(?:read|see|check|view|learn|subscribe|sign up|follow)/i,
    /(?:copyright|all rights reserved|terms of|privacy policy)/i,
    /^(?:summary|abstract|overview|introduction):?\s/i,
    /^product announcement/i,
    /^(?:today|yesterday|this week|this month),?\s+we\s+(?:are|have|will|launch|announce|introduce|release)/i,
  ];

  const scored = sentences.map(s => {
    const lower = s.toLowerCase();
    let score = 0;

    // Heavy boost: sentence contains a concrete number/percentage
    if (/\d+(?:\.\d+)?%/.test(s)) score += 4;
    if (/\$(?:\d+\.?\d*\s*(?:billion|million|trillion|B|M))/i.test(s)) score += 4;
    if (/\d+(?:,\d{3})+/.test(s)) score += 3;

    // Boost: superlative / unique claims
    if (/\b(?:first|only|highest|lowest|best|worst|most|least|largest|smallest|unprecedented)\b/i.test(s)) score += 3;

    // Boost: comparison / contrast
    if (/\b(?:compared to|versus|vs\.|beat|outperform|surpass|better than|worse than|ahead of|behind|superior|inferior|more than|less than)\b/i.test(s)) score += 3;

    // Boost: concrete findings / claims
    if (/\b(?:we found|we show|we demonstrate|results show|results indicate|evidence suggests|our evaluation|our analysis|study found|research shows)\b/i.test(s)) score += 3;

    // Moderate boost: specific technical claims
    if (/\b(?:capable of|able to|can now|enables|achieves|reaches|attains|scores)\b/i.test(s)) score += 2;

    // Moderate boost: safety / risk / alignment (high-signal for Anthropic)
    if (/\b(?:safety|alignment|risk|harm|misuse|dangerous|concern|threat|vulnerability)\b/i.test(s)) score += 2;

    // Penalty: generic / filler
    if (/\b(?:in this (?:post|article|paper|blog|report))\b/i.test(s)) score -= 3;
    if (/\b(?:we are (?:pleased|excited|thrilled|happy)|we (?:announce|introduce|launch|release) (?:a |an |the )?(?:new |updated |latest )?(?:feature|product|model|tool|service|version|update))\b/i.test(s)) score -= 2;
    if (s.length < 40) score -= 2;

    // Penalty: matches noise patterns
    for (const np of noisePatterns) {
      if (np.test(s)) { score -= 5; break; }
    }

    return { text: s, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Only return points with positive scores (actual insights)
  return scored.filter(s => s.score > 2).slice(0, 5).map(s => s.text);
}

async function translateArticle(article) {
  const title = await translateText(article.title);
  const description = await translateText(article.description);

  // Translate full content — split by paragraphs, translate each
  const contentToTranslate = article.contentText || '';
  const paragraphs = contentToTranslate
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 10);

  const translatedParagraphs = [];
  for (const para of paragraphs.slice(0, 12)) {
    const translated = await translateText(para);
    translatedParagraphs.push(translated);
  }
  const translatedContent = translatedParagraphs.join('\n\n');

  // Extract and translate key points
  const keyPoints = extractKeyPoints(article.contentText);
  const translatedKeyPoints = [];
  for (const point of keyPoints.slice(0, 5)) {
    translatedKeyPoints.push(await translateText(point));
  }

  return {
    ...article,
    title: title || article.title,
    description: description || article.description,
    contentText: translatedContent || article.contentText,
    keyPoints: translatedKeyPoints,
    originalTitle: article.title,
    originalDescription: article.description,
    originalContent: article.contentText
  };
}

module.exports = { translateArticle };
