# Pod 10: Lost Search Intelligence

A browser-based retail search intelligence tool that helps an e-commerce merchandising manager understand what customers could not find, why searches failed, which catalog products may already satisfy the demand, and what search or catalog change should be reviewed.

The demo uses synthetic footwear catalog and search data only. It stores no customer identity or personal information.

---

## Problem statement

Customers do not always use the same language as the product catalog.

For example, the catalog may contain a product described as:

```text
Puma Comfort Walk
Walking Shoes
comfortable, soft, cushioned
```

A customer may search for:

```text
comfy footwear
```

A basic lexical search may return zero results because:

```text
comfy     != comfortable
footwear  != shoes
```

However, the store may already have suitable products.

Therefore, a zero-result search does not always mean that the product is missing. It may indicate:

- a vocabulary difference;
- a spelling mistake;
- incomplete product metadata;
- a search matching problem; or
- a genuine assortment gap.

## Solution in one sentence

The application analyzes failed searches, understands customer vocabulary and spelling, groups similar customer intent, finds explainable product matches, recommends an action, and allows the merchandising manager to simulate the proposed fix.

---

## What the application shows

- Customer search queries
- Aggregated search count
- Baseline result count
- Zero-result searches
- Similar queries grouped by intent
- Potential matching products
- Vocabulary gaps
- Spelling candidates
- Search and catalog recommendations
- Potential assortment gaps
- Before-and-after Fix Simulator

---

## End-to-end flow

```text
Customer search
      |
      v
Baseline lexical search
      |
      +---- results found ----> Show normal results
      |
      +---- zero results
              |
              v
      Vocabulary normalization
              +
      Dynamic spelling analysis
              |
              v
      Interpreted customer intent
              |
              v
      Explainable product scoring
              |
        +-----+------------------+
        |                        |
        v                        v
Relevant products found     No relevant products
        |                        |
        v                        v
Recoverable search          Potential assortment gap
        |
        v
Vocabulary/spelling gap
        |
        v
Recommendation
        |
        v
Fix Simulator
```

---

## Source data

The project maintains three source JSON files.

### 1. `products.json`

Contains the synthetic footwear catalog.

```json
{
  "id": "SH001",
  "title": "Puma Comfort Walk",
  "brand": "Puma",
  "category": "Walking Shoes",
  "color": "Black",
  "price": 3499,
  "description": "Soft comfortable cushioned walking shoes designed for all-day use.",
  "attributes": [
    "comfortable",
    "soft",
    "cushioned",
    "walking",
    "lightweight"
  ]
}
```

Purpose: defines what products the retailer sells and which searchable catalog concepts describe each product.

### 2. `searches.json`

Contains aggregated synthetic search activity.

```json
{
  "id": "SQ001",
  "query": "comfy footwear",
  "searchCount": 2,
  "resultCount": 0
}
```

Purpose: shows what customers searched for, how often the search occurred, and whether the baseline search returned results.

`searchCount` represents search events, not unique customers. No customer identity is stored.

### 3. `vocabulary.json`

Contains a small, controlled footwear vocabulary that connects customer terminology with catalog terminology.

```json
{
  "customerTerm": "comfy",
  "catalogTerms": [
    "comfortable",
    "soft",
    "cushioned"
  ],
  "type": "colloquial",
  "explanation": "Customers may use comfy when the catalog describes comfort as comfortable, soft, or cushioned."
}
```

Purpose: makes vocabulary interpretation transparent, editable, category-specific, and explainable.

---

## Functional modules and ownership

The solution is divided into seven modules so each team member can own and explain a clear part of the system.

### Module 1: Search Data and Zero-Result Detection

**Problem:** We first need to identify which searches failed and how much demand they represent.

**Solution:**

- Read synthetic search records.
- Aggregate repeated normalized queries.
- Increment `searchCount` when the same query is entered again.
- Separate successful and zero-result searches.
- Calculate dashboard metrics such as total search volume and zero-result volume.

**Example:**

```text
comfy footwear
Before: 2 searches
After another search: 3 searches
Baseline results: 0
```

**Suggested owner responsibilities:**

- `searches.json`
- runtime search aggregation
- zero-results table
- overview metrics
- localStorage persistence

**Demo explanation:**

> This module identifies customer demand that the current search experience is not satisfying.

---

### Module 2: Vocabulary Understanding

