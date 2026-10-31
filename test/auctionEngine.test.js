const test = require('node:test');
const assert = require('node:assert/strict');
const AuctionEngine = require('../src/auctionEngine');

test('Feature 1: Display the item and starting price', () => {
  const itemConfig = {
    title: 'Autographed 1996 Michael Jordan Jersey',
    description: 'Championship Finals authenticated jersey with PSA/DNA certificate.',
    startingPrice: 1000,
    lotNumber: 'LOT #042'
  };

  const auction = new AuctionEngine(itemConfig);
  const state = auction.getState();

  assert.equal(state.status, 'IDLE');
  assert.equal(state.item.title, 'Autographed 1996 Michael Jordan Jersey');
  assert.equal(state.item.startingPrice, 1000);
  assert.equal(state.startingPrice, 1000);
  assert.equal(state.minNextBid, 1000);
  assert.equal(state.minIncrement, 100);
  assert.equal(state.currentHighestBid, null);
  assert.equal(state.bids.length, 0);
});

test('Feature 2: Allow participants to place bids', () => {
  const auction = new AuctionEngine({ startingPrice: 200 });
  auction.start(60);

  const res1 = auction.placeBid({ bidderName: 'Alice', amount: 200 });
  assert.equal(res1.success, true);
  assert.equal(res1.bid.bidderName, 'Alice');
  assert.equal(res1.bid.amount, 200);

  // Bob bids at least 100 higher (200 + 100 = 300)
  const res2 = auction.placeBid({ bidderName: 'Bob', amount: 300 });
  assert.equal(res2.success, true);
  assert.equal(res2.bid.bidderName, 'Bob');
  assert.equal(res2.bid.amount, 300);

  const state = auction.getState();
  assert.equal(state.totalBids, 2);
  assert.equal(state.currentHighestBid.bidderName, 'Bob');
  assert.equal(state.currentHighestBid.amount, 300);
  assert.equal(state.minNextBid, 400); // Next min is 300 + 100 = 400
});

test('Feature 3: Reject bids that do not exceed the current highest bid', () => {
  const auction = new AuctionEngine({ startingPrice: 300 });
  auction.start(60);

  // Rejection 1: Below starting price
  const lowStartRes = auction.placeBid({ bidderName: 'Charlie', amount: 250 });
  assert.equal(lowStartRes.success, false);
  assert.equal(lowStartRes.code, 'BELOW_STARTING_PRICE');
  assert.match(lowStartRes.reason, /below the starting price/i);

  // Valid first bid at starting price
  const valid1 = auction.placeBid({ bidderName: 'Alice', amount: 300 });
  assert.equal(valid1.success, true);

  // Rejection 2: Exact same amount as highest bid (does not exceed)
  const equalBidRes = auction.placeBid({ bidderName: 'Bob', amount: 300 });
  assert.equal(equalBidRes.success, false);
  assert.equal(equalBidRes.code, 'BID_TOO_LOW');
  assert.match(equalBidRes.reason, /Must be at least ₹100 higher/i);

  // Higher bid succeeds with >= 100 increment (300 + 100 = 400)
  const higherBidRes = auction.placeBid({ bidderName: 'David', amount: 400 });
  assert.equal(higherBidRes.success, true);
  assert.equal(higherBidRes.bid.amount, 400);

  // Rejection 3: Lower than current highest bid (350 < 400)
  const lowerBidRes = auction.placeBid({ bidderName: 'Charlie', amount: 350 });
  assert.equal(lowerBidRes.success, false);
  assert.equal(lowerBidRes.code, 'BID_TOO_LOW');
  assert.match(lowerBidRes.reason, /Must be at least ₹100 higher/i);
});

test('Feature 3.1: Every new bid must be at least ₹100 higher than the current highest bid', () => {
  const auction = new AuctionEngine({ startingPrice: 500 });
  auction.start(60);

  // First bid at starting price ₹500
  const first = auction.placeBid({ bidderName: 'Alice', amount: 500 });
  assert.equal(first.success, true);
  assert.equal(auction.getState().minNextBid, 600);

  // Attempt bid +₹10 (₹510) -> REJECTED
  const rej1 = auction.placeBid({ bidderName: 'Bob', amount: 510 });
  assert.equal(rej1.success, false);
  assert.equal(rej1.code, 'BID_TOO_LOW');
  assert.equal(rej1.minRequired, 600);
  assert.match(rej1.reason, /at least ₹100 higher/i);

  // Attempt bid +₹50 (₹550) -> REJECTED
  const rej2 = auction.placeBid({ bidderName: 'Bob', amount: 550 });
  assert.equal(rej2.success, false);
  assert.equal(rej2.code, 'BID_TOO_LOW');
  assert.equal(rej2.minRequired, 600);

  // Attempt bid +₹99 (₹599) -> REJECTED
  const rej3 = auction.placeBid({ bidderName: 'Bob', amount: 599 });
  assert.equal(rej3.success, false);
  assert.equal(rej3.code, 'BID_TOO_LOW');
  assert.equal(rej3.minRequired, 600);

  // Exact +₹100 (₹600) -> ACCEPTED
  const acc1 = auction.placeBid({ bidderName: 'Bob', amount: 600 });
  assert.equal(acc1.success, true);
  assert.equal(acc1.bid.amount, 600);
  assert.equal(auction.getState().minNextBid, 700);

  // Sub-₹100 increment on top of ₹600 (₹680) -> REJECTED
  const rej4 = auction.placeBid({ bidderName: 'Charlie', amount: 680 });
  assert.equal(rej4.success, false);
  assert.equal(rej4.minRequired, 700);

  // More than ₹100 (₹850) -> ACCEPTED
  const acc2 = auction.placeBid({ bidderName: 'Charlie', amount: 850 });
  assert.equal(acc2.success, true);
  assert.equal(acc2.bid.amount, 850);
  assert.equal(auction.getState().minNextBid, 950);
});

