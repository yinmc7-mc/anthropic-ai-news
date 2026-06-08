(function() {
  'use strict';

  const TYPES = ['blog', 'research'];
  const TYPE_LABELS = { blog: '博客', research: '研究' };
  let allArticles = {};

  // --- Init ---
  document.getElementById('mastheadDate').textContent = formatDateCN(new Date());

  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  var closeBtn = document.getElementById('sidebarClose');

  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSidebar();
  });

  loadAllData().then(function() {
    renderAll();
  });

  // --- Data ---
  function loadAllData() {
    var promises = TYPES.map(function(type) {
      return fetch('data/' + type + '.json')
        .then(function(res) {
          if (!res.ok) throw new Error(res.status);
          return res.json();
        })
        .then(function(data) {
          allArticles[type] = data;
        })
        .catch(function() {
          allArticles[type] = { articles: [], lastUpdated: null };
        });
    });
    return Promise.all(promises).then(function() {
      var dates = TYPES
        .map(function(t) { return allArticles[t].lastUpdated; })
        .filter(Boolean)
        .sort()
        .reverse();
      if (dates.length) {
        document.getElementById('lastUpdate').textContent =
          '最后更新：' + formatDateCN(new Date(dates[0]));
      }
    });
  }

  // --- Render ---
  function renderAll() {
    TYPES.forEach(function(type) {
      var container = document.getElementById(type + 'List');
      var articles = allArticles[type].articles || [];

      if (articles.length === 0) {
        container.innerHTML = '<div class="empty">暂无文章</div>';
        return;
      }

      container.innerHTML = articles.map(function(a, i) {
        return '<div class="card" data-type="' + type + '" data-index="' + i + '">' +
          '<div class="card-date">' + (a.date ? formatDateCN(new Date(a.date)) : '') + '</div>' +
          '<div class="card-title">' + escHtml(a.title || a.originalTitle || '无标题') + '</div>' +
          '<div class="card-summary">' + escHtml(a.description || '') + '</div>' +
          '<span class="card-link">阅读全文 →</span>' +
        '</div>';
      }).join('');

      container.querySelectorAll('.card').forEach(function(card) {
        card.addEventListener('click', function() {
          openArticle(card.dataset.type, parseInt(card.dataset.index));
        });
      });
    });
  }

  // --- Sidebar ---
  function openArticle(type, index) {
    var article = allArticles[type].articles[index];
    if (!article) return;

    var content = document.getElementById('articleFull');
    content.innerHTML = buildNewspaperArticle(article, type);

    sidebar.classList.add('active');
    overlay.classList.add('active');
    sidebar.scrollTop = 0;
  }

  function buildNewspaperArticle(article, type) {
    var html = '';

    // Type badge
    html += '<span class="art-type">' + TYPE_LABELS[type] + '</span>';

    // Chinese title
    html += '<h1 class="art-title">' + escHtml(article.title || '') + '</h1>';

    // English original title
    if (article.originalTitle && article.originalTitle !== article.title) {
      html += '<div class="art-title-en">' + escHtml(article.originalTitle) + '</div>';
    }

    // Meta line
    html += '<div class="art-meta">';
    if (article.date) html += formatDateCN(new Date(article.date));
    html += ' · <a href="' + article.url + '" target="_blank" rel="noopener">原文链接</a>';
    html += '</div>';

    // Lead / description
    if (article.description) {
      html += '<div class="art-lead">' + escHtml(article.description) + '</div>';
    }

    // Key points — structured newspaper cards
    var keyPoints = article.keyPoints || [];
    if (keyPoints.length > 0) {
      html += '<div class="art-section-label">核心要点</div>';
      html += '<div class="art-keypoints">';
      keyPoints.forEach(function(point, i) {
        var num = (i + 1).toString().padStart(2, '0');
        html += '<div class="art-kp-item">';
        html += '<span class="art-kp-num">' + num + '</span>';
        html += '<span class="art-kp-text">' + escHtml(point) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Extract data highlights (numbers, percentages, etc.)
    var content = article.contentText || '';
    var dataHighlights = extractDataHighlights(content);
    if (dataHighlights.length > 0) {
      html += '<div class="art-section-label">关键数据</div>';
      html += '<div class="art-data-grid">';
      dataHighlights.forEach(function(d) {
        html += '<div class="art-data-card">';
        html += '<div class="art-data-value">' + escHtml(d.value) + '</div>';
        html += '<div class="art-data-label">' + escHtml(d.label) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Extract notable quotes
    var quotes = extractQuotes(article.originalContent || content);
    if (quotes.length > 0) {
      html += '<div class="art-section-label">原文摘录</div>';
      html += '<div class="art-quotes">';
      quotes.forEach(function(q) {
        html += '<blockquote class="art-quote">' + escHtml(q) + '</blockquote>';
      });
      html += '</div>';
    }

    // Divider
    html += '<hr class="art-divider">';

    // Body — with drop cap on first paragraph
    if (content) {
      var paragraphs = content
        .split(/\n{2,}/)
        .map(function(p) { return p.trim(); })
        .filter(function(p) { return p.length > 5; });

      html += '<div class="art-body">';
      paragraphs.forEach(function(p, i) {
        if (i === 0) {
          // Drop cap effect on first paragraph
          html += '<p class="art-dropcap">' + escHtml(p) + '</p>';
        } else {
          html += '<p>' + escHtml(p) + '</p>';
        }
      });
      html += '</div>';
    }

    // Original link
    html += '<div class="art-original">';
    html += '<a href="' + article.url + '" target="_blank" rel="noopener">';
    html += '阅读英文原文 → ' + escHtml(article.originalTitle || '');
    html += '</a></div>';

    return html;
  }

  // Extract numeric data highlights with context labels
  function extractDataHighlights(text) {
    if (!text) return [];
    var highlights = [];

    // Find all number patterns with surrounding context
    var dataPatterns = [
      /\d+(?:\.\d+)?%/g,
      /\$?\d+(?:\.\d+)?\s*(?:billion|million|trillion|B|M|T|亿美元|百万|十亿)/gi,
      /\d+(?:,\d{3})+(?:\.\d+)?(?:\s*(?:people|users|models|parameters|tokens|种|个|人|次))?/gi
    ];

    var seen = {};
    for (var pi = 0; pi < dataPatterns.length && highlights.length < 4; pi++) {
      var re = dataPatterns[pi];
      var match;
      while ((match = re.exec(text)) !== null && highlights.length < 4) {
        var value = match[0];
        if (seen[value]) continue;
        seen[value] = true;

        // Extract context: ~60 chars before the number
        var idx = match.index;
        var before = text.substring(Math.max(0, idx - 60), idx).trim();
        var label = extractLabelFromContext(before);

        highlights.push({ value: value, label: label });
      }
    }
    return highlights.slice(0, 4);
  }

  // Derive a short metric label from the text around a data point
  function extractLabelFromContext(before) {
    var snippet = before.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (snippet.length > 80) snippet = snippet.substring(snippet.length - 80);

    // Find the last meaningful noun phrase before the number
    // Match patterns like "Online-Mind2Web 上得分为" or "令牌成本比 Opus 4.7 便宜" or "得分突破"
    var labelMatch = snippet.match(/([^\s]{2,30}(?:得分|分数|率|成本|准确率|误差|效率|覆盖率|增幅|提升|得分|分数|性能|价格|token|成本|便宜|贵)[^\s]{0,10})$/);
    if (labelMatch) return labelMatch[1].trim();

    // Try matching a benchmark/test name
    var benchMatch = snippet.match(/((?:Bench|Benchmark|Test|Eval|Agent|SWE|OSWorld|Terminal|Mind2Web|HumanEval|MBA|Legal|Finance|CursorBench|Super-Agent)[^\s]{0,20})$/i);
    if (benchMatch) return benchMatch[1].trim();

    // Fallback: take last ~20 chars, strip leading filler
    snippet = snippet.substring(Math.max(0, snippet.length - 25));
    snippet = snippet.replace(/^(?:的|了|是|在|和|与|对|将|被|比|为|从|到|以|及|其|该|这个|我们|它们|这些|那些)\s*/g, '');
    snippet = snippet.trim();
    return snippet || '指标';
  }

  // Extract notable quotes or key sentences
  function extractQuotes(text) {
    if (!text) return [];
    var sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(function(s) { return s.trim(); })
      .filter(function(s) { return s.length > 50 && s.length < 250; });

    // Score sentences for quotability
    var quoteSignals = ['important', 'critical', 'fundamental', 'significant',
      'first time', 'breakthrough', 'unprecedented', 'essential', 'believe',
      'concern', 'safety', 'future', 'potential', 'challenge'];
    var scored = sentences.map(function(s) {
      var lower = s.toLowerCase();
      var score = 0;
      quoteSignals.forEach(function(w) { if (lower.includes(w)) score++; });
      return { text: s, score: score };
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    return scored.slice(0, 2).filter(function(s) { return s.score > 0; }).map(function(s) { return s.text; });
  }

  function closeSidebar() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  }

  // --- Helpers ---
  function formatDateCN(date) {
    try {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch { return ''; }
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
