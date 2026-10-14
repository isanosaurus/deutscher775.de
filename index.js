// ── Shared helpers ──
const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function readStore(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode, cookies off): the banner just won't be cached.
  }
}

// ── Loading screen ──
// Shown only on a first visit (no cached banner), and never longer than
// LOADER_MAX_MS. The page content is always in the DOM underneath it, so a
// slow or dead presence API can delay the reveal but never block it.
const LOADER_MAX_MS = 3000;
const BANNER_TIMEOUT_MS = 6000;
const BANNER_URL = "https://api.deutscher775.de/presence/690123872674119710/banner";

const messages = [
  { main: "We're getting things ready for you", sub: "" },
  { main: "This might take a few seconds", sub: "Don't close this page" },
];
let messageIndex = 0;
let messageTimer = null;

function showNextMessage() {
  const mainText = document.getElementById("mainText");
  const subText = document.getElementById("subText");
  if (!mainText || !subText || root.classList.contains("is-ready")) return;
  const { main, sub } = messages[messageIndex];
  mainText.style.opacity = 0;
  subText.style.opacity = 0;
  messageTimer = setTimeout(() => {
    mainText.textContent = main;
    subText.textContent = sub;
    mainText.style.animation = "none";
    subText.style.animation = "none";
    void mainText.offsetWidth;
    const anim =
      messageIndex === messages.length - 1
        ? "loaderfade 2s ease-in-out forwards"
        : "loaderfadeinout 2s ease-in-out forwards";
    mainText.style.animation = anim;
    subText.style.animation = anim;
    messageIndex++;
    if (messageIndex < messages.length) messageTimer = setTimeout(showNextMessage, 2000);
  }, 500);
}

function revealPage() {
  if (root.classList.contains("is-ready")) return;
  root.classList.add("is-ready");
  clearTimeout(messageTimer);
  const loadingScreen = document.getElementById("loading-screen");
  if (!loadingScreen || loadingScreen.style.display === "none") return;
  const hide = () => (loadingScreen.style.display = "none");
  if (reduceMotion) return hide();
  loadingScreen.addEventListener("animationend", hide, { once: true });
  loadingScreen.style.animation = "fadeOut 0.5s forwards";
  setTimeout(hide, 600);
}

const cachedBanner = readStore("banner_url");
if (cachedBanner || root.classList.contains("skip-loader")) {
  revealPage();
} else {
  messageTimer = setTimeout(showNextMessage, 1000);
  setTimeout(revealPage, LOADER_MAX_MS);
}

// ── Live hero banner (Discord presence) ──
function showBanner(url) {
  const heroBanner = document.getElementById("hero-banner");
  if (!heroBanner || !url) return;
  heroBanner.addEventListener("load", () => (heroBanner.style.opacity = 1), { once: true });
  heroBanner.addEventListener("error", () => (heroBanner.style.opacity = 0), { once: true });
  heroBanner.src = url;
}

showBanner(cachedBanner);

(async function refreshBanner() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BANNER_TIMEOUT_MS);
  try {
    const response = await fetch(BANNER_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const bannerUrl = typeof data.banner === "string" ? data.banner : "";
    if (bannerUrl && bannerUrl !== cachedBanner) {
      writeStore("banner_url", bannerUrl);
      showBanner(bannerUrl);
    }
  } catch (error) {
    console.warn("Presence banner unavailable:", error.message);
  } finally {
    clearTimeout(timeout);
    revealPage();
  }
})();

// ── Nav: scroll state, mobile menu ──
document.addEventListener("DOMContentLoaded", function () {
  const navStrip = document.querySelector(".nav-strip");
  if (navStrip) {
    const onScroll = () => navStrip.classList.toggle("is-scrolled", window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  const mobileMenuButton = document.getElementById("mobile-menu-button");
  const mobileMenu = document.getElementById("mobile-menu");
  const setMenu = (open) => {
    if (!mobileMenu || !mobileMenuButton) return;
    mobileMenu.classList.toggle("is-open", open);
    mobileMenuButton.setAttribute("aria-expanded", String(open));
    const icon = mobileMenuButton.querySelector(".mobile-menu-icon");
    if (icon) icon.setAttribute("d", open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16");
  };

  mobileMenuButton?.addEventListener("click", () =>
    setMenu(!mobileMenu.classList.contains("is-open")),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileMenu?.classList.contains("is-open")) {
      setMenu(false);
      mobileMenuButton.focus();
    }
  });

  // In-page anchors: smooth scroll (instant under reduced motion), close the menu.
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const id = this.getAttribute("href");
      const target = id.length > 1 ? document.querySelector(id) : null;
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", id);
      }
      setMenu(false);
    });
  });
  document.querySelectorAll(".nav-link").forEach((link) =>
    link.addEventListener("click", () => setMenu(false)),
  );
});

