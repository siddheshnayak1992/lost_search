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
Cushioned walking shoes with a flexible sole for all-day comfort.
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
Aggregated customer search record
      |
      v
Baseline result count
      |
        +---- results found ----> Existing search results
      |
      +---- zero results
              |
              v
      Controlled vocabulary normalization
              +
      Levenshtein spelling correction
              |
              v
      Explainable product ranking
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
        "description": "Cushioned walking shoes with a flexible sole for all-day comfort."
}
```

Purpose: defines what products the retailer sells and which searchable catalog concepts describe each product.

### 2. `searches.json`

Contains aggregated synthetic search activity.

```json
{
  "id": "SQ001",
  "query": "comfy footwear",
        "searchCount": 28,
  "resultCount": 0
}
```

Purpose: shows what customers searched for, how often the search occurred, and whether the baseline search returned results.

`searchCount` represents search events, not unique customers. No customer identity is stored.

### 3. `controlledVocabulary.json`

Contains canonical terms and curated single- or multiword aliases for query normalization.

```json
{
        "terms": {
                "comfortable": { "aliases": ["comfy", "comfort", "comfortably"] },
                "waterproof": { "aliases": ["water proof", "water-resistant", "water resistant"] },
                "adidas": { "aliases": ["adiddas", "addidas"] }
        }
}
```

An alias resolves to one canonical term. Related terms such as `soft` and `cushioned` are separate terms, not automatic synonyms.

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
Before: 28 searches
After another search: 29 searches
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

Use the controlled vocabulary to normalize customer language to canonical terms.

```text
comfy     -> comfortable
footwear  -> shoes
water proof -> waterproof
light up    -> light-up
```

Each alias maps to one canonical term. Products still receive independent matches for terms present in their title, brand, category, color, or description.

**Suggested owner responsibilities:**

- `controlledVocabulary.json`
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

Spelling candidates are compared against canonical terms in `controlledVocabulary.json` using normalized Levenshtein similarity. Product fields are not dynamically added to the spelling dictionary.

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

Score every product by weighted coverage of normalized query terms in title, brand, category, color, and description. The weights are title 35%, brand 20%, category 20%, color 10%, and description 15%. Each result exposes matched terms and field contributions.

Example:

```text
Query: red party footwear
Baseline result count: 0
Candidate: Bacca Bucci Light-Up Party Sneaker
Matched term: party
Unrepresented term: red
Weighted score: 35/100
```

The score is weighted field coverage, not a probability, confidence, or promise that the customer query will convert.

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

1. Normalize each complete query to canonical terms.
2. Weight terms by inverse document frequency across the search set.
3. Compare term sets using weighted Jaccard similarity.
4. Greedily group queries that meet the configured similarity threshold.
5. Use the highest-volume member as representative and sum member `searchCount` values.

Example:

```text
comfy footwear       -> comfortable + shoes
cushoned footwear    -> cushioned + shoes
comfortable shoes    -> comfortable + shoes
```

The app calculates group membership, representative query, and total volume from the current search data; these example phrases do not imply fixed group totals.

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
Zero-result query: red party footwear
Recovered candidate: Bacca Bucci Light-Up Party Sneaker
Unrepresented query term: red
Recommendation: review whether “red” belongs in the candidate product's metadata.
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
Customers search: glow footwear
No sufficiently relevant product is found
Recommendation: merchandising review
```

Recommendations are review suggestions. The application does not automatically modify catalog or production search configuration.

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

**Page:** Fix Simulator.

The simulator appends the entered term to the original query and reruns strict lexical matching. It is a temporary query expansion, not a saved synonym rule.

```text
Before
Query: glow footwear
Lexical candidates: 0

Temporary added term
party

After simulation
Rewritten query: glow footwear party
Lexical candidates: 1
Candidate: Bacca Bucci Light-Up Party Sneaker
```

The simulator uses temporary state only. It does not change `products.json`, `searches.json`, `controlledVocabulary.json`, or any production search configuration.

**Suggested owner responsibilities:**

- Material UI dashboard
- navigation and responsive layout
- light theme
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
| Material UI | Dashboard components, responsive layout, accessibility foundations, theming, tables, chips, alerts, and forms |
| JSON | Synthetic products, searches, and controlled vocabulary |
| localStorage | Persists demo search-count changes without a backend |
| Vitest | Deterministic unit tests for search and recommendation logic |

---

## Why Material UI instead of Tailwind CSS?

Both Material UI and Tailwind CSS are valid choices. Material UI was selected because this application is primarily an enterprise-style analytics dashboard.

The application needs:

- responsive navigation drawer;
- metric cards;
- compact data tables;
- chips and status indicators;
- forms;
- tooltips;
- alerts;
- a consistent light theme;
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

controlledVocabulary.json
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

High-level metrics covering total search events, zero-result volume, related query groups, and generated recommendations.

### Zero Results

