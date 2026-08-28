# store-assets/

Everything needed to publish **InsideKhi (InsideKarachi)** to Google Play and the App Store, in one place.

```
store-assets/
├── README.md                     ← you are here
├── STORE-LISTING.md              ← all Play Console & App Store Connect copy + Data safety answers
├── SCREENSHOT_MECHANISM.md       ← how screenshots are generated
├── make_store_screenshots.py     ← screenshot generator script
├── icon-512.png                  ← 512×512 store icon
├── screenshots/                  ← finished uploads, one folder per store slot
│   ├── android-phone/            ← Google Play phone      1080×1920
│   ├── ios-6.5/                  ← App Store iPhone 6.5"  1284×2778
│   └── ipad-13/                  ← App Store iPad 12.9/13" 2048×2732
└── raw-screenshots/              ← original simulator captures (inputs to the script)
```

Each size folder holds the same 6 images in gallery order:

```
01-explore-karachi.png                 02-featured-spotlight.png
03-card-deals.png                      04-events-tickets.png
05-personalised-recommendations.png   06-explorer-rewards.png
```

The iPad slot reuses the **phone** captures rendered on a tablet-sized canvas — allowed by
the stores, and standard for apps without a dedicated tablet layout.

## Uploading

1. Open `STORE-LISTING.md` and copy the short/full description into Play Console / App Store Connect.
2. Upload `icon-512.png` as the app icon.
3. Select all 6 files in `screenshots/android-phone/` and drag them in — alphabetical
   order **is** the intended gallery order. For App Store Connect use `ios-6.5/` and
   `ipad-13/` in their respective slots.
4. Work through the Data safety form using the tables in `STORE-LISTING.md`.

## Regenerating screenshots

After a UI change, drop fresh simulator captures into `raw-screenshots/`, update the
`ITEMS` list in `make_store_screenshots.py`, then run:

```bash
python3 make_store_screenshots.py
```

Full details, gotchas, and tuning options are documented in `SCREENSHOT_MECHANISM.md`.

## Note

These files are **build/store artifacts, not app assets** — they live outside `assets/` to avoid bundling into the binary.