// ── Age readout (About section) ──
document.addEventListener("DOMContentLoaded", function () {
  const age = document.getElementById("age");
  if (!age) return;
  const birth = new Date(2006, 10, 29); // November 29, 2006
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  age.textContent = `${years}-year-old`;
});

// ── Project filter ──
document.addEventListener("DOMContentLoaded", function () {
  const filterButtons = document.querySelectorAll(".filter-btn");
  const projectCards = document.querySelectorAll(".scene-panel");
  const hideTimers = new Map();

  projectCards.forEach((card) => {
    card.style.transition = "opacity 0.3s ease, transform 0.3s ease, border-color 0.25s ease";
  });

  filterButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
    button.addEventListener("click", function () {
      const filter = this.getAttribute("data-filter");
      filterButtons.forEach((btn) => {
        btn.classList.toggle("is-active", btn === this);
        btn.setAttribute("aria-pressed", String(btn === this));
      });

      projectCards.forEach((card) => {
        const categories = (card.getAttribute("data-category") || "").split(" ");
        const shouldShow = filter === "all" || categories.includes(filter);
        clearTimeout(hideTimers.get(card));
        if (shouldShow) {
          card.hidden = false;
          requestAnimationFrame(() => {
            card.style.opacity = "1";
            card.style.transform = "none";
          });
        } else {
          card.style.opacity = "0";
          card.style.transform = "translateY(12px)";
          hideTimers.set(
            card,
            setTimeout(() => (card.hidden = true), reduceMotion ? 0 : 300),
          );
        }
      });
    });
  });
});

// ── Scroll reveal + footer year ──
document.addEventListener("DOMContentLoaded", function () {
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );
    reveals.forEach((el) => revealObserver.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  const yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const backToTop = document.getElementById("back-to-top");
  if (backToTop) {
    window.addEventListener(
      "scroll",
      () => backToTop.classList.toggle("show", window.scrollY > 600),
      { passive: true },
    );
    backToTop.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }),
    );
  }
});

// ── Floating throwable tech icons (skills section easter egg) ──
const thrownIcons = new Set();

