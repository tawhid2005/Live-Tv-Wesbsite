/* ==========================================
   APP STATE & INITIALIZATION
   ========================================== */
let channels = [];
let filteredChannels = [];
let favorites = [];
let currentCategory = "All";
let currentChannelIndex = -1;
let pendingChannelIndex = -1; // Holds channel play during popup blocker fallback
let displayedCount = 40;       // Number of channels rendered initially for performance
let hlsInstance = null;
let plyrPlayer = null;

// Monetag & Adsterra Direct Links / Smartlinks
const directLinks = [
  "https://omg10.com/4/10867251",
  "https://omg10.com/4/10867541",
  "https://omg10.com/4/10867542",
  "https://www.effectivecpmnetwork.com/u9jcy3x37?key=663f13ecb5bfa7fd621dcc0a388d67e5"
];
let lastAdTime = Date.now(); // Track last ad timestamp
let channelChangeCount = 0;   // Count channel changes
const adCooldownTime = 20 * 60 * 1000; // 20 minutes in ms

// DOM Elements
const appLoader = document.getElementById("appLoader");
const playerLoader = document.getElementById("playerLoader");
const playerError = document.getElementById("playerError");
const videoElement = document.getElementById("player");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const categoryList = document.getElementById("categoryList");
const channelGrid = document.getElementById("channelGrid");
const channelCountBadge = document.getElementById("channelCount");
const gridTitle = document.getElementById("gridTitle");

const currentChannelName = document.getElementById("currentChannelName");
const currentChannelCategory = document.getElementById("currentChannelCategory");
const currentChannelLogo = document.getElementById("currentChannelLogo");
const currentChannelFallback = document.getElementById("currentChannelFallback");
const favoriteBtn = document.getElementById("favoriteBtn");

// Category Icons Mapping
const categoryIcons = {
  "all": "fa-solid fa-globe",
  "favorites": "fa-solid fa-star",
  "fifa26": "fa-solid fa-circle-play",
  "sports": "fa-solid fa-trophy",
  "bangla": "fa-solid fa-language",
  "news": "fa-solid fa-newspaper",
  "kids": "fa-solid fa-child-reaching",
  "indian bangla": "fa-solid fa-tv",
  "entertainment": "fa-solid fa-masks-theater",
  "movies": "fa-solid fa-film",
  "english": "fa-solid fa-globe",
  "religious": "fa-solid fa-hands-praying",
  "hindi": "fa-solid fa-tv",
  "infotainment": "fa-solid fa-circle-info",
  "musics": "fa-solid fa-music",
  "drama": "fa-solid fa-clapperboard",
  "weather": "fa-solid fa-cloud-sun",
  "other": "fa-solid fa-tv"
};

// Colors for fallback initials icons
const fallbackColors = [
  "#6366f1", "#06b6d4", "#ec4899", "#f59e0b", "#10b981", 
  "#8b5cf6", "#3b82f6", "#ef4444", "#14b8a6", "#a855f7"
];

/* ==========================================
   INITIALIZE PLYR PLAYER
   ========================================== */
function initPlayer() {
  plyrPlayer = new Plyr(videoElement, {
    controls: [
      'play-large', 'play', 'mute', 'volume', 
      'settings', 'pip', 'fullscreen'
    ],
    settings: ['quality', 'speed', 'loop'],
    ratio: '16:9'
  });

  // Track errors via video tag directly as backup
  videoElement.addEventListener('error', () => {
    // If native loading fails
    if (!hlsInstance && videoElement.error) {
      showPlayerError();
    }
  });

  // Track playing state to hide loaders
  videoElement.addEventListener('playing', () => {
    playerLoader.classList.add("hidden");
    playerError.classList.add("hidden");
  });

  videoElement.addEventListener('waiting', () => {
    playerLoader.classList.remove("hidden");
  });
}

