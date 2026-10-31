# 🔨 Event Auction System

A transparent, real-time, timed auction platform built for event organizers and participants. Features server-authoritative timer synchronization, atomic bid validation, live multi-client updates via WebSockets, and celebratory winner declarations.

---

## 🌟 Features Implemented

| # | Required Feature | Implementation Details |
|---|---|---|
| **1** | **Display Item & Starting Price** | Showcases high-resolution item imagery, title, provenance certification, lot number, category, and prominent starting price banner (e.g. ₹500.00). |
| **2** | **Allow Participants to Place Bids** | Participants can enter their name, choose demo personas (Alice, Bob, Charlie, Diana), use quick increment buttons (`+₹100`, `+₹200`, `+₹500`, `+₹1,000`, `+₹2,500`, `Next Min`), or enter custom bids. |
| **3** | **Reject Invalid / Lower Bids (≥ ₹100 Step Rule)** | Validates bids both client-side and server-side. Strictly enforces that **every new bid must be at least ₹100 higher than the current highest bid** (or $\ge$ starting price for the opening bid). Automatically rejects sub-₹100 increments, equal bids, and lower bids (`BID_TOO_LOW`, `BELOW_STARTING_PRICE`) with clear visual and audio alerts. |
| **4** | **Display Highest Bid & Bid History** | Live spotlight showing current highest bid amount, leader name, and relative timestamp. Full chronological bid history feed with rank, leader status badges, bid delta, and exact timestamps. |
| **5** | **Stop Accepting Bids at Auction End** | Synchronized countdown clock with visual urgency (green $\to$ amber $\to$ pulsing red in final 10s). Server-enforced expiration rejects late bids (`AUCTION_ENDED`) and immediately locks bidding inputs. |
| **6** | **Display the Winner** | Celebratory winner showcase banner with winner's name, final hammer price, receipt audit ID, dynamic confetti celebration, and sound fanfare. |
| **+** | **Organizer Control Station** | Event organizers can start auctions (30s, 60s, 2m, 5m presets), trigger the final hammer (end early), edit item specifications, reset state, and export the official auction ledger to CSV. |

---

## 🏗️ Architecture

- **Backend**: Node.js, Express, Socket.IO
  - Domain engine (`src/auctionEngine.js`): Pure, testable state machine enforcing all business rules.
  - HTTP Server (`server.js`): REST API endpoints + WebSockets for instant sub-second synchronization across all connected devices/tabs.
- **Frontend**: Responsive Single-Page Application (`public/index.html`, `public/app.js`, `public/style.css`)
  - Tailwind CSS for modern glassmorphic UI.
  - Lucide icons & Canvas Confetti for celebratory animations.
  - Web Audio API synthesizer for zero-dependency sound effects (bidding chime, rejection buzzer, countdown heartbeat, winner fanfare).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will bind to `0.0.0.0` and output:
```
=======================================================
🔨 Event Auction System Server (Multi-Device Active)
📡 Local Machine:   http://localhost:3000
🌐 Other Devices:   http://192.168.1.34:3000
📱 Connect your phone/tablet to the same Wi-Fi and open!
=======================================================
```

### 3. Open on Multiple Different Devices
You can bid simultaneously across as many devices as you want:
- **Device 1 (Host Laptop)**: Open `http://localhost:3000` (can use as Organizer or Bidder).
- **Device 2 (Mobile Phone)**: Scan the QR code by clicking **"📱 Multi-Device"** in the top navigation bar, or open `http://<YOUR-IP>:3000` in Safari/Chrome.
- **Device 3 (Tablet / Another Laptop)**: Open `http://<YOUR-IP>:3000`.

Each device is automatically assigned a unique persistent device ID (`bidderId`) and distinct bidder persona. When any device places a bid, all connected devices update within milliseconds in real-time!

---

## 🧪 Automated Testing

The project includes unit tests for the domain engine and integration tests for the REST API.

Run unit tests:
```bash
npm test
```

Run all tests (unit + integration):
```bash
npm run test:all
```

### Test Suite Summary:
- `Feature 1`: Display item details and starting price
- `Feature 2`: Allow participants to place bids and update highest bid
- `Feature 3`: Reject bids below starting price, equal bids, and lower bids
- `Feature 4`: Display current highest bid and comprehensive bid history
- `Feature 5`: Reject bids before auction starts and after timer expires
- `Feature 6`: Declare highest bidder as winner, with zero-bid handling
- `API Tests`: REST endpoints for bidding, timer management, early hammer, and CSV export.

---

## 📡 REST API & WebSocket Reference

### REST Endpoints
- `GET /api/auction` — Returns current snapshot (status, item, highest bid, history, remaining time).
- `POST /api/auction/bid` — Body: `{ "bidderName": "Alice", "amount": 650 }`. Returns accepted bid or 400 error.
- `POST /api/auction/start` — Body: `{ "duration": 60 }`. Starts timed auction.
- `POST /api/auction/end` — Closes auction immediately and determines winner.
- `POST /api/auction/reset` — Resets auction to initial state.
- `POST /api/auction/item` — Updates item title, description, starting price, image.
- `GET /api/auction/export?format=csv` — Downloads official auction ledger as CSV.

### WebSocket Events (Socket.IO)
- Client $\to$ Server: `place_bid`, `start_auction`, `end_auction`, `reset_auction`, `update_item`
- Server $\to$ Client: `initial_state`, `timer_tick`, `bid_accepted`, `bid_rejected`, `auction_started`, `auction_ended`, `auction_reset`, `participant_count`

---

## 🛡️ License
MIT
