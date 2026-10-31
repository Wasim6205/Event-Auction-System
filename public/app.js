/**
 * Event Auction System - Client Application
 * Authoritative real-time bidding, synchronized clock, audio cues, and multi-device support.
 */

(() => {
  // --- DOM ELEMENT REFERENCES ---
  const el = {
    // Top Bar
    auctionStatusBadge: document.getElementById('auctionStatusBadge'),
    connectedCount: document.getElementById('connectedCount'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    soundIcon: document.getElementById('soundIcon'),
    organizerToggleBtn: document.getElementById('organizerToggleBtn'),
    organizerPanel: document.getElementById('organizerPanel'),
    devicesModalBtn: document.getElementById('devicesModalBtn'),

    // Organizer Controls
    auctionDurationSelect: document.getElementById('auctionDurationSelect'),
    startAuctionBtn: document.getElementById('startAuctionBtn'),
    endAuctionBtn: document.getElementById('endAuctionBtn'),
    resetAuctionBtn: document.getElementById('resetAuctionBtn'),
    editItemBtn: document.getElementById('editItemBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),

    // Bidder Identity
    userAvatar: document.getElementById('userAvatar'),
    bidderNameInput: document.getElementById('bidderNameInput'),
    personaBtns: document.querySelectorAll('.persona-btn'),
    randomPersonaBtn: document.getElementById('randomPersonaBtn'),

    // Banners
    winnerBanner: document.getElementById('winnerBanner'),
    winnerName: document.getElementById('winnerName'),
    winningBidAmount: document.getElementById('winningBidAmount'),
    winningItemName: document.getElementById('winningItemName'),
    winnerPriceBadge: document.getElementById('winnerPriceBadge'),
    winnerAuditCode: document.getElementById('winnerAuditCode'),
    unsoldBanner: document.getElementById('unsoldBanner'),

    // Item Showcase
    itemImage: document.getElementById('itemImage'),
    itemLotBadge: document.getElementById('itemLotBadge'),
    itemCategoryBadge: document.getElementById('itemCategoryBadge'),
    itemTitle: document.getElementById('itemTitle'),
    itemDescription: document.getElementById('itemDescription'),
    itemStartingPrice: document.getElementById('itemStartingPrice'),
    itemEstimate: document.getElementById('itemEstimate'),

    // Timer Card
    timerCard: document.getElementById('timerCard'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerProgressBar: document.getElementById('timerProgressBar'),
    timerSubtitle: document.getElementById('timerSubtitle'),
    timerNotice: document.getElementById('timerNotice'),

    // Highest Bid Spotlight
    highestBidValue: document.getElementById('highestBidValue'),
    highestBidIncrease: document.getElementById('highestBidIncrease'),
    leadingBadge: document.getElementById('leadingBadge'),
    leaderAvatar: document.getElementById('leaderAvatar'),
    leaderName: document.getElementById('leaderName'),
    leaderTimestamp: document.getElementById('leaderTimestamp'),

    // Bidding Form
    minNextBidText: document.getElementById('minNextBidText'),
    quickBidBtns: document.querySelectorAll('.quick-bid-btn'),
    matchMinBtn: document.getElementById('matchMinBtn'),
    bidForm: document.getElementById('bidForm'),
    bidAmountInput: document.getElementById('bidAmountInput'),
    submitBidBtn: document.getElementById('submitBidBtn'),
    bidFeedbackMessage: document.getElementById('bidFeedbackMessage'),

    // History
    totalBidsCount: document.getElementById('totalBidsCount'),
    bidHistoryContainer: document.getElementById('bidHistoryContainer'),
    emptyHistoryNotice: document.getElementById('emptyHistoryNotice'),

    // Modals
    editItemModal: document.getElementById('editItemModal'),
    editItemForm: document.getElementById('editItemForm'),
    modalItemTitle: document.getElementById('modalItemTitle'),
    modalStartingPrice: document.getElementById('modalStartingPrice'),
    modalCategory: document.getElementById('modalCategory'),
    modalImageUrl: document.getElementById('modalImageUrl'),
    modalDescription: document.getElementById('modalDescription'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelEditModalBtn: document.getElementById('cancelEditModalBtn'),

    // Multi-Device Modal
    devicesModal: document.getElementById('devicesModal'),
    closeDevicesModalBtn: document.getElementById('closeDevicesModalBtn'),
    networkQrCode: document.getElementById('networkQrCode'),
    networkUrlInput: document.getElementById('networkUrlInput'),
    copyNetworkUrlBtn: document.getElementById('copyNetworkUrlBtn'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // --- STATE ---
  let currentState = null;
  let isSoundEnabled = localStorage.getItem('auction_sound') !== 'false';
  let audioCtx = null;
  let lastTickSecond = null;
  let cachedNetworkUrl = null;

  // --- UNIQUE DEVICE IDENTIFIER ---
  // Guarantees every browser/device has its own distinct ID for concurrent bidding
  let myBidderId = localStorage.getItem('auction_bidder_id');
  if (!myBidderId) {
    myBidderId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    localStorage.setItem('auction_bidder_id', myBidderId);
  }

  // Pool of default personas so different devices opening for the first time don't get the same name
  const personaPool = [
    'Rahul S.', 'Priya M.', 'Amit K.', 'Sneha R.',
    'Vikram D.', 'Ananya P.', 'Rohan T.', 'Pooja V.',
    'Alice M.', 'Bob K.', 'Charlie V.', 'Diana S.'
  ];

  function getRandomPersona() {
    return personaPool[Math.floor(Math.random() * personaPool.length)];
  }

  // --- AUDIO SYNTHESIZER (Web Audio API) ---
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration = 0.15, type = 'sine', gainVal = 0.1) {
    if (!isSoundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio playback fails silently if browser blocks autoplay
    }
  }

  function soundBidSuccess() {
    if (!isSoundEnabled) return;
    playTone(523.25, 0.1, 'sine', 0.12); // C5
    setTimeout(() => playTone(659.25, 0.1, 'sine', 0.12), 80); // E5
    setTimeout(() => playTone(783.99, 0.2, 'triangle', 0.15), 160); // G5
  }

  function soundBidRejected() {
    if (!isSoundEnabled) return;
    playTone(220, 0.15, 'sawtooth', 0.15);
    setTimeout(() => playTone(180, 0.25, 'sawtooth', 0.18), 120);
  }

  function soundCountdownTick() {
    if (!isSoundEnabled) return;
    playTone(880, 0.04, 'triangle', 0.04);
  }

  function soundAuctionEnded() {
    if (!isSoundEnabled) return;
    playTone(130.81, 0.7, 'triangle', 0.3); // C3 deep gong
    setTimeout(() => {
      playTone(523.25, 0.15, 'sine', 0.15);
      setTimeout(() => playTone(659.25, 0.15, 'sine', 0.15), 100);
      setTimeout(() => playTone(783.99, 0.15, 'sine', 0.15), 200);
      setTimeout(() => playTone(1046.50, 0.4, 'sine', 0.2), 300);
    }, 250);
  }

  // --- SOUND TOGGLE ---
  function updateSoundIcon() {
    if (isSoundEnabled) {
      el.soundIcon.setAttribute('data-lucide', 'volume-2');
      el.soundToggleBtn.classList.remove('opacity-50');
    } else {
      el.soundIcon.setAttribute('data-lucide', 'volume-x');
      el.soundToggleBtn.classList.add('opacity-50');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  el.soundToggleBtn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('auction_sound', isSoundEnabled ? 'true' : 'false');
    updateSoundIcon();
    if (isSoundEnabled) {
      getAudioContext();
      soundBidSuccess();
    }
  });

  // --- ORGANIZER PANEL TOGGLE ---
  el.organizerToggleBtn.addEventListener('click', () => {
    el.organizerPanel.classList.toggle('hidden');
  });

  // --- BIDDER IDENTITY & AVATAR ---
  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function updateBidderIdentity(name) {
    const cleanName = (name || 'Guest Bidder').trim();
    el.bidderNameInput.value = cleanName;
    el.userAvatar.textContent = getInitials(cleanName);
    localStorage.setItem('auction_bidder_name', cleanName);
  }

  // Load saved name or assign a fresh random name for this device
  const savedName = localStorage.getItem('auction_bidder_name') || getRandomPersona();
  updateBidderIdentity(savedName);

  el.bidderNameInput.addEventListener('input', (e) => {
    updateBidderIdentity(e.target.value);
  });

  el.personaBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      updateBidderIdentity(name);
      showToast(`Switched persona to ${name}`, 'info');
    });
  });

  if (el.randomPersonaBtn) {
    el.randomPersonaBtn.addEventListener('click', () => {
      const name = getRandomPersona();
      updateBidderIdentity(name);
      showToast(`Generated new bidder identity: ${name}`, 'info');
    });
  }

  // --- MULTI-DEVICE MODAL LOGIC ---
  function updateNetworkInfo(info) {
    if (!info) return;
    cachedNetworkUrl = info.networkUrl;
    if (el.networkUrlInput) el.networkUrlInput.value = info.networkUrl;
    if (el.networkQrCode) {
      el.networkQrCode.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(info.networkUrl)}`;
    }
  }

  if (el.devicesModalBtn) {
    el.devicesModalBtn.addEventListener('click', () => {
      if (!cachedNetworkUrl) {
        fetch('/api/network-info')
          .then(r => r.json())
          .then(data => updateNetworkInfo(data))
          .catch(() => {});
      }
      el.devicesModal.classList.remove('hidden');
    });
  }

  if (el.closeDevicesModalBtn) {
    el.closeDevicesModalBtn.addEventListener('click', () => {
      el.devicesModal.classList.add('hidden');
    });
  }

  if (el.copyNetworkUrlBtn) {
    el.copyNetworkUrlBtn.addEventListener('click', () => {
      const url = el.networkUrlInput.value;
      if (url) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            showToast('Network URL copied! Open this in any device on your Wi-Fi.', 'success');
          }).catch(() => {
            el.networkUrlInput.select();
            document.execCommand('copy');
            showToast('Network URL copied!', 'success');
          });
        } else {
          el.networkUrlInput.select();
          document.execCommand('copy');
          showToast('Network URL copied!', 'success');
        }
      }
    });
  }

  // --- FORMATTING HELPERS ---
  function formatCurrency(val) {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const borderCol = type === 'error' ? 'border-rose-500 bg-rose-950/90 text-rose-200' :
                      type === 'success' ? 'border-emerald-500 bg-emerald-950/90 text-emerald-200' :
                      'border-slate-700 bg-slate-900/90 text-slate-200';
    
    toast.className = `p-3.5 rounded-xl border shadow-xl text-xs font-semibold backdrop-blur-md flex items-center justify-between space-x-2 pointer-events-auto transition-all transform duration-300 translate-y-2 opacity-0 ${borderCol}`;
    toast.innerHTML = `
      <div class="flex items-center space-x-2">
        <span>${message}</span>
      </div>
      <button class="opacity-70 hover:opacity-100 p-0.5">&times;</button>
    `;

    el.toastContainer.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    const close = () => {
      toast.classList.add('opacity-0', 'translate-x-4');
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('button').addEventListener('click', close);
    setTimeout(close, 4000);
  }

  // --- DISPLAY FEEDBACK IN FORM ---
  function setBidFeedback(message, isError = false) {
    if (!message) {
      el.bidFeedbackMessage.className = 'hidden';
      el.bidFeedbackMessage.innerHTML = '';
      return;
    }

    if (isError) {
      el.bidFeedbackMessage.className = 'p-3 rounded-xl text-xs font-semibold border border-rose-500/40 bg-rose-950/40 text-rose-300 animate-shake flex items-center space-x-2';
      el.bidFeedbackMessage.innerHTML = `
        <span class="inline-block w-2 h-2 rounded-full bg-rose-500 flex-shrink-0"></span>
        <span>${message}</span>
      `;
    } else {
      el.bidFeedbackMessage.className = 'p-3 rounded-xl text-xs font-semibold border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 flex items-center space-x-2';
      el.bidFeedbackMessage.innerHTML = `
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
        <span>${message}</span>
      `;
    }
  }

  // --- CONFETTI CELEBRATION ---
  function fireConfetti() {
    if (typeof window.confetti === 'function') {
      const end = Date.now() + 2 * 1000;
      const colors = ['#f59e0b', '#22c55e', '#fbbf24', '#ffffff'];

      (function frame() {
        window.confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors
        });
        window.confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }
  }

  // --- RENDER MAIN UI STATE ---
  function render(state) {
    if (!state) return;
    currentState = state;

    // 1. Status Badge
    if (state.status === 'ACTIVE') {
      el.auctionStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      el.auctionStatusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>LIVE AUCTION';
      el.startAuctionBtn.disabled = true;
      el.startAuctionBtn.classList.add('opacity-50', 'cursor-not-allowed');
      el.endAuctionBtn.disabled = false;
      el.endAuctionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      el.editItemBtn.disabled = true;
      el.editItemBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else if (state.status === 'ENDED') {
      el.auctionStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30';
      el.auctionStatusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>AUCTION CLOSED';
      el.startAuctionBtn.disabled = false;
      el.startAuctionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      el.endAuctionBtn.disabled = true;
      el.endAuctionBtn.classList.add('opacity-50', 'cursor-not-allowed');
      el.editItemBtn.disabled = false;
      el.editItemBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      el.auctionStatusBadge.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700';
      el.auctionStatusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>IDLE / READY';
      el.startAuctionBtn.disabled = false;
      el.startAuctionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      el.endAuctionBtn.disabled = true;
      el.endAuctionBtn.classList.add('opacity-50', 'cursor-not-allowed');
      el.editItemBtn.disabled = false;
      el.editItemBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    // 2. Item Showcase Details
    el.itemLotBadge.textContent = state.item.lotNumber || 'LOT #101';
    el.itemCategoryBadge.textContent = state.item.category || 'Rare Item';
    el.itemTitle.textContent = state.item.title;
    el.itemDescription.textContent = state.item.description;
    el.itemStartingPrice.textContent = formatCurrency(state.item.startingPrice);
    if (state.item.imageUrl) {
      el.itemImage.src = state.item.imageUrl;
    }

    // 3. Highest Bid Spotlight
    if (state.currentHighestBid) {
      el.highestBidValue.textContent = formatCurrency(state.currentHighestBid.amount);
      el.highestBidIncrease.textContent = `(+${formatCurrency(state.currentHighestBid.increment)})`;
      el.leadingBadge.classList.remove('hidden');

      el.leaderName.textContent = state.currentHighestBid.bidderName;
      el.leaderAvatar.textContent = getInitials(state.currentHighestBid.bidderName);
      el.leaderTimestamp.textContent = `At ${state.currentHighestBid.formattedTime}`;
    } else {
      el.highestBidValue.textContent = formatCurrency(state.startingPrice);
      el.highestBidIncrease.textContent = '(Starting Price)';
      el.leadingBadge.classList.add('hidden');

      el.leaderName.textContent = 'No Bids Yet';
      el.leaderAvatar.textContent = '--';
      el.leaderTimestamp.textContent = 'Waiting for opening bid';
    }

    // 4. Minimum Next Bid Text & Input placeholder
    el.minNextBidText.textContent = formatCurrency(state.minNextBid);
    el.bidAmountInput.placeholder = String(state.minNextBid);
    el.bidAmountInput.min = state.minNextBid;

    // 5. Controls Enabled/Disabled based on status
    const canBid = state.status === 'ACTIVE';
    el.bidAmountInput.disabled = !canBid;
    el.submitBidBtn.disabled = !canBid;
    el.matchMinBtn.disabled = !canBid;
    el.quickBidBtns.forEach(b => b.disabled = !canBid);

    // 6. Winner / Unsold Banners
    if (state.status === 'ENDED') {
      if (state.winner) {
        el.winnerBanner.classList.remove('hidden');
        el.unsoldBanner.classList.add('hidden');
        el.winnerName.textContent = state.winner.bidderName;
        el.winningBidAmount.textContent = formatCurrency(state.winner.winningBid);
        el.winningItemName.textContent = state.winner.itemWon || state.item.title;
        el.winnerPriceBadge.textContent = formatCurrency(state.winner.winningBid);
        el.winnerAuditCode.textContent = `Receipt ID: #${state.winner.bidId || 'LOT-101-WIN'}`;
      } else {
        el.winnerBanner.classList.add('hidden');
        el.unsoldBanner.classList.remove('hidden');
      }
    } else {
      el.winnerBanner.classList.add('hidden');
      el.unsoldBanner.classList.add('hidden');
    }

    // 7. Timer Rendering
    renderTimer(state.remainingSeconds, state.duration, state.status);

    // 8. Bid History List
    renderHistory(state.bids);

    if (window.lucide) window.lucide.createIcons();
  }

  // --- TIMER RENDERING ---
  function renderTimer(remainingSeconds, totalDuration, status) {
    el.timerDisplay.textContent = formatTime(remainingSeconds);

    const safeDuration = totalDuration || 60;
    const pct = status === 'IDLE' ? 100 : Math.max(0, Math.min(100, (remainingSeconds / safeDuration) * 100));
    el.timerProgressBar.style.width = `${pct}%`;

    // Visual styles depending on time remaining
    el.timerDisplay.classList.remove('timer-critical', 'text-amber-400', 'text-emerald-400', 'text-slate-400');
    el.timerProgressBar.classList.remove('bg-rose-500', 'bg-amber-400', 'bg-emerald-500', 'bg-slate-600');

    if (status === 'ENDED') {
      el.timerDisplay.classList.add('text-slate-400');
      el.timerProgressBar.classList.add('bg-slate-600');
      el.timerSubtitle.textContent = 'Auction Closed';
      el.timerNotice.innerHTML = '<i data-lucide="lock" class="w-3.5 h-3.5 text-rose-400"></i><span>Bidding has concluded. Winner determined.</span>';
    } else if (status === 'IDLE') {
      el.timerDisplay.classList.add('text-slate-400');
      el.timerProgressBar.classList.add('bg-slate-600');
      el.timerSubtitle.textContent = 'Ready to Start';
      el.timerNotice.innerHTML = '<i data-lucide="info" class="w-3.5 h-3.5 text-amber-400"></i><span>Waiting for event organizer to start the clock.</span>';
    } else if (remainingSeconds <= 10) {
      el.timerDisplay.classList.add('timer-critical');
      el.timerProgressBar.classList.add('bg-rose-500');
      el.timerSubtitle.textContent = 'Final Seconds!';
      el.timerNotice.innerHTML = '<i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-400 animate-pulse"></i><span class="text-rose-400 font-bold">Closing very soon! Enter highest offer now.</span>';
      
      if (lastTickSecond !== remainingSeconds && remainingSeconds > 0) {
        lastTickSecond = remainingSeconds;
        soundCountdownTick();
      }
    } else if (remainingSeconds <= 30) {
      el.timerDisplay.classList.add('text-amber-400');
      el.timerProgressBar.classList.add('bg-amber-400');
      el.timerSubtitle.textContent = 'Time Running Down';
      el.timerNotice.innerHTML = '<i data-lucide="clock" class="w-3.5 h-3.5 text-amber-400"></i><span>Less than 30s remaining on this lot.</span>';
    } else {
      el.timerDisplay.classList.add('text-emerald-400');
      el.timerProgressBar.classList.add('bg-emerald-500');
      el.timerSubtitle.textContent = 'Bidding Open';
      el.timerNotice.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i><span>All valid bids automatically update timer and leaderboard.</span>';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- BID HISTORY RENDERING ---
  function renderHistory(bids) {
    const list = bids || [];
    el.totalBidsCount.textContent = `${list.length} ${list.length === 1 ? 'Bid' : 'Bids'}`;

    if (list.length === 0) {
      el.emptyHistoryNotice.classList.remove('hidden');
      el.bidHistoryContainer.innerHTML = '';
      el.bidHistoryContainer.appendChild(el.emptyHistoryNotice);
      return;
    }

    el.emptyHistoryNotice.classList.add('hidden');
    el.bidHistoryContainer.innerHTML = '';

    list.forEach((bid, index) => {
      const isLeading = bid.isLeading;
      const isMyBid = (bid.bidderId && bid.bidderId === myBidderId) ||
        (bid.bidderName.trim().toLowerCase() === el.bidderNameInput.value.trim().toLowerCase());

      const row = document.createElement('div');
      row.className = `p-3 rounded-2xl border transition-all flex items-center justify-between text-xs ${
        isLeading
          ? 'bid-leading border-emerald-500/40 bg-emerald-950/20 shadow-sm'
          : 'border-slate-800 bg-slate-950/50 hover:bg-slate-800/40'
      }`;

      row.innerHTML = `
        <div class="flex items-center space-x-3">
          <div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] ${
            isLeading
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }">
            ${isLeading ? '★' : `#${list.length - index}`}
          </div>
          <div>
            <div class="flex items-center space-x-1.5">
              <span class="font-bold text-white">${escapeHtml(bid.bidderName)}</span>
              ${isMyBid ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">You</span>' : ''}
              ${isLeading ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Leading</span>' : ''}
            </div>
            <span class="text-[10px] text-slate-400">${bid.formattedTime}</span>
          </div>
        </div>

        <div class="text-right">
          <div class="font-mono font-bold text-sm ${isLeading ? 'text-emerald-400' : 'text-slate-200'}">
            ${formatCurrency(bid.amount)}
          </div>
          <span class="text-[10px] text-slate-400 font-medium">+${formatCurrency(bid.increment)}</span>
        </div>
      `;

      el.bidHistoryContainer.appendChild(row);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- QUICK INCREMENT BUTTONS ---
  el.quickBidBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentState) return;
      const add = Number(btn.getAttribute('data-add')) || 100;
      const base = currentState.currentHighestBid
        ? currentState.currentHighestBid.amount
        : currentState.startingPrice;
      const target = Math.round((base + add) * 100) / 100;
      el.bidAmountInput.value = target;
      el.bidAmountInput.focus();
    });
  });

  el.matchMinBtn.addEventListener('click', () => {
    if (!currentState) return;
    el.bidAmountInput.value = currentState.minNextBid;
    el.bidAmountInput.focus();
  });

  // --- BID SUBMISSION ---
  el.bidForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setBidFeedback(null);

    const bidderName = el.bidderNameInput.value.trim();
    if (!bidderName) {
      setBidFeedback('Please enter your bidder name first.', true);
      el.bidderNameInput.focus();
      return;
    }

    const amount = Number(el.bidAmountInput.value);
    if (!amount || isNaN(amount) || amount <= 0) {
      setBidFeedback('Please enter a valid positive bid amount.', true);
      el.bidAmountInput.focus();
      return;
    }

    // Client pre-check against current state
    if (currentState) {
      if (currentState.status !== 'ACTIVE') {
        setBidFeedback('Auction is not currently active.', true);
        soundBidRejected();
        return;
      }

      if (currentState.currentHighestBid) {
        const minIncrement = currentState.minIncrement || 100;
        const minRequired = Math.round((currentState.currentHighestBid.amount + minIncrement) * 100) / 100;
        if (amount < minRequired) {
          setBidFeedback(`Bid of ${formatCurrency(amount)} rejected: Every new bid must be at least ₹${minIncrement} higher than current highest bid of ${formatCurrency(currentState.currentHighestBid.amount)} (minimum required: ${formatCurrency(minRequired)}).`, true);
          soundBidRejected();
          return;
        }
      }

      if (amount < currentState.startingPrice) {
        setBidFeedback(`Bid of ${formatCurrency(amount)} is below the starting price of ${formatCurrency(currentState.startingPrice)}.`, true);
        soundBidRejected();
        return;
      }
    }

    // Send through WebSocket to server with unique device bidderId
    socket.emit('place_bid', { bidderId: myBidderId, bidderName, amount }, (response) => {
      if (!response.success) {
        setBidFeedback(response.reason, true);
        soundBidRejected();
      } else {
        setBidFeedback(`Bid of ${formatCurrency(amount)} accepted! You are currently leading.`, false);
        el.bidAmountInput.value = '';
      }
    });
  });

  // --- ORGANIZER ACTIONS ---
  el.startAuctionBtn.addEventListener('click', () => {
    const duration = Number(el.auctionDurationSelect.value) || 60;
    socket.emit('start_auction', { duration }, (res) => {
      if (!res.success) {
        showToast(res.reason, 'error');
      } else {
        showToast(`Auction started! Clock running for ${duration}s.`, 'success');
      }
    });
  });

  el.endAuctionBtn.addEventListener('click', () => {
    if (!confirm('Are you sure you want to bring down the final hammer and close the auction immediately?')) {
      return;
    }
    socket.emit('end_auction', { reason: 'Final hammer by organizer' }, (res) => {
      if (!res.success) {
        showToast(res.reason, 'error');
      } else {
        showToast('Auction hammered down and closed.', 'info');
      }
    });
  });

  el.resetAuctionBtn.addEventListener('click', () => {
    if (!confirm('Reset the auction to starting state? All current bids on this item will be cleared.')) {
      return;
    }
    socket.emit('reset_auction', {}, (res) => {
      showToast('Auction state reset successfully.', 'info');
    });
  });

  // --- EDIT ITEM MODAL ---
  el.editItemBtn.addEventListener('click', () => {
    if (!currentState) return;
    el.modalItemTitle.value = currentState.item.title;
    el.modalStartingPrice.value = currentState.item.startingPrice;
    el.modalCategory.value = currentState.item.category || '';
    el.modalImageUrl.value = currentState.item.imageUrl || '';
    el.modalDescription.value = currentState.item.description || '';
    el.editItemModal.classList.remove('hidden');
  });

  const closeModal = () => el.editItemModal.classList.add('hidden');
  el.closeModalBtn.addEventListener('click', closeModal);
  el.cancelEditModalBtn.addEventListener('click', closeModal);

  el.editItemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const updates = {
      title: el.modalItemTitle.value.trim(),
      startingPrice: Number(el.modalStartingPrice.value),
      category: el.modalCategory.value.trim(),
      imageUrl: el.modalImageUrl.value.trim(),
      description: el.modalDescription.value.trim()
    };

    socket.emit('update_item', updates, (res) => {
      if (!res.success) {
        showToast(res.reason, 'error');
      } else {
        showToast('Item details updated.', 'success');
        closeModal();
      }
    });
  });

  // --- SOCKET.IO REAL-TIME EVENTS ---
  const socket = io();

  socket.on('connect', () => {
    console.log('Connected to Event Auction System backend.');
  });

  socket.on('participant_count', (data) => {
    if (data?.count) {
      el.connectedCount.textContent = data.count;
    }
  });

  socket.on('initial_state', (data) => {
    if (data?.connectedCount) {
      el.connectedCount.textContent = data.connectedCount;
    }
    if (data?.networkInfo) {
      updateNetworkInfo(data.networkInfo);
    }
    render(data?.state);
  });

  socket.on('timer_tick', (data) => {
    if (currentState) {
      currentState.remainingSeconds = data.remainingSeconds;
      currentState.status = data.status;
      renderTimer(data.remainingSeconds, currentState.duration, data.status);
    }
  });

  socket.on('bid_accepted', (data) => {
    soundBidSuccess();
    render(data.state);

    const isMyBid = (data.bid.bidderId && data.bid.bidderId === myBidderId) ||
      data.bid.bidderName.trim().toLowerCase() === el.bidderNameInput.value.trim().toLowerCase();

    if (isMyBid) {
      showToast(`Your bid of ${formatCurrency(data.bid.amount)} was accepted!`, 'success');
      setBidFeedback(`Your bid of ${formatCurrency(data.bid.amount)} was accepted! You are now leading.`, false);
    } else {
      showToast(`New highest bid: ${formatCurrency(data.bid.amount)} by ${data.bid.bidderName}`, 'info');
    }
  });

  socket.on('bid_rejected', (data) => {
    soundBidRejected();
    setBidFeedback(data.reason, true);
    showToast(data.reason, 'error');
  });

  socket.on('auction_started', (data) => {
    soundBidSuccess();
    setBidFeedback(null);
    render(data.state);
    showToast('Auction has officially started! Bids are open.', 'success');
  });

  socket.on('auction_ended', (data) => {
    soundAuctionEnded();
    render(data.state);
    if (data.winner) {
      fireConfetti();
      showToast(`AUCTION CLOSED! Winner is ${data.winner.bidderName} at ${formatCurrency(data.winner.winningBid)}!`, 'success');
    } else {
      showToast('Auction closed with no bids placed.', 'info');
    }
  });

  socket.on('auction_reset', (data) => {
    setBidFeedback(null);
    render(data.state);
    showToast('Auction reset to initial state.', 'info');
  });

  socket.on('item_updated', (data) => {
    render(data.state);
    showToast('Item details refreshed.', 'info');
  });

  // Initial sound icon render
  updateSoundIcon();
})();