function startMouseShake() {
  if (reduceMotion) return;
  const originalCursor = document.body.style.cursor;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes mouseShake {
      0%, 100% { transform: translate(0, 0); }
      10% { transform: translate(-2px, -1px); }
      20% { transform: translate(2px, -2px); }
      30% { transform: translate(-1px, 2px); }
      40% { transform: translate(1px, -1px); }
      50% { transform: translate(-2px, 1px); }
      60% { transform: translate(2px, 1px); }
      70% { transform: translate(-1px, -2px); }
      80% { transform: translate(1px, 2px); }
      90% { transform: translate(-2px, -1px); }
    }
    .mouse-shake {
      animation: mouseShake 0.1s infinite;
      cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><text y="24" font-size="24">⚡</text></svg>') 16 16, auto !important;
    }
  `;
  document.head.appendChild(style);
  document.body.classList.add("mouse-shake");
  setTimeout(() => {
    document.body.classList.remove("mouse-shake");
    document.head.removeChild(style);
    document.body.style.cursor = originalCursor;
  }, 1000);
}

// "Broken screen" gag from the 💻 floater. Flash-safe by construction: no
// saturated red, no repeating brightness pulse, one short jolt on arrival,
// never stacks, Escape clears it early, skipped entirely under reduced motion.
let activeCracks = null;

function createScreenCracks() {
  if (reduceMotion || activeCracks) return;

  const container = document.createElement("div");
  container.className = "screen-cracks-container";
  container.setAttribute("aria-hidden", "true");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";

  const colors = ["#00e5ff", "#39ff88", "#3355ff", "#f5f2f3", "#000000"];
  const stripes = [];
  for (let i = 0; i < 8; i++) {
    const stripe = document.createElement("div");
    const horizontal = Math.random() > 0.3;
    const thickness = Math.random() * 20 + 15;
    const position = Math.random() * 100;
    const color = colors[Math.floor(Math.random() * colors.length)];
    stripe.style.cssText = horizontal
      ? `position:absolute;top:${position}%;left:0;width:100%;height:${thickness}px;background:${color};`
      : `position:absolute;top:0;left:${position}%;width:${thickness}px;height:100%;background:${color};`;
    stripe.dataset.axis = horizontal ? "y" : "x";
    container.appendChild(stripe);
    stripes.push(stripe);
  }

  document.body.appendChild(container);
  container.animate(
    [
      { transform: "translate(0, 0)" },
      { transform: "translate(-3px, 1px)" },
      { transform: "translate(2px, -1px)" },
      { transform: "translate(0, 0)" },
    ],
    { duration: 180, easing: "steps(3, end)" },
  );

  const clear = () => {
    if (activeCracks !== container) return;
    activeCracks = null;
    clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    stripes.forEach((stripe, i) => {
      stripe.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: stripe.dataset.axis === "y" ? "scaleY(0)" : "scaleX(0)" },
        ],
        { duration: 300, delay: i * 60, easing: "ease-in", fill: "forwards" },
      );
    });
    setTimeout(() => container.remove(), 300 + stripes.length * 60);
  };
  const onKey = (e) => e.key === "Escape" && clear();
  const timer = setTimeout(clear, 6000);
  document.addEventListener("keydown", onKey);
  activeCracks = container;
}

// ── Floaters: drift with transforms only (no layout work per frame) ──
const floaterPos = new WeakMap();

function floaterBounds(el) {
  const box = el.parentElement;
  return { w: box.clientWidth, h: box.clientHeight };
}

function moveFloater(el, x, y, rotation, scale, transition) {
  floaterPos.set(el, { x, y, rotation });
  el.style.transition = transition;
  el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
}

function randomSpot(el) {
  const { w, h } = floaterBounds(el);
  return {
    x: Math.random() * Math.max(w - 80, 0),
    y: Math.random() * Math.max(h - 200, 0) + 100,
  };
}

function initializeIcons() {
  document.querySelectorAll(".floater").forEach((el, index) => {
    el.style.left = "0";
    el.style.top = "0";
    el.style.willChange = "transform";

    if (reduceMotion) {
      const { x, y } = randomSpot(el);
      el.style.opacity = "0.55";
      moveFloater(el, x, y, Math.random() * 40 - 20, 1, "none");
      return;
    }

    const { w, h } = floaterBounds(el);
    const side = Math.floor(Math.random() * 4);
    const startX = side === 1 ? w + 150 : side === 3 ? -150 : Math.random() * w;
    const startY = side === 0 ? -150 : side === 2 ? h + 150 : Math.random() * h;
    el.style.opacity = "0";
    moveFloater(el, startX, startY, Math.random() * 360, 0.5, "none");
    setTimeout(() => flyInIcon(el), index * 300 + Math.random() * 500);
  });
}

function flyInIcon(el) {
  const { x, y } = randomSpot(el);
  el.style.opacity = "0.55";
  moveFloater(
    el,
    x,
    y,
    Math.random() * 360,
    1,
    "transform 2s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 2s ease",
  );
  setTimeout(() => randomFloat(el), 2000);
}

function randomFloat(el) {
  if (reduceMotion || thrownIcons.has(el)) return;
  const { x, y } = randomSpot(el);
  moveFloater(el, x, y, Math.random() * 360, 1, "transform 10s ease-in-out");
}

function throwIcon(el, event) {
  event.stopPropagation();
  if (el.textContent.trim() !== "⚡") {
    setTimeout(() => {
      const audio1 = new Audio("./vine-boom.mp3");
      const audio2 = new Audio("./AHhHhhh.mp3");
      audio1.volume = 0.1;
      audio2.volume = 0.05;
      if (Math.random() < 0.5) audio1.play().catch(console.error);
      else audio2.play().catch(console.error);
    }, 100);
  } else {
    setTimeout(() => {
      const audio = new Audio("./bzzzzzz.mp3");
      audio.volume = 0.01;
      audio.play().catch(console.error);
    }, 100);
  }

  if (reduceMotion || thrownIcons.has(el)) return;
  thrownIcons.add(el);

  const pos = floaterPos.get(el) || { x: 0, y: 0, rotation: 0 };
  const rect = el.getBoundingClientRect();
  const deltaX = rect.left + rect.width / 2 - event.clientX;
  const deltaY = rect.top + rect.height / 2 - event.clientY;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const throwForce = Math.max(200, 600 - distance);
  const x = pos.x + (deltaX / distance) * throwForce;
  const y = pos.y + (deltaY / distance) * throwForce;
  const spin = pos.rotation + (3 + throwForce / 100) * 360;

  el.style.opacity = "1";
  moveFloater(el, x, y, spin, 1.3, "transform 1.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease");

  setTimeout(() => {
    moveFloater(el, x, y, spin, 0.9, "transform 0.3s ease-out");
    setTimeout(() => {
      // Normalize the accumulated spin without animating back through it.
      moveFloater(el, x, y, spin % 360, 0.9, "none");
      void el.offsetWidth;
      el.style.opacity = "0.55";
      moveFloater(el, x, y, spin % 360, 1, "transform 0.3s ease-out, opacity 0.3s ease");
      setTimeout(() => {
        thrownIcons.delete(el);
        randomFloat(el);
      }, 800);
    }, 300);
  }, 1800);
}

function animateFloaters() {
  document.querySelectorAll(".floater").forEach((el, index) => {
    if (!thrownIcons.has(el)) setTimeout(() => randomFloat(el), index * 1667);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeIcons);
} else if (document.querySelector(".floater")) {
  initializeIcons();
}

if (!reduceMotion) {
  setTimeout(() => setInterval(animateFloaters, 12000), 5000);
  window.addEventListener("resize", () => {
    if (!document.querySelector(".floater")) return;
    thrownIcons.clear();
    animateFloaters();
  });
}
