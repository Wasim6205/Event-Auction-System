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

  const res2 = auction.placeBid({ bidderName: 'Bob', amount: 250 });
  assert.equal(res2.success, true);
  assert.equal(res2.bid.bidderName, 'Bob');
  assert.equal(res2.bid.amount, 250);

  const state = auction.getState();
  assert.equal(state.totalBids, 2);
  assert.equal(state.currentHighestBid.bidderName, 'Bob');
  assert.equal(state.currentHighestBid.amount, 250);
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
  assert.match(equalBidRes.reason, /Must exceed the current highest bid/i);

  // Higher bid succeeds
  const higherBidRes = auction.placeBid({ bidderName: 'David', amount: 350 });
  assert.equal(higherBidRes.success, true);
  assert.equal(higherBidRes.bid.amount, 350);

  // Rejection 3: Lower than current highest bid (320 < 350, but above starting price)
  const lowerBidRes = auction.placeBid({ bidderName: 'Charlie', amount: 320 });
  assert.equal(lowerBidRes.success, false);
  assert.equal(lowerBidRes.code, 'BID_TOO_LOW');
  assert.match(lowerBidRes.reason, /Must exceed the current highest bid/i);

  // Rejection 4: Attempting to bid lower than new highest (340 < 350)
  const rejectedAgain = auction.placeBid({ bidderName: 'Eve', amount: 340 });
  assert.equal(rejectedAgain.success, false);
  assert.equal(rejectedAgain.code, 'BID_TOO_LOW');
});

test('Feature 4: Display current highest bid and bid history', () => {
  const auction = new AuctionEngine({ startingPrice: 100 });
  auction.start(60);

  auction.placeBid({ bidderName: 'Alice', amount: 150 });
  auction.placeBid({ bidderName: 'Bob', amount: 200 });
  auction.placeBid({ bidderName: 'Charlie', amount: 300 });

  const state = auction.getState();

  // Current highest bid check
  assert.equal(state.currentHighestBid.bidderName, 'Charlie');
  assert.equal(state.currentHighestBid.amount, 300);

  // Bid history check (newest first)
  assert.equal(state.bids.length, 3);
  assert.equal(state.bids[0].bidderName, 'Charlie');
  assert.equal(state.bids[0].amount, 300);
  assert.equal(state.bids[0].isLeading, true);

  assert.equal(state.bids[1].bidderName, 'Bob');
  assert.equal(state.bids[1].amount, 200);
  assert.equal(state.bids[1].isLeading, false);

  assert.equal(state.bids[2].bidderName, 'Alice');
  assert.equal(state.bids[2].amount, 150);
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
  const activeBid = auction.placeBid({ bidderName: 'Alice', amount: 120 });
  assert.equal(activeBid.success, true);

  // Wait 1.1s for timer to expire
  await new Promise(resolve => setTimeout(resolve, 1100));

  // Bid after timer expired must be rejected
  const expiredBid = auction.placeBid({ bidderName: 'Bob', amount: 150 });
  assert.equal(expiredBid.success, false);
  assert.equal(expiredBid.code, 'AUCTION_ENDED');
  assert.equal(auction.getState().status, 'ENDED');

  // Manual end also stops bids
  const auction2 = new AuctionEngine({ startingPrice: 100 });
  auction2.start(60);
  auction2.placeBid({ bidderName: 'Charlie', amount: 110 });
  auction2.end('Organizer hammered down');

  const afterManualEndBid = auction2.placeBid({ bidderName: 'David', amount: 200 });
  assert.equal(afterManualEndBid.success, false);
  assert.equal(afterManualEndBid.code, 'AUCTION_ENDED');
});

test('Feature 6: Display the winner', () => {
  const auction = new AuctionEngine({ startingPrice: 500, title: 'Rare Diamond Necklace' });
  auction.start(60);

  auction.placeBid({ bidderName: 'Sophia', amount: 600 });
  auction.placeBid({ bidderName: 'Lucas', amount: 750 });
  auction.placeBid({ bidderName: 'Isabella', amount: 900 });

  const endResult = auction.end('Final Hammer');
  assert.equal(endResult.success, true);
  assert.notEqual(endResult.winner, null);
  assert.equal(endResult.winner.bidderName, 'Isabella');
  assert.equal(endResult.winner.winningBid, 900);
  assert.equal(endResult.winner.totalBids, 3);
  assert.equal(endResult.winner.itemWon, 'Rare Diamond Necklace');

  const state = auction.getState();
  assert.equal(state.status, 'ENDED');
  assert.equal(state.winner.bidderName, 'Isabella');
  assert.equal(state.winner.winningBid, 900);

  // Zero-bid edge case
  const emptyAuction = new AuctionEngine({ startingPrice: 200 });
  emptyAuction.start(60);
  emptyAuction.end('No interest');
  assert.equal(emptyAuction.getState().winner, null);
});
