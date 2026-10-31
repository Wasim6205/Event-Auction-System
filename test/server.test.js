const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { app, server, io, auction } = require('../server');

let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => {
    io.close(() => {
      server.close(resolve);
    });
  });
});

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

test('API: Get initial auction state and starting price', async () => {
  auction.reset({ title: 'Rare Diamond', startingPrice: 400 });
  const res = await request('/api/auction');

  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'IDLE');
  assert.equal(res.data.item.title, 'Rare Diamond');
  assert.equal(res.data.startingPrice, 400);
  assert.equal(res.data.currentHighestBid, null);
});

test('API: Cannot bid when auction has not started', async () => {
  auction.reset({ startingPrice: 400 });
  const res = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderName: 'John', amount: 500 }
  });

  assert.equal(res.status, 400);
  assert.equal(res.data.success, false);
  assert.equal(res.data.code, 'AUCTION_NOT_STARTED');
});

test('API: Place valid bid and reject bids that do not exceed highest bid', async () => {
  auction.reset({ startingPrice: 500 });
  await request('/api/auction/start', {
    method: 'POST',
    body: { duration: 60 }
  });

  // Valid first bid
  const bid1 = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderName: 'Alice', amount: 500 }
  });
  assert.equal(bid1.status, 200);
  assert.equal(bid1.data.bid.amount, 500);

  // Reject bid <= 500
  const bidRejectEqual = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderName: 'Bob', amount: 500 }
  });
  assert.equal(bidRejectEqual.status, 400);
  assert.equal(bidRejectEqual.data.code, 'BID_TOO_LOW');

  // Reject bid with increment < ₹100 (550 is only +50)
  const bidRejectSmallIncrement = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderName: 'Bob', amount: 550 }
  });
  assert.equal(bidRejectSmallIncrement.status, 400);
  assert.equal(bidRejectSmallIncrement.data.code, 'BID_TOO_LOW');
  assert.equal(bidRejectSmallIncrement.data.minRequired, 600);
  assert.match(bidRejectSmallIncrement.data.reason, /at least ₹100 higher/i);

  // Reject bid below starting price
  const bidRejectBelow = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderName: 'Charlie', amount: 450 }
  });
  assert.equal(bidRejectBelow.status, 400);
  assert.equal(bidRejectBelow.data.code, 'BELOW_STARTING_PRICE');

  // Higher bid accepted with >= ₹100 increment (David bids 650, which is >= 600)
  const bid2 = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderName: 'David', amount: 650 }
  });
  assert.equal(bid2.status, 200);
  assert.equal(bid2.data.bid.amount, 650);

  // Reject bid lower than highest bid (600 < 650, but > starting price 500)
  const bidRejectLower = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderName: 'Eve', amount: 600 }
  });
  assert.equal(bidRejectLower.status, 400);
  assert.equal(bidRejectLower.data.code, 'BID_TOO_LOW');

  // Check state
  const stateRes = await request('/api/auction');
  assert.equal(stateRes.data.currentHighestBid.amount, 650);
  assert.equal(stateRes.data.currentHighestBid.bidderName, 'David');
  assert.equal(stateRes.data.totalBids, 2);
});

test('API: Stop accepting bids when auction ends and display winner', async () => {
  auction.reset({ startingPrice: 100 });
  auction.start(60);
  auction.placeBid({ bidderName: 'WinnerAlice', amount: 300 });

  // End auction
  const endRes = await request('/api/auction/end', {
    method: 'POST',
    body: { reason: 'Final call' }
  });
  assert.equal(endRes.status, 200);
  assert.equal(endRes.data.winner.bidderName, 'WinnerAlice');
  assert.equal(endRes.data.winner.winningBid, 300);

  // Attempt to bid after auction ended
  const lateBid = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderName: 'LateBob', amount: 999 }
  });
  assert.equal(lateBid.status, 400);
  assert.equal(lateBid.data.code, 'AUCTION_ENDED');
});

test('API: Multi-device network info endpoint', async () => {
  const res = await request('/api/network-info');
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.ok(res.data.ip);
  assert.ok(res.data.networkUrl.startsWith('http://'));
});

test('API: Multiple concurrent users bidding from different devices', async () => {
  auction.reset({ startingPrice: 500 });
  auction.start(60);

  // Device 1 (Mobile - Rahul) places opening bid ₹500
  const bidDev1 = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderId: 'mobile_device_1', bidderName: 'Rahul S.', amount: 500 }
  });
  assert.equal(bidDev1.status, 200);
  assert.equal(bidDev1.data.bid.bidderName, 'Rahul S.');
  assert.equal(bidDev1.data.bid.bidderId, 'mobile_device_1');

  // Device 2 (Laptop - Priya) and Device 3 (Tablet - Amit) bid simultaneously
  const [resPriya, resAmitTooLow] = await Promise.all([
    request('/api/auction/bid', {
      method: 'POST',
      body: { bidderId: 'laptop_device_2', bidderName: 'Priya M.', amount: 600 }
    }),
    request('/api/auction/bid', {
      method: 'POST',
      body: { bidderId: 'tablet_device_3', bidderName: 'Amit K.', amount: 550 } // only +₹50
    })
  ]);

  // Priya's ₹600 was valid (>= 500 + 100)
  assert.equal(resPriya.status, 200);
  assert.equal(resPriya.data.bid.amount, 600);

  // Amit's ₹550 was rejected (requires at least ₹600 or ₹700)
  assert.equal(resAmitTooLow.status, 400);
  assert.equal(resAmitTooLow.data.code, 'BID_TOO_LOW');

  // Device 3 (Tablet - Amit) now outbids with ₹750 (>= 600 + 100)
  const bidDev3Success = await request('/api/auction/bid', {
    method: 'POST',
    body: { bidderId: 'tablet_device_3', bidderName: 'Amit K.', amount: 750 }
  });
  assert.equal(bidDev3Success.status, 200);
  assert.equal(bidDev3Success.data.bid.bidderName, 'Amit K.');
  assert.equal(bidDev3Success.data.bid.amount, 750);

  // Verify state
  const stateRes = await request('/api/auction');
  assert.equal(stateRes.data.totalBids, 3);
  assert.equal(stateRes.data.currentHighestBid.bidderName, 'Amit K.');
  assert.equal(stateRes.data.currentHighestBid.amount, 750);
  assert.equal(stateRes.data.minNextBid, 850);
});
