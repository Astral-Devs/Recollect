# 🧠 Recollect

**A private, semantic search engine for your browsing history.**  
Recollect runs entirely on your device. It quietly remembers what you read, so later you can ask things like _“that one potato dish”_ — and it’ll actually find it.

---

## What It Does

- **Semantic search:** Find pages by meaning, not keywords.  
- **Works offline:** Everything lives in your browser’s IndexedDB. No servers!
- **Recency-aware ranking:** Recent pages get a gentle boost.  
- **Privacy by default:** Skips sensitive sites like Gmail, banking, and calendars.  
- **Options page:** Clear data, control backfill window, manage excluded domains.  

---

## Built With

- Chrome **Manifest V3** (service worker background)
- **React + TypeScript + Vite** for popup and options UIs  
- **IndexedDB** via [`idb`](https://github.com/jakearchibald/idb)  
- **ESLint**, and **Prettier** for codehygiene  

---

## Setup

```bash
# install deps
npm install

# build extension
npm run build

# load into Chrome
# chrome://extensions → Enable Developer Mode → Load unpacked → select /dist
```