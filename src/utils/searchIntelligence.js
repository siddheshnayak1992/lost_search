const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "the", "to", "with", "shoe", "shoes"]);

export const SCORE_WEIGHTS = {
  title: 0.35,
  brand: 0.2,
  category: 0.2,
  color: 0.1,
  description: 0.15
};

export function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

export function spellingCorrection(token, vocabulary) {
  const candidates = Object.keys(vocabulary.terms ?? {});
  let best = null;
  for (const candidate of candidates) {
    if (candidate.length < 4 || Math.abs(candidate.length - token.length) > 2) continue;
    const distance = levenshteinDistance(token, candidate);
    const similarity = 1 - distance / Math.max(token.length, candidate.length);
    if (distance <= 2 && similarity >= 0.66 && (!best || similarity > best.similarity)) {
      best = { term: candidate, similarity };
    }
  }
  return best;
}

function aliasIndex(vocabulary) {
  const aliases = new Map();
  for (const [canonical, definition] of Object.entries(vocabulary.terms ?? {})) {
    aliases.set(canonical, canonical);
    for (const alias of definition.aliases ?? []) aliases.set(alias.toLowerCase(), canonical);
  }
  return aliases;
}

export function normalizeQuery(input, vocabulary, allowSpelling = true) {
  const aliases = aliasIndex(vocabulary);
  const original = String(input ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  const tokens = original.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const corrections = [];
  const phrases = [...aliases.entries()]
    .map(([phrase, canonical]) => ({ phrase: phrase.split(/\s+/), canonical }))
    .filter((entry) => entry.phrase.length > 1)
    .sort((left, right) => right.phrase.length - left.phrase.length);
  const normalizedTokens = [];
  for (let index = 0; index < tokens.length;) {
    const phrase = phrases.find(({ phrase }) => phrase.every((part, offset) => tokens[index + offset] === part));
    if (phrase) {
      normalizedTokens.push(phrase.canonical);
      index += phrase.phrase.length;
      continue;
    }
    const token = tokens[index];
    const direct = aliases.get(token);
    if (direct) normalizedTokens.push(direct);
    else if (!allowSpelling) normalizedTokens.push(token);
    else {
      const correction = spellingCorrection(token, vocabulary);
      if (!correction) normalizedTokens.push(token);
      else {
        corrections.push({ from: token, to: correction.term, similarity: correction.similarity });
        normalizedTokens.push(correction.term);
      }
    }
    index += 1;
  }
  return {
    original: String(input ?? "").trim(),
    normalized: normalizedTokens.join(" "),
    tokens: normalizedTokens.filter((token) => !STOP_WORDS.has(token)),
    corrections
  };
}

function fieldCoverage(tokens, value, vocabulary) {
  const fieldTokens = normalizeQuery(value, vocabulary).tokens;
  const present = tokens.filter((token) => fieldTokens.includes(token));
  return { coverage: tokens.length ? present.length / tokens.length : 0, terms: present };
}

export function scoreProduct(query, product, vocabulary) {
  const normalized = normalizeQuery(query, vocabulary);
  const features = {
    title: product.title,
    brand: product.brand,
    category: product.category,
    color: product.color,
    description: product.description
  };
  const explanation = [];
  let score = 0;
  for (const [field, weight] of Object.entries(SCORE_WEIGHTS)) {
    const match = fieldCoverage(normalized.tokens, features[field], vocabulary);
    score += weight * match.coverage;
    if (match.terms.length) explanation.push({ field, terms: match.terms, contribution: weight * match.coverage });
  }
  return {
    product,
    score: Math.round(score * 100),
    explanation,
    matchedTerms: [...new Set(explanation.flatMap((item) => item.terms))],
    corrections: normalized.corrections
  };
}

export function rankProducts(query, products, vocabulary) {
  return products
    .map((product) => scoreProduct(query, product, vocabulary))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.product.title.localeCompare(right.product.title));
}

export function strictLexicalResultCount(query, products) {
  const queryTerms = String(query ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((term) => term && !STOP_WORDS.has(term));
  if (!queryTerms.length) return 0;
  return products.filter((product) => {
    const productTerms = new Set(`${product.title} ${product.brand} ${product.category} ${product.color} ${product.description}`
      .toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/));
    return queryTerms.every((term) => productTerms.has(term));
  }).length;
}

