# Project Instructions: Footwear Search Intelligence

## Goal
Build and maintain a browser-based React application that helps merchandising teams investigate synthetic footwear searches, zero-result demand, query groups, catalog matches, vocabulary gaps, recommendations, and proposed fixes.

## Constraints
- Use synthetic catalog and search data only. Do not add PII, a backend, a database, paid API, API keys, or a vector database.
- Use React, Vite, JavaScript, and Material UI.
- Keep all analysis explainable and dynamic in the browser.
- Do not add embedding, model, vector, cosine-similarity, remote AI, or model-loading code.
- Use `localStorage` only for local aggregated search counts and temporary app state.
- Never modify source catalog data or apply recommendations automatically.

## Data Architecture
The three human-maintained JSON inputs are:
- `src/data/products.json`: synthetic footwear product fields used for scoring.
- `src/data/searches.json`: aggregated synthetic query counts and baseline result counts.
- `src/data/controlledVocabulary.json`: canonical terms and curated aliases for normalization.

Do not add generated embeddings or generated analysis JSON. Compute groups, ranked products, gaps, and recommendations from the three inputs in application state.

## Search Analysis
- Normalize case, punctuation, and whitespace; support exact curated single- and multiword aliases.
- Use normalized Levenshtein edit distance for spelling candidates.
- Rank products with weighted query-term coverage across title, brand, category, color, and description. Expose field contributions and matched terms.
- Group queries with IDF-weighted Jaccard similarity over normalized query terms. Use the highest-volume query as representative and sum member search counts.
- Detect vocabulary gaps only when a catalog candidate clears the minimum review score. Describe relationships as suggestions, not proven synonyms.
- Generate review recommendations for spelling, vocabulary, metadata enrichment, assortment gaps, and low-scoring matches. Never apply them automatically.
- The Fix Simulator compares strict lexical results before and after a temporary query expansion. It must not change source JSON or saved search data.

## UI
Provide responsive navigation for Overview, Zero Results, Query Groups, Product Matches, Vocabulary Gaps, Recommendations, and Fix Simulator. Preserve accessible labels, keyboard focus, light/dark theme support, and concise match explanations. Keep mobile layouts free of horizontal overflow.

## Verification
- Install dependencies with `npm install`.
- Run unit tests with `npm test`.
- Run a production build with `npm run build`.
- No test may make a network request or download a model.