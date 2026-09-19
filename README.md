# Soukoonn — سكون

Storefront for soukoonn.com. Static site on GitHub Pages; products are managed
through the admin panel at **soukoonn.com/admin** (Sveltia CMS).

## How it works

```
content/products/*.json   one file per product (edited through /admin)
images/products/          product photos (uploads are converted to WebP)
index.html                the storefront; loads products.json at runtime
admin/                    the admin panel and its field configuration
scripts/build.mjs         turns content/products/ into _site/products.json
.github/workflows/        publishes the site on every commit to main
```

Saving in the admin commits to `main`, which runs the workflow and republishes
the site — changes are live within a minute or two. Every change is a commit, so
anything can be undone from the repository history.

## Product fields

| Field | Notes |
|---|---|
| `name_ar`, `name_en` | Arabic name is required |
| `category` | `mabakhir` `bakhoor` `accessories` `antiques` `soap` `candles` |
| `price` | USD; empty shows "Price TBD" |
| `images` | first is the main photo; extra photos form a swipeable gallery |
| `size_ar`, `size_en` | optional, shown under the price |
| `desc_ar`, `desc_en` | optional |
| `is_set` | shows a "set" badge with the piece count |
| `hidden` | removes the product from the site without deleting it |
| `order` | smaller first; products without one appear first in their section |

## Local preview

```bash
node scripts/build.mjs
python -m http.server 8140 --directory _site
```

Then open http://localhost:8140.