export function rankLexically(query, products) {
  const queryTerms = String(query ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (!queryTerms.length) return [];
  return products.map((product) => {
    const fields = {
      title: product.title,
      brand: product.brand,
      category: product.category,
      color: product.color,
      description: product.description
    };
    const explanation = [];
    let score = 0;
    for (const [field, weight] of Object.entries(SCORE_WEIGHTS)) {
      const fieldTerms = fields[field].toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/);
      const terms = [...new Set(queryTerms.filter((term) => fieldTerms.includes(term)))];
      if (terms.length) {
        const contribution = weight * terms.length / queryTerms.length;
        score += contribution;
        explanation.push({ field, terms, contribution });
      }
    }
    return { product, score: Math.round(score * 100), explanation, matchedTerms: [...new Set(explanation.flatMap((item) => item.terms))], corrections: [] };
  }).filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.product.title.localeCompare(right.product.title));
}

export function recordSearch(searches, query, candidateCount, baselineResultCount = candidateCount) {
  const original = String(query ?? "").trim().replace(/\s+/g, " ");
  const key = original.toLowerCase();
  const existing = searches.find((item) => item.query.toLowerCase().trim().replace(/\s+/g, " ") === key);
  if (existing) return searches.map((item) => item === existing
    ? { ...item, searchCount: item.searchCount + 1, candidateCount }
    : item);
  return [{
    id: `SQ-${Date.now()}`,
    query: original,
    searchCount: 1,
    resultCount: baselineResultCount,
    candidateCount
  }, ...searches];
}

export function mergeSearches(sourceSearches, storedSearches) {
  const normalizeKey = (query) => query.toLowerCase().trim().replace(/\s+/g, " ");
  const storedById = new Map(storedSearches.map((search) => [search.id, search]));
  const storedByQuery = new Map(storedSearches.map((search) => [normalizeKey(search.query), search]));
  const includedStoredIds = new Set();
  const sourceIds = new Set(sourceSearches.map((search) => search.id));
  const sourceQueries = new Set(sourceSearches.map((search) => normalizeKey(search.query)));
  const mergedSource = sourceSearches.map((source) => {
    const stored = storedById.get(source.id) ?? storedByQuery.get(normalizeKey(source.query));
    if (!stored) return source;
    includedStoredIds.add(stored.id);
    return { ...source, ...stored, id: source.id, resultCount: source.resultCount };
  });
  const localSearches = storedSearches.filter((search) =>
    !sourceIds.has(search.id) && !sourceQueries.has(normalizeKey(search.query)) && !includedStoredIds.has(search.id)
  );
  return [...mergedSource, ...localSearches];
}

function termWeights(searches, vocabulary) {
  const documents = searches.map((search) => new Set(normalizeQuery(search.query, vocabulary).tokens));
  const frequencies = new Map();
  for (const terms of documents) for (const term of terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  return (term) => Math.log(1 + documents.length / (1 + (frequencies.get(term) ?? 0)));
}

export function weightedJaccard(left, right, weight = () => 1) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const terms = new Set([...leftSet, ...rightSet]);
  let intersection = 0;
  let union = 0;
  for (const term of terms) {
    const termWeight = weight(term);
    union += termWeight;
    if (leftSet.has(term) && rightSet.has(term)) intersection += termWeight;
  }
  return union === 0 ? 0 : intersection / union;
}

export function groupQueries(searches, vocabulary, threshold = 0.28) {
  const weight = termWeights(searches, vocabulary);
  const groups = [];
  const sorted = [...searches].sort((a, b) => b.searchCount - a.searchCount);
  for (const search of sorted) {
    const tokens = normalizeQuery(search.query, vocabulary).tokens;
    const candidate = groups
      .map((group) => ({ group, similarity: Math.max(...group.members.map((member) => weightedJaccard(tokens, member.tokens, weight))) }))
      .filter((entry) => entry.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)[0];
    if (candidate) candidate.group.members.push({ ...search, tokens });
    else groups.push({ members: [{ ...search, tokens }] });
  }
  return groups.map(({ members }) => {
    const representative = [...members].sort((a, b) => b.searchCount - a.searchCount)[0];
    const totalSearches = members.reduce((sum, member) => sum + member.searchCount, 0);
    const zeroResultSearches = members.reduce((sum, member) => sum + (member.resultCount === 0 ? member.searchCount : 0), 0);
    const pairScores = [];
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) pairScores.push(weightedJaccard(members[i].tokens, members[j].tokens, weight));
    }
    return {
      representative: representative.query,
      totalSearches,
      zeroResultSearches,
      averageSimilarity: pairScores.length ? pairScores.reduce((sum, score) => sum + score, 0) / pairScores.length : 1,
      members: members.map(({ tokens, ...member }) => member)
    };
  }).sort((a, b) => b.totalSearches - a.totalSearches);
}