/* ==========================================
   LOAD DATA & START APP
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize player controls
  initPlayer();

  // 2. Load favorites from localStorage
  loadFavorites();

  // 3. Fetch channel list
  fetchChannels();

  // 4. Bind event listeners
  searchInput.addEventListener("input", handleSearchInput);
  clearSearchBtn.addEventListener("click", clearSearch);
  favoriteBtn.addEventListener("click", toggleFavoriteCurrent);

  // 5. Bind Alternative Server (HD) button (Opens ad directly on click without cooldown)
  const altServerBtn = document.getElementById("altServerBtn");
  if (altServerBtn) {
    altServerBtn.addEventListener("click", () => {
      const randomIndex = Math.floor(Math.random() * directLinks.length);
      window.open(directLinks[randomIndex], "_blank");
    });
  }

  // 6. Popunder Emulator (Triggers ad on very first click on the document)
  document.addEventListener("click", function initPopunder() {
    triggerDirectLink();
    document.removeEventListener("click", initPopunder);
  });

  // 7. Scroll Listener for Infinite Scroll (Improves grid performance)
  const contentArea = document.querySelector(".content-area");
  if (contentArea) {
    contentArea.addEventListener("scroll", () => {
      // Trigger load more when user is 150px from bottom of scrollable area
      if (contentArea.scrollTop + contentArea.clientHeight >= contentArea.scrollHeight - 150) {
        if (displayedCount < filteredChannels.length) {
          displayedCount += 40;
          renderChannels();
        }
      }
    });
  }
});

// 8. Dynamic Delayed Ad Script Loading (Drastically speeds up initial load time)
window.addEventListener("load", () => {
  setTimeout(loadDelayedAds, 2500); // Delay heavy script loading by 2.5 seconds
});

function loadDelayedAds() {
  console.log("Loading non-blocking background ad scripts...");
  
  // Adsterra Popunder Script
  const popunder = document.createElement("script");
  popunder.src = "https://pl29736919.effectivecpmnetwork.com/42/46/3e/42463e1d48ccaa804a3a46d5b48d54f6.js";
  document.body.appendChild(popunder);

  // Adsterra Social Bar Script
  const socialBar = document.createElement("script");
  socialBar.src = "https://pl29736922.effectivecpmnetwork.com/2c/7c/c6/2c7cc68fb62138aaecc833c758e4c3a7.js";
  document.body.appendChild(socialBar);
}

// Load favorites
function loadFavorites() {
  try {
    const saved = localStorage.getItem("alones_tv_favorites");
    if (saved) {
      favorites = JSON.parse(saved);
    }
  } catch (e) {
    console.error("Could not load favorites:", e);
    favorites = [];
  }
}

// Fetch channels JSON
function fetchChannels() {
  fetch("channels.json")
    .then(res => {
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    })
    .then(data => {
      channels = data;
      filteredChannels = [...channels];
      
      // Hide global page loader
      appLoader.classList.add("hidden");
      
      // Render components
      renderCategories();
      renderChannels();
      
      // Auto-play channel
      handleAutoPlay();
    })
    .catch(err => {
      console.error("Failed to load channel database:", err);
      const loadingStatus = document.querySelector(".loading-status");
      if (loadingStatus) {
        loadingStatus.innerHTML = "<span style='color: #ef4444;'><i class='fa-solid fa-circle-exclamation'></i> Failed to load channel database. Please refresh!</span>";
      }
    });
}

/* ==========================================
   CATEGORY & CHANNEL RENDERERS
   ========================================== */
function renderCategories() {
  categoryList.innerHTML = "";
  
  // Calculate counts for each category
  const categoryCounts = {};
  channels.forEach(ch => {
    const catName = ch.category || "Other";
    categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
  });

  // Unique categories list
  const categoriesList = Object.keys(categoryCounts);
  
  // Custom sorting order (FIFA26 and Sports on top, then Bangla, etc.)
  const customOrder = [
    "fifa26",
    "sports",
    "bangla",
    "news",
    "kids",
    "entertainment",
    "movies",
    "english",
    "religious",
    "hindi",
    "infotainment",
    "musics",
    "drama",
    "weather",
    "other"
  ];

  categoriesList.sort((a, b) => {
    let indexA = customOrder.indexOf(a.toLowerCase().trim());
    let indexB = customOrder.indexOf(b.toLowerCase().trim());
    if (indexA === -1) indexA = 99;
    if (indexB === -1) indexB = 99;
    return indexA - indexB;
  });

  // Helper function to build category buttons
  const buildBtn = (name, icon, count, isActive) => {
    const countBadge = count !== null ? `<span class="category-count">${count}</span>` : "";
    const activeClass = isActive ? "active" : "";
    const cleanName = name.toLowerCase().trim() === "fifa26" ? "FIFA" : name;
    
    return `
      <button class="category-pill ${activeClass}" data-category="${name}" onclick="selectCategory('${name}', this)">
        <span><i class="${icon}"></i>${cleanName}</span>
        ${countBadge}
      </button>
    `;
  };

  // Add "All" Category
  categoryList.innerHTML += buildBtn("All", categoryIcons["all"], channels.length, currentCategory === "All");
  
  // Add "Favorites" Category
  categoryList.innerHTML += buildBtn("Favorites", categoryIcons["favorites"], favorites.length, currentCategory === "Favorites");
  
  // Add other categories
  categoriesList.forEach(cat => {
    const lowerCat = cat.toLowerCase().trim();
    const icon = categoryIcons[lowerCat] || categoryIcons["other"];
    const count = categoryCounts[cat];
    categoryList.innerHTML += buildBtn(cat, icon, count, currentCategory === cat);
  });
}