**Problem:** Customers and the catalog may use different words for the same concept.

**Solution:**

Use the controlled vocabulary to interpret customer language.

```text
comfy     -> comfortable, soft, cushioned
footwear  -> shoes
work      -> office, formal
trainers  -> sneakers, running shoes
```

A one-to-many mapping is preserved during scoring. For example, `comfy` is not prematurely reduced to only `comfortable`; products described as `soft` or `cushioned` can also satisfy the concept.

**Suggested owner responsibilities:**

- `vocabulary.json`
- text normalization
- multiword mapping such as `water proof -> waterproof`
- canonical customer concepts
- vocabulary evidence

**Demo explanation:**

> This module translates customer language into catalog language using a small and transparent retail vocabulary.

---

### Module 3: Spelling Correction

**Problem:** Customers may misspell brands or product attributes.

Examples:

```text
adiddas  -> adidas
cushoned -> cushioned
```

**Solution:**

Use Levenshtein distance to measure how many character edits are needed to transform one word into another.

```text
normalized similarity = 1 - distance / maximum word length
```

Candidate words are derived dynamically from product brands, categories, attributes, and the controlled catalog vocabulary.

This is different from vocabulary mapping:

```text
comfy -> comfortable   Vocabulary difference
adiddas -> adidas      Spelling difference
```

**Suggested owner responsibilities:**

- Levenshtein implementation
- spelling similarity threshold
- spelling candidate selection
- ambiguity protection
- spelling issue UI

**Demo explanation:**

> Vocabulary differences are configured and explainable, while ordinary spelling mistakes are detected dynamically with edit-distance similarity.

---

### Module 4: Explainable Product Matching

**Problem:** Once the query is interpreted, the system must determine whether the catalog already contains relevant products.

**Solution:**

Score every product using weighted catalog evidence, such as:

- brand match;
- product type or category match;
- attribute match;
- color match;
- use-case or occasion match;
- spelling-corrected match.

Example:

```text
Query: comfy footwear

Interpreted concepts:
- comfortable / soft / cushioned
- shoes

Product: Puma Comfort Walk
Evidence:
- footwear -> shoes
- comfy -> comfortable
- cushioned attribute found
- walking-shoes category found

Explainable match score: 84%
```

The displayed score is produced by the application's weighted matching algorithm. It is not AI confidence or probability.

**Suggested owner responsibilities:**

- product scoring
- result ranking
- matched and unmatched evidence
- recoverable/review classification
- product match cards

**Demo explanation:**

> The system does not only suggest a product. It shows exactly which customer concepts matched which catalog fields.

---

### Module 5: Similar Query Grouping

**Problem:** Different search phrases may represent the same customer intent. Merchandisers need total demand, not an isolated list of phrases.

**Solution:**

1. Normalize vocabulary and spelling.
2. Convert each query into canonical concepts.
3. Compare concept sets using weighted Jaccard similarity.
4. Prevent weak grouping based only on generic words such as `shoes`.
5. Group sufficiently similar queries.
6. Sum member `searchCount` values.

Example:

```text
comfy footwear       -> comfort + shoes
cushoned footwear    -> cushioned + shoes
comfortable shoes    -> comfortable + shoes
```

Possible group:

```text
Comfortable Footwear

comfy footwear       100 searches
comfortable shoes     70 searches
cushoned footwear     40 searches
                      ------------
Total demand          210 searches
```

**Suggested owner responsibilities:**

- canonical concept generation
- weighted Jaccard similarity
- critical-intent conflict checks
- clustering
- group totals and explanations

**Demo explanation:**

> This module combines different phrases that express similar intent, allowing the merchandising manager to see total customer demand.

---

### Module 6: Gap Detection and Recommendations

**Problem:** A failed search alone does not explain what action the merchandising manager should take.

**Solution:**

Classify the reason and create an evidence-based recommendation.

#### Vocabulary gap

```text
Customer says: comfy
Catalog says: comfortable
Relevant products exist
Recommendation: review adding a search synonym
```

#### Spelling issue

```text
Customer types: adiddas
Catalog contains: adidas
Recommendation: review spelling correction
```

#### Metadata gap

```text
A relevant product exists, but an important searchable attribute is absent
Recommendation: enrich product metadata
```

#### Assortment gap

```text
Customers search: light up party sneakers
No relevant product is available
Recommendation: merchandising review
```

