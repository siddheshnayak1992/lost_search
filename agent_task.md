# Footwear Search Intelligence

A local-first React application for reviewing synthetic footwear search demand. It identifies zero-result queries, groups related phrases, ranks explainable catalog matches, flags vocabulary gaps, generates review recommendations, and simulates temporary query expansions.

## Data

The app uses three maintained JSON inputs:

- `src/data/products.json` contains 30 synthetic footwear products.
- `src/data/searches.json` contains 40 aggregated synthetic searches.
- `src/data/controlledVocabulary.json` contains curated canonical terms and aliases.

All scores and analysis are calculated dynamically in the browser. No model or remote service is used. New aggregated searches are persisted in browser `localStorage`; source datasets remain unchanged. The Fix Simulator only displays temporary before-and-after results.

## Matching

Queries are normalized through controlled vocabulary aliases and normalized Levenshtein spelling candidates. Products receive a weighted term-coverage score across title (35%), brand (20%), category (20%), color (10%), and description (15%). Each result shows matched terms and field contributions. Related queries are grouped using inverse-document-frequency-weighted Jaccard similarity. Vocabulary relationships and recommendations are review suggestions, not automatic catalog edits.

## Run Locally

```sh
npm install
npm run dev
```

## Verify

```sh
npm test
npm run build
```