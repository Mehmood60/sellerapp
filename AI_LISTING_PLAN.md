# Implementation Plan: AI-Assisted Listing Creation

## Architecture Overview

```
AliExpress URL → [PHP Scraper] → raw HTML/data → [Claude AI] → structured form data
                                                                      ↓
                                              [Add Listing Form] ← pre-filled
                                                      ↓
                                           [eBay Trading API] → live listing
```

---

## Phase 1 — Backend: Product Scraper + Claude AI Integration

**New files:**
```
backend/src/Services/ProductScraperService.php
backend/src/Services/AiListingService.php
backend/src/Services/ImageService.php
backend/src/Controllers/AiController.php
backend/data/listing_drafts/     (new folder)
```

### 1.1 — ProductScraperService.php
- Fetch URL using Guzzle with browser-realistic headers (User-Agent, Accept-Language, etc.)
- Extract: page title, description text, all product images, price, supplier country hint
- Detect origin country from domain/shipping text (`.cn`, "ships from China", "Versand aus Deutschland")
- For AliExpress: parse JSON-LD embedded in page + meta tags (most reliable)
- Return structured raw array: `{ title, description_html, images[], price, currency, origin_country, raw_html }`

### 1.2 — AiListingService.php
- Calls Claude API (`claude-sonnet-4-6`) via Guzzle HTTP
- Sends scraped data as context, asks for structured JSON back
- Prompt instructs Claude to:
  - Generate eBay-SEO title (max 80 chars) — keyword-first, no ALL CAPS, no special chars
  - Write eBay-style HTML description (bullet points, key features, condition note)
  - Suggest a retail price in EUR (typically 2–3x AliExpress cost)
  - Detect product condition (always "New" for AliExpress dropshipping)
  - Determine shipping origin → auto-select Germany or China preset
  - Suggest eBay category name

### 1.3 — ImageService.php
- Download images from scraped URLs → `backend/data/images/{md5}.jpg`
- Validate type (JPEG/PNG/WebP), resize if >2MB
- Later: upload to eBay Picture Services when publishing

### 1.4 — New API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | /api/ai/analyze | Scrape URL + run Claude analysis |
| POST | /api/listings | Save listing draft |
| PUT | /api/listings/{id} | Update draft |
| POST | /api/listings/{id}/publish | Push draft to eBay as live listing |

---

## Phase 2 — Backend: eBay Listing Publication

**Additions to EbayClient.php:**
- `createListing(array $data): array` — Trading API AddFixedPriceItem (XML)
- `updateListing(string $id, array $data): array` — ReviseFixedPriceItem
- Returns `{ item_id, start_price, fees }`

**Additions to ListingMapper.php:**
- `mapToEbayRequest(array $formData): array` — converts form schema to eBay XML format
- Handles: ItemSpecifics, ShippingDetails, ReturnPolicy, DispatchTimeMax

**Shipping Presets:**

```
Germany:
  ShippingType: Free
  ShippingServiceOptions: DHL Paket
  DispatchTimeMax: 2 days
  DeliveryEstimate: 1-2 days

China:
  ShippingType: Flat
  ShippingServiceOptions: AliExpress Standard Shipping
  ShippingServiceCost: €3.99
  DispatchTimeMax: 7 days
  DeliveryEstimate: 12-20 days
```

---

## Phase 3 — Frontend: Add Listing Page

**New files:**
```
frontend/app/listings/new/page.tsx         ← main page
frontend/components/AiProductAnalyzer.tsx  ← URL input + analyze button
frontend/components/ListingForm.tsx        ← full eBay-style form
frontend/components/ImageSelector.tsx      ← image grid with remove/reorder
frontend/components/ShippingSection.tsx    ← Germany/China presets
```

**Page Layout `/listings/new`:**

```
← Back to Listings

Add New Listing

[  Manual Entry  ] [  AI Assisted  ]   ← Tab switcher

────── AI Assisted Tab ──────────────
Product URL
[https://www.aliexpress.com/item/...]   [Analyze with AI]
                                        ↓ spinner → fills form below

────── Form (both tabs share this) ──
IMAGES
[img1][img2][img3][img4][+Add Image]   ← thumbnails, click to remove

TITLE *                                 65 / 80 chars
[iPhone 15 Pro Max Case Leather Wallet...]

CONDITION              CATEGORY
[New ▼]                [Electronics > Phone Cases]

DESCRIPTION
[HTML / rich text area — AI fills with eBay-style bullets]

PRICE      QUANTITY    SKU (optional)
[€ 24.99]  [10]        [SKU-001]

SHIPPING
Origin: [Germany] [China] [Other]

  Germany preset active:
  ✓ Free Shipping
  ✓ Processing: 1-2 days
  ✓ Delivery: 1-2 days via DHL
  [Edit manually]

[Save Draft]   [Preview]   [Publish to eBay]
```

**"Add Listing" button** added to `frontend/app/listings/page.tsx` header — links to `/listings/new`

---

## Phase 4 — Listings Page: Sync Button Placement

The existing listings page gets:
- "+ Add Listing" button (top-right, primary style) → /listings/new
- "Sync Listings" button (secondary) — existing sync behavior

---

## Implementation Order (Sprints)

**Sprint 1 — AI Analysis backbone (3-4 days)**
1. ProductScraperService.php with AliExpress + generic HTML parsing
2. AiListingService.php calling Claude API, returning structured JSON
3. POST /api/ai/analyze endpoint
4. Frontend: basic /listings/new page with URL input + raw JSON preview

**Sprint 2 — Full listing form (2-3 days)**
5. ListingForm.tsx with all fields, character counters, validation
6. ShippingSection.tsx with Germany/China presets
7. ImageSelector.tsx with scraped image thumbnails + remove/reorder
8. POST /api/listings — save draft to JSON storage

**Sprint 3 — eBay publish (2-3 days)**
9. EbayClient::createListing() via Trading API AddFixedPriceItem
10. ListingMapper::mapToEbayRequest()
11. POST /api/listings/{id}/publish
12. Frontend: "Publish to eBay" button with success/error toast + redirect to new listing

**Sprint 4 — Polish (1-2 days)**
13. Edit existing draft listings
14. Loading skeletons + error states throughout
15. "Add Listing" button on listings page
16. Category search against eBay category tree

---

## Key Technology Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| AI model | claude-sonnet-4-6 | Fast, structured JSON output, good SEO copy |
| eBay publish API | Trading API AddFixedPriceItem | Already using Trading API for sync — consistent |
| Scraping | Guzzle + browser headers + JSON-LD parsing | AliExpress embeds structured data in JSON-LD |
| Image storage | data/images/ local + eBay EPS on publish | Keeps draft workflow offline-capable |
| Draft storage | data/listing_drafts/ JSON | Matches existing storage pattern — zero new deps |
| Description editor | Textarea with HTML preview | Simple, no extra deps needed for V1 |

---

## Environment Variables to Add

```env
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
SCRAPER_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
MAX_IMAGES_PER_LISTING=12
```

---

**Total estimate: ~10-12 days for a production-ready V1.**
