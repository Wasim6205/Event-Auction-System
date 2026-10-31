/**
 * Auction Engine
 * Core domain logic for single-item timed auctions.
 * Enforces strict bid validation, timer boundaries, minimum increments (₹100), and winner determination.
 */

class AuctionEngine {
  constructor(initialItem = null, options = {}) {
    this.defaultDuration = options.defaultDuration || 90; // 90 seconds default
    this.minIncrement = options.minIncrement !== undefined ? Number(options.minIncrement) : 100; // Minimum ₹100 increment
    this.reset(initialItem);
  }

  /**
   * Reset or reconfigure the auction item and state
   */
  reset(itemConfig = null) {
    const defaultItem = {
      id: 'LOT-101',
      title: 'Vintage 1968 Rolex Submariner Ref. 5513',
      description: 'Original matte meters-first dial, stainless steel Oyster bracelet, verified museum-grade provenance with complete box and papers.',
      startingPrice: 500,
      estimatedValue: '₹1,20,000 - ₹1,80,000',
      category: 'Horology / Rare Collectibles',
      lotNumber: 'LOT #101',
      imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&q=80'
    };

    this.item = {
      ...defaultItem,
      ...(itemConfig || {})
    };

    // Ensure starting price is a valid positive number
    this.item.startingPrice = Math.max(1, Number(this.item.startingPrice) || 500);

    this.status = 'IDLE'; // 'IDLE' | 'ACTIVE' | 'ENDED'
    this.duration = this.defaultDuration;
    this.startTime = null;
    this.endTime = null;
    this.bids = [];
    this.currentHighestBid = null;
    this.winner = null;
    this.endedAt = null;

    return this.getState();
  }

  /**
   * Update item information (only permitted when auction is IDLE)
   */
  updateItem(updates) {
    if (this.status === 'ACTIVE') {
      return { success: false, reason: 'Cannot modify item details while auction is active.' };
    }

    if (updates.title) this.item.title = updates.title.trim();
    if (updates.description) this.item.description = updates.description.trim();
    if (updates.imageUrl) this.item.imageUrl = updates.imageUrl.trim();
    if (updates.category) this.item.category = updates.category.trim();
    if (updates.startingPrice !== undefined) {
      const price = Number(updates.startingPrice);
      if (isNaN(price) || price <= 0) {
        return { success: false, reason: 'Starting price must be a positive number.' };
      }
      this.item.startingPrice = price;
    }
    if (updates.minIncrement !== undefined) {
      const inc = Number(updates.minIncrement);
      if (!isNaN(inc) && inc > 0) {
        this.minIncrement = inc;
      }
    }

    return { success: true, item: this.item };
  }

  /**
   * Start the timed auction
   * @param {number} [durationSeconds] - Optional custom duration in seconds
   */
  start(durationSeconds) {
    if (this.status === 'ACTIVE') {
      return { success: false, reason: 'Auction is already active.' };
    }

    const duration = Number(durationSeconds) || this.duration || this.defaultDuration;
    if (duration <= 0) {
      return { success: false, reason: 'Duration must be greater than 0 seconds.' };
    }

    this.duration = duration;
    this.startTime = Date.now();
    this.endTime = this.startTime + (duration * 1000);
    this.status = 'ACTIVE';
    this.bids = [];
    this.currentHighestBid = null;
    this.winner = null;
    this.endedAt = null;

    return {
      success: true,
      state: this.getState()
    };
  }

  /**
   * Evaluate if time has run out, and automatically finalize auction if so
   */
  checkExpiration() {
    if (this.status === 'ACTIVE' && Date.now() >= this.endTime) {
      this.end('Timer expired');
      return true;
    }
    return false;
  }

  /**
   * End the auction immediately (organizer hammer or timer expiration)
   */
  end(reason = 'Ended by organizer') {
    if (this.status === 'ENDED') {
      return { success: false, reason: 'Auction is already ended.' };
    }

    this.status = 'ENDED';
    this.endedAt = Date.now();

    if (this.currentHighestBid) {
      this.winner = {
        bidderName: this.currentHighestBid.bidderName,
        winningBid: this.currentHighestBid.amount,
        bidId: this.currentHighestBid.id,
        timestamp: this.currentHighestBid.timestamp,
        formattedTime: this.currentHighestBid.formattedTime,
        itemWon: this.item.title,
        lotNumber: this.item.lotNumber,
        totalBids: this.bids.length,
        reason
      };
    } else {
      this.winner = null; // Unsold / No bids
    }

    return {
      success: true,
      winner: this.winner,
      state: this.getState()
    };
  }