function renderChannels() {
  channelGrid.innerHTML = "";
  
  if (filteredChannels.length === 0) {
    channelGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-regular fa-folder-open" style="font-size: 44px; margin-bottom: 12px; display: block;"></i>
        No channels found matching the search or category.
      </div>
    `;
    channelCountBadge.innerText = "0 channels";
    return;
  }
  
  channelCountBadge.innerText = `${filteredChannels.length} channel${filteredChannels.length > 1 ? 's' : ''}`;
  
  // Slicing by displayedCount for performance / infinite scroll
  const renderList = filteredChannels.slice(0, displayedCount);
  
  renderList.forEach((ch, idx) => {
    const isPlaying = currentChannelIndex !== -1 && filteredChannels[currentChannelIndex].id === ch.id;
    const activeClass = isPlaying ? "active" : "";
    const liveBadge = isPlaying ? `<span class="live-badge">LIVE</span>` : "";
    
    // FALLBACK LOGO GENERATION
    let logoHTML = "";
    if (ch.logo && ch.logo !== "" && !ch.logo.endsWith(".svg")) {
      logoHTML = `<img src="${ch.logo}" alt="${ch.name}" loading="lazy" onerror="handleLogoError(this, '${ch.name}')">`;
    } else {
      const initials = getInitials(ch.name);
      const bg = getFallbackColor(ch.name);
      logoHTML = `<div class="card-fallback" style="background: ${bg}">${initials}</div>`;
    }
    
    channelGrid.innerHTML += `
      <div class="channel-card ${activeClass}" data-id="${ch.id}" onclick="clickChannel(${idx})">
        ${liveBadge}
        <div class="card-logo-container">
          ${logoHTML}
        </div>
        <div class="card-name">${ch.name}</div>
      </div>
    `;
  });
}

function handleLogoError(img, name) {
  const parent = img.parentElement;
  if (!parent) return;
  const initials = getInitials(name);
  const bg = getFallbackColor(name);
  parent.innerHTML = `<div class="card-fallback" style="background: ${bg}">${initials}</div>`;
}

function getInitials(name) {
  if (!name) return "TV";
  const clean = name.replace(/[^A-Za-z0-9 ]/g, '').trim();
  const words = clean.split(" ");
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getFallbackColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % fallbackColors.length;
  return fallbackColors[index];
}

/* ==========================================
   MONETAG AD SYSTEM
   ========================================== */
const adOverlay = document.getElementById("adOverlay");
const adOverlayBtn = document.getElementById("adOverlayBtn");

function triggerDirectLink() {
  const randomIndex = Math.floor(Math.random() * directLinks.length);
  const url = directLinks[randomIndex];
  
  // Open direct link in a new tab
  const win = window.open(url, "_blank");
  if (!win || win.closed || typeof win.closed === 'undefined') {
    // Popup was BLOCKED by browser - Trigger Fallback Overlay Modal
    showAdOverlay(url);
    return false;
  }
  
  try { win.blur(); window.focus(); } catch (e) {}
  return true;
}

function showAdOverlay(adUrl) {
  adOverlay.classList.remove("hidden");
  
  // Clone button to strip existing event listeners cleanly
  const newBtn = adOverlayBtn.cloneNode(true);
  adOverlayBtn.parentNode.replaceChild(newBtn, adOverlayBtn);
  
  newBtn.addEventListener("click", () => {
    // Open ad link (direct user click - browser will NEVER block this)
    window.open(adUrl, "_blank");
    adOverlay.classList.add("hidden");
    
    // Play the channel after they click to watch
    if (pendingChannelIndex !== -1) {
      playChannel(pendingChannelIndex);
      pendingChannelIndex = -1;
    }
  });
}

/* ==========================================
   CHANNEL PLAYBACK LOGIC
   ========================================== */
function clickChannel(filteredIdx) {
  const actualChannel = filteredChannels[filteredIdx];
  // Find index in main channels list
  const mainIdx = channels.findIndex(ch => ch.id === actualChannel.id);
  if (mainIdx === -1) return;

  channelChangeCount++;
  const now = Date.now();
  
  // Rule: Show ad every 8 channel changes OR every 20 minutes
  if (channelChangeCount >= 8 || (now - lastAdTime >= adCooldownTime)) {
    channelChangeCount = 0; // Reset counter
    lastAdTime = now;       // Reset timer
    
    const adOpened = triggerDirectLink();
    if (!adOpened) {
      // Popup blocked - store channel index and wait for overlay click
      pendingChannelIndex = mainIdx;
      return;
    }
  }
  
  playChannel(mainIdx);
}

function playChannel(mainIndex) {
  if (mainIndex < 0 || mainIndex >= channels.length) return;
  
  const ch = channels[mainIndex];
  
  // Highlight active card in grid
  document.querySelectorAll(".channel-card").forEach(card => {
    card.classList.remove("active");
    const badge = card.querySelector(".live-badge");
    if (badge) badge.remove();
    
    if (card.dataset.id === ch.id) {
      card.classList.add("active");
      card.insertAdjacentHTML('afterbegin', `<span class="live-badge">LIVE</span>`);
    }
  });
  
  // Determine index in filteredChannels for tracking state
  currentChannelIndex = filteredChannels.findIndex(fch => fch.id === ch.id);
  
  // Update details panel
  currentChannelName.innerText = ch.name;
  currentChannelCategory.innerText = ch.category;
  
  if (ch.logo && ch.logo !== "" && !ch.logo.endsWith(".svg")) {
    currentChannelLogo.src = ch.logo;
    currentChannelLogo.classList.remove("hidden");
    currentChannelFallback.classList.add("hidden");
  } else {
    currentChannelLogo.classList.add("hidden");
    currentChannelFallback.classList.remove("hidden");
    currentChannelFallback.innerText = getInitials(ch.name);
    currentChannelFallback.style.background = getFallbackColor(ch.name);
  }
  
  // Update favorite star icon
  updateFavoriteButtonState(ch.id);
  
  // Hide previous errors
  playerError.classList.add("hidden");
  playerLoader.classList.remove("hidden");

  // Load HLS Stream
  loadStream(ch.url);

  // Set URL hash for deep linking
  window.location.hash = ch.id;

  // Scroll to player in mobile views
  if (window.innerWidth <= 768) {
    videoElement.scrollIntoView({ behavior: 'smooth' });
  }
}

function loadStream(url) {
  // Clean up existing Hls instance
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (Hls.isSupported()) {
    hlsInstance = new Hls({
      maxMaxBufferLength: 10,
      enableWorker: true,
      lowLatencyMode: true
    });
    
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(videoElement);
    
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      videoElement.play().catch(e => console.log("Play interrupted or blocked:", e));
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error("HLS Network error:", data);
            // Try recovery
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.error("HLS Media error:", data);
            hlsInstance.recoverMediaError();
            break;
          default:
            console.error("HLS Fatal error:", data);
            showPlayerError();
            break;
        }
      }
    });
  } 
  // Native HLS support (Safari, iOS Chrome/Firefox, Apple devices)
  else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    videoElement.src = url;
    videoElement.addEventListener('loadedmetadata', () => {
      videoElement.play().catch(e => console.log("Play interrupted or blocked:", e));
    });
  } 
  // Non-HLS fallback
  else {
    console.error("HLS not supported on this browser.");
    showPlayerError();
  }
}

function showPlayerError() {
  playerLoader.classList.add("hidden");
  playerError.classList.remove("hidden");
}

/* ==========================================
   SEARCH & CATEGORY FILTERS
   ========================================== */
function selectCategory(categoryName, element) {
  currentCategory = categoryName;
  
  // Highlight active category in sidebar
  document.querySelectorAll(".category-pill").forEach(pill => {
    pill.classList.remove("active");
  });
  if (element) {
    element.classList.add("active");
  } else {
    // If called programmatically, find the right button
    const pill = document.querySelector(`.category-pill[data-category="${categoryName}"]`);
    if (pill) pill.classList.add("active");
  }

  // Highlight active bottom nav item (for mobile)
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
    if (item.dataset.nav === categoryName) {
      item.classList.add("active");
    }
  });
  
  // Update Grid Title
  const cleanTitle = categoryName.toLowerCase().trim() === "fifa26" ? "FIFA Streams" : `${categoryName} Channels`;
  gridTitle.innerText = cleanTitle;
  
  // Filter & Render
  filterAndSearch();
  
  // Auto play first channel in the new category
  if (filteredChannels.length > 0) {
    clickChannel(0);
  }
}

/* ==========================================
   MOBILE NAVIGATION
   ========================================== */
function selectNav(navType, element) {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });
  element.classList.add("active");

  if (navType === "Search") {
    searchInput.focus();
    searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    selectCategory(navType);
  }
}

function handleSearchInput() {
  const value = searchInput.value.trim();
  if (value.length > 0) {
    clearSearchBtn.style.display = "block";
  } else {
    clearSearchBtn.style.display = "none";
  }
  
  filterAndSearch();
}

function clearSearch() {
  searchInput.value = "";
  clearSearchBtn.style.display = "none";
  filterAndSearch();
  searchInput.focus();
}

function filterAndSearch() {
  displayedCount = 40; // Reset infinite scroll limit
  const contentArea = document.querySelector(".content-area");
  if (contentArea) contentArea.scrollTop = 0; // Scroll back to top

  const query = searchInput.value.toLowerCase().trim();
  
  filteredChannels = channels.filter(ch => {
    // 1. Category Filter
    let matchesCategory = false;
    if (currentCategory === "All") {
      matchesCategory = true;
    } else if (currentCategory === "Favorites") {
      matchesCategory = favorites.includes(ch.id);
    } else {
      matchesCategory = ch.category === currentCategory;
    }
    
    // 2. Search Query Filter
    let matchesQuery = true;
    if (query !== "") {
      matchesQuery = ch.name.toLowerCase().includes(query) || 
                     (ch.category && ch.category.toLowerCase().includes(query));
    }
    
    return matchesCategory && matchesQuery;
  });
  
  renderChannels();
}

/* ==========================================
   FAVORITES MANAGEMENT
   ========================================== */
function toggleFavoriteCurrent() {
  if (currentChannelIndex === -1 || filteredChannels.length === 0) return;
  
  const ch = filteredChannels[currentChannelIndex];
  const favIndex = favorites.indexOf(ch.id);
  
  if (favIndex === -1) {
    // Add to favorites
    favorites.push(ch.id);
  } else {
    // Remove from favorites
    favorites.splice(favIndex, 1);
  }
  
  // Save to local storage
  localStorage.setItem("alones_tv_favorites", JSON.stringify(favorites));
  
  // Refresh UI
  updateFavoriteButtonState(ch.id);
  renderCategories();
  
  // If we are currently in Favorites category, refresh the grid
  if (currentCategory === "Favorites") {
    filterAndSearch();
  }
}

function updateFavoriteButtonState(channelId) {
  const isFav = favorites.includes(channelId);
  const icon = favoriteBtn.querySelector("i");
  
  if (isFav) {
    favoriteBtn.classList.add("is-favorite");
    icon.className = "fa-solid fa-star";
    favoriteBtn.title = "Remove from Favorites";
  } else {
    favoriteBtn.classList.remove("is-favorite");
    icon.className = "fa-regular fa-star";
    favoriteBtn.title = "Add to Favorites";
  }
}

/* ==========================================
   AUTO PLAY & ROUTING
   ========================================== */
function handleAutoPlay() {
  let targetChannelId = "";
  
  // Check hash link
  const hash = window.location.hash;
  if (hash && hash.startsWith("#ch_")) {
    targetChannelId = hash.substring(1);
    const index = channels.findIndex(ch => ch.id === targetChannelId);
    if (index !== -1) {
      const targetChan = channels[index];
      currentCategory = targetChan.category || "All";
      gridTitle.innerText = currentCategory.toLowerCase().trim() === "fifa26" ? "FIFA Streams" : `${currentCategory} Channels`;
      
      renderCategories();
      filterAndSearch();
    } else {
      targetChannelId = "";
    }
  }
  
  if (!targetChannelId) {
    // If no hash, auto-select IDMAN TV
    const idmanChan = channels.find(ch => ch.id === "ch_119" || ch.name.toLowerCase().includes("idman"));
    if (idmanChan) {
      targetChannelId = idmanChan.id;
      currentCategory = idmanChan.category || "All";
      gridTitle.innerText = currentCategory.toLowerCase().trim() === "fifa26" ? "FIFA Streams" : `${currentCategory} Channels`;
      
      renderCategories();
      filterAndSearch();
    } else {
      // Fallback to FIFA tab if channels are available in it
      const hasFifa = channels.some(ch => ch.category === "FIFA26");
      if (hasFifa) {
        currentCategory = "FIFA26";
        gridTitle.innerText = "FIFA Streams";
        renderCategories();
        filterAndSearch();
      }
    }
  }
  
  // Play the channel
  if (filteredChannels.length > 0) {
    let playIdx = 0;
    if (targetChannelId) {
      const foundIdx = filteredChannels.findIndex(ch => ch.id === targetChannelId);
      if (foundIdx !== -1) {
        playIdx = foundIdx;
      }
    }
    clickChannel(playIdx);
  }
}
