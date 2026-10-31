const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const AuctionEngine = require('./src/auctionEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Initialize Auction Engine
const auction = new AuctionEngine();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast helper
function broadcastState(eventName, extra = {}) {
  const state = auction.getState();
  io.emit(eventName, {
    state,
    connectedCount: io.engine.clientsCount,
    ...extra
  });
}

// Global server timer loop (runs every 500ms for sharp timer sync)
const timerInterval = setInterval(() => {
  if (auction.status === 'ACTIVE') {
    const wasExpired = auction.checkExpiration();
    if (wasExpired) {
      broadcastState('auction_ended', {
        reason: 'Time expired',
        winner: auction.winner
      });
    } else {
      io.emit('timer_tick', {
        remainingSeconds: auction.getRemainingSeconds(),
        status: auction.status
      });
    }
  }
}, 500);

// Unref timer so it doesn't prevent Node process from exiting
if (timerInterval.unref) {
  timerInterval.unref();
}

// REST API Endpoints

// 1. Get current auction state
app.get('/api/auction', (req, res) => {
  res.json({
    success: true,
    ...auction.getState(),
    connectedCount: io.engine.clientsCount
  });
});

// 2. Place a bid via REST
app.post('/api/auction/bid', (req, res) => {
  const { bidderName, amount } = req.body;
  const result = auction.placeBid({ bidderName, amount });

  if (!result.success) {
    return res.status(400).json(result);
  }

  broadcastState('bid_accepted', { bid: result.bid });
  res.json(result);
});

// 3. Start auction (Organizer)
app.post('/api/auction/start', (req, res) => {
  const { duration } = req.body;
  const result = auction.start(duration);

  if (!result.success) {
    return res.status(400).json(result);
  }

  broadcastState('auction_started');
  res.json(result);
});

// 4. End auction early (Organizer Hammer)
app.post('/api/auction/end', (req, res) => {
  const { reason } = req.body || {};
  const result = auction.end(reason || 'Hammered down by organizer');

  if (!result.success) {
    return res.status(400).json(result);
  }

  broadcastState('auction_ended', { winner: result.winner });
  res.json(result);
});

// 5. Reset auction (Organizer)
app.post('/api/auction/reset', (req, res) => {
  const itemConfig = req.body && Object.keys(req.body).length > 0 ? req.body : null;
  const state = auction.reset(itemConfig);
  broadcastState('auction_reset');
  res.json({ success: true, state });
});

// 6. Update item (Organizer)
app.post('/api/auction/item', (req, res) => {
  const result = auction.updateItem(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  broadcastState('item_updated');
  res.json(result);
});

// 7. Export auction ledger for organizers (JSON or CSV)
app.get('/api/auction/export', (req, res) => {
  const format = req.query.format || 'json';
  const state = auction.getState();

  if (format === 'csv') {
    let csv = 'Bid ID,Bidder Name,Amount ($),Timestamp,Formatted Time,Leading,Increment ($)\n';
    state.bids.forEach(b => {
      csv += `"${b.id}","${b.bidderName}",${b.amount},${b.timestamp},"${b.formattedTime}",${b.isLeading},${b.increment}\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="auction-lot-${state.item.lotNumber.replace(/[^a-zA-Z0-9]/g, '')}-export.csv"`);
    return res.send(csv);
  }

  res.json({
    exportedAt: new Date().toISOString(),
    auctionReport: state
  });
});

// Socket.IO Real-Time Communications
io.on('connection', (socket) => {
  // Send state immediately on connect
  socket.emit('initial_state', {
    state: auction.getState(),
    connectedCount: io.engine.clientsCount
  });

  // Notify everyone of updated count
  io.emit('participant_count', { count: io.engine.clientsCount });

  // Handle bid from client
  socket.on('place_bid', (data, callback) => {
    const { bidderName, amount } = data || {};
    const result = auction.placeBid({ bidderName, amount });

    if (!result.success) {
      socket.emit('bid_rejected', result);
      if (typeof callback === 'function') callback(result);
      return;
    }

    // Broadcast valid bid to ALL connected participants
    broadcastState('bid_accepted', { bid: result.bid });
    if (typeof callback === 'function') callback(result);
  });

  // Handle organizer start
  socket.on('start_auction', (data, callback) => {
    const duration = data?.duration;
    const result = auction.start(duration);

    if (result.success) {
      broadcastState('auction_started');
    }
    if (typeof callback === 'function') callback(result);
  });

  // Handle organizer end
  socket.on('end_auction', (data, callback) => {
    const result = auction.end(data?.reason || 'Ended by organizer');

    if (result.success) {
      broadcastState('auction_ended', { winner: result.winner });
    }
    if (typeof callback === 'function') callback(result);
  });

  // Handle organizer reset
  socket.on('reset_auction', (data, callback) => {
    const state = auction.reset(data?.itemConfig);
    broadcastState('auction_reset');
    if (typeof callback === 'function') callback({ success: true, state });
  });

  // Handle item update
  socket.on('update_item', (data, callback) => {
    const result = auction.updateItem(data);
    if (result.success) {
      broadcastState('item_updated');
    }
    if (typeof callback === 'function') callback(result);
  });

  socket.on('disconnect', () => {
    io.emit('participant_count', { count: io.engine.clientsCount });
  });
});

// Start Server if run directly
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🔨 Event Auction System Server`);
    console.log(`📡 Real-time Socket.IO + REST API running at:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`===============================================`);
  });
}

module.exports = { app, server, io, auction, timerInterval };