Recommendations remain `review_required`. The application does not automatically modify catalog or production search configuration.

**Suggested owner responsibilities:**

- vocabulary-gap evidence
- spelling recommendations
- metadata recommendations
- assortment-gap classification
- recommendation cards

**Demo explanation:**

> This module converts failed-search data into a specific action that a merchandising manager can review.

---

### Module 7: Dashboard and Fix Simulator

**Problem:** Merchandisers need to understand the impact of a proposed fix before applying it.

**Solution:**

Show a temporary before-and-after simulation.

```text
Before
Query: comfy footwear
Baseline results: 0

Proposed mapping
comfy -> comfortable
footwear -> shoes

After simulation
Recovered results: 5
```

The simulator uses temporary state only. It does not change `products.json`, `searches.json`, `vocabulary.json`, or any production search configuration.

**Suggested owner responsibilities:**

- Material UI dashboard
- navigation and responsive layout
- light/dark themes
- recommendation workflow
- before/after simulator
- accessibility and empty states

**Demo explanation:**

> The Fix Simulator allows a merchandising manager to test a proposed vocabulary or spelling improvement before approving a real change.

---

## Technology stack

| Technology | Purpose |
|---|---|
| React | Component-based browser application and interactive state management |
| Vite | Fast local development and optimized production build |
| JavaScript | Search normalization, fuzzy matching, scoring, grouping, and recommendation logic |
| Material UI | Dashboard components, responsive layout, accessibility foundations, theming, tables, dialogs, chips, and forms |
| JSON | Synthetic products, searches, and controlled vocabulary |
| localStorage | Persists demo search-count changes without a backend |
| Vitest | Deterministic unit tests for search and recommendation logic |
| Testing Library | Tests user-visible React behavior |

---

## Why Material UI instead of Tailwind CSS?

Both Material UI and Tailwind CSS are valid choices. Material UI was selected because this application is primarily an enterprise-style analytics dashboard.

The application needs:

- responsive navigation drawer;
- metric cards;
- sortable tables;
- filters;
- chips and status indicators;
- dialogs;
- forms;
- tooltips;
- alerts;
- light/dark themes;
- keyboard and accessibility support.

Material UI provides these higher-level components and interaction patterns directly. This reduces the amount of custom UI code required during a time-boxed hackathon and helps the team keep the dashboard visually consistent.

Tailwind CSS would provide excellent low-level utility classes and maximum visual control, but the team would need to design or integrate more dashboard components and their interactive states separately.

This is a project trade-off, not a claim that Material UI is universally better than Tailwind CSS.

### Is this explanation necessary?

A short explanation is useful because it shows that the team selected technology according to the product's needs rather than choosing tools randomly. Keep it concise in the live presentation. The detailed comparison belongs in this README and does not need to occupy a full demo slide.

---

## Why no embeddings or hosted AI model?

An earlier architecture considered browser-side embeddings. The final implementation intentionally uses controlled vocabulary, spelling similarity, weighted product scoring, and weighted Jaccard grouping instead.

Reasons:

- no runtime model download;
- no external network dependency;
- no API key or paid service;
- easier to debug during a live demo;
- deterministic behavior;
- highly explainable recommendations;
- a good fit for one synthetic product category;
- lower implementation and operational risk during a hackathon.

The trade-off is that the controlled vocabulary does not understand arbitrary language as broadly as a semantic model. For this focused footwear demo, transparency and reliability were prioritized.

---

## Why three JSON files?

The three files have separate responsibilities:

```text
products.json
What products exist?

searches.json
What are customers searching for?

vocabulary.json
How does customer language differ from catalog language?
```

All other outputs are derived dynamically:

- zero-result metrics;
- product matches;
- query groups;
- vocabulary gaps;
- spelling candidates;
- recommendations;
- simulated fixes.

---

## Application pages

### Overview

High-level metrics covering total search events, zero-result demand, recoverable demand, query groups, vocabulary gaps, spelling issues, and assortment gaps.

### Zero Results

A sortable and filterable list of failed searches with search volume, classification, matching score, and reason.

### Query Groups

Similar customer queries grouped by interpreted intent, including member queries and total demand.

### Product Matches

Potential products for failed searches with explainable scores and matched evidence.

### Vocabulary Gaps

Customer terminology that prevented discovery even though relevant catalog products existed.

### Recommendations

Evidence-based search, spelling, metadata, and assortment actions requiring merchandising review.