export function detectVocabularyGaps(query, rankedProducts, vocabulary, minimumScore = 12) {
  if (!rankedProducts.length || rankedProducts[0].score < minimumScore) return [];
  const normalized = normalizeQuery(query, vocabulary);
  const best = rankedProducts[0];
  const productTerms = new Set(normalizeQuery(
    `${best.product.title} ${best.product.brand} ${best.product.category} ${best.product.color} ${best.product.description}`,
    vocabulary
  ).tokens);
  return normalized.tokens
    .filter((term) => !productTerms.has(term))
    .map((term) => ({ term, product: best.product, score: best.score, explanation: "Query term is not represented in the matched product metadata." }));
}

export function collectVocabularyGaps(searches, products, vocabulary, sourceSearches = []) {
  const queryKey = (query) => query.toLowerCase().trim().replace(/\s+/g, " ");
  const sourceZeroQueries = new Set(sourceSearches
    .filter((search) => search.resultCount === 0)
    .map((search) => queryKey(search.query)));
  return searches.filter((search) => search.resultCount === 0 || sourceZeroQueries.has(queryKey(search.query)))
    .flatMap((search) => {
      const ranked = rankProducts(search.query, products, vocabulary);
      return detectVocabularyGaps(search.query, ranked, vocabulary).map((gap) => ({
        ...gap,
        query: search.query,
        searchCount: search.searchCount
      }));
    })
    .sort((left, right) => right.searchCount - left.searchCount);
}

export function createRecommendations(searches, products, vocabulary) {
  return searches.flatMap((search) => {
    if (search.resultCount > 0) return [];
    const normalized = normalizeQuery(search.query, vocabulary);
    const ranked = rankProducts(search.query, products, vocabulary);
    if (normalized.corrections.length) return [{
      type: "ADD_SPELLING_CORRECTION", query: search.query, searchCount: search.searchCount,
      detail: `Review ${normalized.corrections.map(({ from, to }) => `${from} -> ${to}`).join(", ")} as a spelling rule.`, score: ranked[0]?.score ?? 0
    }];
    if (ranked[0]?.score >= 45) return [{
      type: "ADD_SEARCH_SYNONYM", query: search.query, searchCount: search.searchCount,
      detail: `Review a controlled vocabulary mapping to ${ranked[0].product.title}.`, score: ranked[0].score
    }];
    if (ranked[0]?.score >= 12) return [{
      type: "ENRICH_PRODUCT_METADATA", query: search.query, searchCount: search.searchCount,
      detail: `Review whether “${normalized.tokens.find((term) => !ranked[0].matchedTerms.includes(term)) ?? search.query}” belongs in ${ranked[0].product.title} metadata.`, score: ranked[0].score
    }];
    return [{
      type: ranked.length ? "REVIEW_LOW_CONFIDENCE_MATCH" : "REVIEW_ASSORTMENT_GAP",
      query: search.query,
      searchCount: search.searchCount,
      detail: ranked.length ? `Best catalog score is ${ranked[0].score}; review before making a search rule.` : "No catalog product shares controlled query terms; review assortment coverage.",
      score: ranked[0]?.score ?? 0
    }];
  }).sort((a, b) => b.searchCount - a.searchCount);
}

export function simulateFix(query, mapping, products, vocabulary) {
  const before = rankLexically(query, products);
  const replacement = String(mapping ?? "").trim();
  const rewrittenQuery = replacement ? `${query} ${replacement}`.trim() : query;
  return { before, rewrittenQuery, after: rankLexically(rewrittenQuery, products) };
}