A list of failed searches with search volume, result count, and normalized query. Select a row to inspect product matches.

### Query Groups

Similar customer queries grouped by interpreted intent, including member queries and total demand.

### Product Matches

Potential products for failed searches with explainable scores and matched evidence.

### Vocabulary Gaps

Unrepresented query terms for historically zero-result searches when a recovered catalog candidate clears the review score threshold. The source zero-result history keeps the gap visible after a user analyzes the query.

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

A historically zero-result query has a relevant candidate, but one or more normalized query terms are absent from that product's metadata. The row is a review suggestion, not proof of a synonym.

### Spelling issue

A likely misspelling was detected through edit similarity.

### Metadata gap

Relevant product information may exist conceptually but is not represented well enough in searchable catalog fields.

### Potential assortment gap

Customer demand exists, but no sufficiently relevant product is available in the catalog.

---

## Reset and Repeat the Module Demo

Run the app with `npm run dev`, open the Vite URL, and reset only this app's saved search state before each full demo. In the browser DevTools Console, run:

```js
localStorage.removeItem("footwear-searches-v1");
location.reload();
```

Use the console for the same origin as the app (`localhost` and `127.0.0.1` have separate storage). This resets saved changes to the three JSON seed files; on reload, the app initializes from those files and writes the seed state back to `footwear-searches-v1`. It does not leave storage empty or change the source files. Alternatively, in DevTools Application storage, delete only the `footwear-searches-v1` entry. Avoid `localStorage.clear()` if other local app data may be present.

Run the examples in order. Select seeded rows from Zero Results for Modules 2-4; selecting a row opens Product Matches without changing its saved count or baseline result count.

| Module | Example action | Affected page(s) and expected result |
|---|---|---|
| 1. Search data | Enter `glow footwear` in the top search and click Analyze twice. | Product Matches reports no catalog matches. Overview, Zero Results, Query Groups, and Recommendations update; one `glow footwear` entry has a search count of 2. |
| 2. Vocabulary | Open Zero Results and select `water proof hiking shoe`. | Zero Results shows normalized query `waterproof hiking shoes`; Product Matches shows hiking candidates. The row selection does not increment its count. |
| 3. Spelling | Open Zero Results and select `adiddas running shoes`. | Product Matches shows the Adidas candidate and a spelling-correction chip. Zero Results displays the canonicalized query. |
| 4. Product scoring | Keep `adiddas running shoes` selected on Product Matches. | Product Matches ranks products with weighted score and field-level matched-term evidence; Adidas Runfalcon 3 is the top candidate in the seeded catalog. |
| 5. Query grouping | Open Query Groups and find the Adidas running-shoe group. | `adiddas running shoes` and `adidas running shoes` normalize to the same terms. The representative is `adidas running shoes`; those two source phrases contribute 59 searches to the group total. |
| 6. Gaps and recommendations | On Overview, click **Run live gap example**. Open Vocabulary Gaps, then Recommendations. | The button submits the new query `blue party footwear` through the same search handler as the top search. Vocabulary Gaps adds `blue party footwear` → missing term `blue` → Bacca Bucci Light-Up Party Sneaker (score 35, search count 1). The seeded `red party footwear` row remains. Recommendations adds a metadata-review suggestion for `blue`. |
| 7. Fix Simulator | Set Original query to `glow footwear`, Add this term to `party`, then run the simulation. | Fix Simulator shows zero lexical candidates before the expansion and the party sneaker among candidates after it. The simulation does not modify saved searches or source JSON. |

The app keeps the strict baseline `resultCount` separate from the normalized `candidateCount`. A new search with zero strict lexical results can therefore be recorded, recovered against the catalog, and shown as a vocabulary gap when a candidate clears the review threshold and a query term is missing from its metadata. The baseline seed query works the same way, while its search count persists in localStorage.

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
- No customer-level tracking or analytics service.
- No backend or database.
- No external runtime service.
- No automatic production catalog modification.
- All recommendations require review.

---

## How to run

### Prerequisites

- Node.js 22.12 or later (required by the current Vitest release)
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

The core algorithms are deterministic and are covered by unit tests for:

- single- and multiword normalization;
- Levenshtein spelling correction;
- explainable weighted product scoring;
- repeated-query aggregation and merging saved searches with source data;
- weighted Jaccard grouping and search-volume totals;
- vocabulary gaps for recovered candidates, including the seeded `red party footwear` example;
- generated assortment recommendations;
- temporary Fix Simulator behavior.

Tests run locally with `npm test` and do not make network requests.

---

## Limitations

- The controlled vocabulary is footwear-specific.
- Coverage depends on the quality of product metadata and curated aliases.
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
- trend detection by day, week, or season;
- broader curated vocabulary and spelling coverage;
- recommendation export and audit history.

---

## Repository note

This README explains the product, architecture, algorithms, trade-offs, ownership, and demo flow. Internal coding-agent instruction files are not needed for understanding or presenting the submitted solution.