### Fix Simulator

Temporary before-and-after simulation of a proposed vocabulary or spelling change.

---

## Main classifications

### Recoverable

The baseline search returned zero results, but the interpreted query found at least one strong existing product match.

### Review

Potential products exist, but the score is not strong enough for a direct recommendation.

### Vocabulary gap

A controlled terminology mapping was required to recover relevant existing products.

### Spelling issue

A likely misspelling was detected through edit similarity.

### Metadata gap

Relevant product information may exist conceptually but is not represented well enough in searchable catalog fields.

### Potential assortment gap

Customer demand exists, but no sufficiently relevant product is available in the catalog.

---

## Recommended demo story

Use one query to explain the complete solution rather than navigating through many unrelated examples.

### 1. Start with the problem

```text
Query: comfy footwear
Search count: 100
Baseline results: 0
```

### 2. Explain the vocabulary difference

```text
comfy -> comfortable / soft / cushioned
footwear -> shoes
```

### 3. Show recovered products

```text
Puma Comfort Walk
Explainable match score: 84%

Evidence:
- comfortable attribute
- cushioned attribute
- shoes category
```

### 4. Show grouped demand

```text
Comfortable Footwear

comfy footwear       100
comfortable shoes     70
cushoned footwear     40
Total demand          210
```

### 5. Show the gap and recommendation

```text
Vocabulary gap: comfy -> comfortable
Recommendation: review adding a search synonym
```

### 6. Run the Fix Simulator

```text
Before: 0 products
After: 5 recovered products
```

### Demo closing line

> We transform zero-result searches from a reporting problem into an actionable merchandising insight.

---

## Suggested team ownership

### Seven-person split

| Owner | Module |
|---|---|
| Person 1 | Search data, aggregation, and zero-result metrics |
| Person 2 | Vocabulary normalization |
| Person 3 | Dynamic spelling correction |
| Person 4 | Product matching and ranking |
| Person 5 | Query grouping and demand aggregation |
| Person 6 | Gap detection and recommendations |
| Person 7 | Material UI dashboard and Fix Simulator |

### Four-person split

| Owner | Modules |
|---|---|
| Person 1 | Data, search aggregation, zero-result metrics |
| Person 2 | Vocabulary and spelling analysis |
| Person 3 | Product matching and query grouping |
| Person 4 | Recommendations, dashboard, and Fix Simulator |

---

## Privacy and safety

- Synthetic products and synthetic search activity only.
- No customer identity or personal information.
- No tracking.
- No backend or database.
- No external runtime service.
- No automatic production catalog modification.
- All recommendations require review.

---

## How to run

### Prerequisites

- Node.js 18 or later
- npm

### Setup

```bash
npm install
npm run dev
```

Open the local URL displayed by Vite.

### Tests

```bash
npm test
```

### Production build

```bash
npm run build
npm run preview
```

---

## Testing strategy

The core algorithms are deterministic and should be covered by unit tests:

- text normalization;
- multiword vocabulary mapping;
- Levenshtein distance;
- spelling thresholds;
- repeated-query aggregation;
- weighted product scoring;
- recoverable/review/assortment classification;
- weighted Jaccard grouping;
- unrelated-query separation;
- vocabulary-gap evidence;
- recommendation generation;
- Fix Simulator behavior;
- source-data immutability.

---

## Limitations

- The controlled vocabulary is footwear-specific.
- Coverage depends on the quality of product attributes and vocabulary mappings.
- Weighted thresholds require tuning against representative synthetic examples.
- The approach does not provide broad open-domain semantic understanding.
- `localStorage` is suitable for a demo, not shared multi-user production persistence.
- A production implementation would require governance, approval workflow, analytics validation, and integration with the retailer's real search platform.

---

## Future improvements

Possible production-scale enhancements:

- merchandising approval workflow;
- controlled vocabulary versioning;
- A/B testing of approved search changes;
- catalog-quality monitoring;
- search conversion and click-through analysis;
- category-specific vocabulary packs;
- integration with Elasticsearch, OpenSearch, Algolia, or a commerce search platform;
- optional semantic search behind an approved internal service;
- trend detection by day, week, or season;
- recommendation export and audit history.

---

## Repository note

This README explains the product, architecture, algorithms, trade-offs, ownership, and demo flow. Internal coding-agent instruction files are not needed for understanding or presenting the submitted solution.