  /**
   * Place a bid on the item
   * Requirement: Every new bid must be at least ₹100 higher than the current highest bid.
   * @param {Object} bidParams - { bidderName, amount }
   */
  placeBid({ bidderName, amount }) {
    // 1. Check expiration first
    this.checkExpiration();

    // 2. Validate auction status
    if (this.status === 'IDLE') {
      return {
        success: false,
        code: 'AUCTION_NOT_STARTED',
        reason: 'Auction has not started yet. Please wait for the organizer to open bidding.'
      };
    }

    if (this.status === 'ENDED') {
      return {
        success: false,
        code: 'AUCTION_ENDED',
        reason: 'Auction has ended. No further bids can be accepted.'
      };
    }

    // 3. Validate bidder name
    const cleanName = (bidderName || '').trim();
    if (!cleanName) {
      return {
        success: false,
        code: 'INVALID_BIDDER',
        reason: 'Bidder name is required.'
      };
    }

    // 4. Validate bid amount format
    const numAmount = Number(amount);
    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
      return {
        success: false,
        code: 'INVALID_AMOUNT',
        reason: 'Bid amount must be a valid positive number.'
      };
    }

    // Standardize to 2 decimal places
    const cleanAmount = Math.round(numAmount * 100) / 100;

    // 5. Validate against starting price
    if (cleanAmount < this.item.startingPrice) {
      return {
        success: false,
        code: 'BELOW_STARTING_PRICE',
        reason: `Bid of ₹${cleanAmount.toLocaleString('en-IN')} is below the starting price of ₹${this.item.startingPrice.toLocaleString('en-IN')}.`
      };
    }

    // 6. Validate against current highest bid:
    // MUST BE AT LEAST ₹100 HIGHER than current highest bid
    if (this.currentHighestBid) {
      const minRequired = Math.round((this.currentHighestBid.amount + this.minIncrement) * 100) / 100;
      if (cleanAmount < minRequired) {
        return {
          success: false,
          code: 'BID_TOO_LOW',
          minRequired,
          minIncrement: this.minIncrement,
          reason: `Bid of ₹${cleanAmount.toLocaleString('en-IN')} rejected: Every new bid must be at least ₹${this.minIncrement} higher than the current highest bid of ₹${this.currentHighestBid.amount.toLocaleString('en-IN')} (minimum required bid is ₹${minRequired.toLocaleString('en-IN')}).`,
          currentHighestBid: this.currentHighestBid.amount
        };
      }
    }

    // Calculate increment over previous amount
    const previousBase = this.currentHighestBid
      ? this.currentHighestBid.amount
      : this.item.startingPrice;
    const increment = Math.round((cleanAmount - previousBase) * 100) / 100;

    // 7. Accept the bid
    const bidRecord = {
      id: `bid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bidderName: cleanName,
      amount: cleanAmount,
      timestamp: Date.now(),
      formattedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      increment: increment > 0 ? increment : cleanAmount - this.item.startingPrice,
      isLeading: true
    };

    // Update prior bids isLeading to false
    this.bids.forEach(b => { b.isLeading = false; });

    this.bids.unshift(bidRecord); // Newest first
    this.currentHighestBid = bidRecord;

    return {
      success: true,
      bid: bidRecord,
      state: this.getState()
    };
  }

  /**
   * Get the remaining time in seconds
   */
  getRemainingSeconds() {
    if (this.status === 'IDLE') return this.duration;
    if (this.status === 'ENDED') return 0;
    const remaining = Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
    if (remaining === 0 && this.status === 'ACTIVE') {
      this.checkExpiration();
    }
    return remaining;
  }

  /**
   * Get complete snapshot of the auction state
   */
  getState() {
    const remainingSeconds = this.getRemainingSeconds();

    return {
      status: this.status,
      item: { ...this.item },
      currentHighestBid: this.currentHighestBid ? { ...this.currentHighestBid } : null,
      startingPrice: this.item.startingPrice,
      minIncrement: this.minIncrement,
      totalBids: this.bids.length,
      bids: this.bids.map(b => ({ ...b })),
      duration: this.duration,
      remainingSeconds,
      startTime: this.startTime,
      endTime: this.endTime,
      endedAt: this.endedAt,
      winner: this.winner ? { ...this.winner } : null,
      minNextBid: this.currentHighestBid
        ? Math.round((this.currentHighestBid.amount + this.minIncrement) * 100) / 100
        : this.item.startingPrice
    };
  }
}

module.exports = AuctionEngine;