test('Feature 4: Display current highest bid and bid history', () => {
  const auction = new AuctionEngine({ startingPrice: 100 });
  auction.start(60);

  auction.placeBid({ bidderName: 'Alice', amount: 100 });
  auction.placeBid({ bidderName: 'Bob', amount: 200 });
  auction.placeBid({ bidderName: 'Charlie', amount: 350 });

  const state = auction.getState();

  // Current highest bid check
  assert.equal(state.currentHighestBid.bidderName, 'Charlie');
  assert.equal(state.currentHighestBid.amount, 350);

  // Bid history check (newest first)
  assert.equal(state.bids.length, 3);
  assert.equal(state.bids[0].bidderName, 'Charlie');
  assert.equal(state.bids[0].amount, 350);
  assert.equal(state.bids[0].isLeading, true);

  assert.equal(state.bids[1].bidderName, 'Bob');
  assert.equal(state.bids[1].amount, 200);
  assert.equal(state.bids[1].isLeading, false);

  assert.equal(state.bids[2].bidderName, 'Alice');
  assert.equal(state.bids[2].amount, 100);
  assert.equal(state.bids[2].isLeading, false);
});

test('Feature 5: Stop accepting bids when the auction ends', async () => {
  const auction = new AuctionEngine({ startingPrice: 100 });
  
  // Cannot bid when IDLE (not started)
  const idleBid = auction.placeBid({ bidderName: 'Alice', amount: 100 });
  assert.equal(idleBid.success, false);
  assert.equal(idleBid.code, 'AUCTION_NOT_STARTED');

  // Start with 1 second duration
  auction.start(1);
  const activeBid = auction.placeBid({ bidderName: 'Alice', amount: 100 });
  assert.equal(activeBid.success, true);

  // Wait 1.1s for timer to expire
  await new Promise(resolve => setTimeout(resolve, 1100));

  // Bid after timer expired must be rejected
  const expiredBid = auction.placeBid({ bidderName: 'Bob', amount: 200 });
  assert.equal(expiredBid.success, false);
  assert.equal(expiredBid.code, 'AUCTION_ENDED');
  assert.equal(auction.getState().status, 'ENDED');

  // Manual end also stops bids
  const auction2 = new AuctionEngine({ startingPrice: 100 });
  auction2.start(60);
  auction2.placeBid({ bidderName: 'Charlie', amount: 100 });
  auction2.end('Organizer hammered down');

  const afterManualEndBid = auction2.placeBid({ bidderName: 'David', amount: 200 });
  assert.equal(afterManualEndBid.success, false);
  assert.equal(afterManualEndBid.code, 'AUCTION_ENDED');
});

test('Feature 6: Display the winner', () => {
  const auction = new AuctionEngine({ startingPrice: 500, title: 'Rare Diamond Necklace' });
  auction.start(60);

  auction.placeBid({ bidderName: 'Sophia', amount: 500 });
  auction.placeBid({ bidderName: 'Lucas', amount: 650 });
  auction.placeBid({ bidderName: 'Isabella', amount: 800 });

  const endResult = auction.end('Final Hammer');
  assert.equal(endResult.success, true);
  assert.notEqual(endResult.winner, null);
  assert.equal(endResult.winner.bidderName, 'Isabella');
  assert.equal(endResult.winner.winningBid, 800);
  assert.equal(endResult.winner.totalBids, 3);
  assert.equal(endResult.winner.itemWon, 'Rare Diamond Necklace');

  const state = auction.getState();
  assert.equal(state.status, 'ENDED');
  assert.equal(state.winner.bidderName, 'Isabella');
  assert.equal(state.winner.winningBid, 800);

  // Zero-bid edge case
  const emptyAuction = new AuctionEngine({ startingPrice: 200 });
  emptyAuction.start(60);
  emptyAuction.end('No interest');
  assert.equal(emptyAuction.getState().winner, null);
});
