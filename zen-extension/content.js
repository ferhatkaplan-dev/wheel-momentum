/*
 * Wheel Momentum - inertial mouse-wheel scrolling inside the browser.
 *
 * How it works:
 *   Wheel detents are caught (touchpad deltas are ignored), the native scroll
 *   is prevented, and the scroll container is animated with a velocity that
 *   decays exponentially. The page therefore keeps gliding for a moment after
 *   the detent and settles smoothly.
 *
 * Tuning: see CONFIG below.
 */
(() => {
  "use strict";

  const CONFIG = {
    // Total travel of one detent = detent distance * this factor.
    // 1.0 = exactly the detent (no overshoot), 1.4 = noticeable inertia.
    distanceMultiplier: 1.3,

    // Damping: velocity is multiplied by this every ~16.7 ms.
    // 0.97 = short, 0.93 = balanced, 0.90 = long glide.
    friction: 0.93,

    // Pixel deltas below this are treated as touchpad input and left alone.
    wheelDeltaThreshold: 100,

    // Limits
    minDistance: 30,   // px
    maxDistance: 500,  // px
    maxVelocity: 8,    // px / ms
    stopVelocity: 0.02,

    // Hosts to leave completely alone, e.g. ["docs.google.com", "figma.com"]
    blockedHosts: []
  };

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (CONFIG.blockedHosts.includes(location.hostname)) return;

  let scroller = null;
  let velocity = 0; // px / ms
  let rafId = 0;
  let lastTs = 0;

  function isScrollableY(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el === document.documentElement || el === document.body) return false;
    const oy = getComputedStyle(el).overflowY;
    if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
    return el.scrollHeight - el.clientHeight > 1;
  }

  function findScroller(target) {
    let el = target instanceof Element ? target : null;
    while (el && el !== document.documentElement) {
      if (isScrollableY(el)) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function maxScrollTop(el) {
    return Math.max(0, el.scrollHeight - el.clientHeight);
  }

  function lineHeightOf(el) {
    let lh = parseFloat(getComputedStyle(el).lineHeight);
    if (!Number.isFinite(lh) || lh <= 0) lh = 20;
    return lh;
  }

  function setScrollTop(el, top) {
    try {
      el.scrollTo({ top, behavior: "instant" });
    } catch (_) {
      el.scrollTop = top;
    }
  }

  function stop() {
    velocity = 0;
    lastTs = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function step(ts) {
    rafId = 0;
    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (dt <= 0) {
      rafId = requestAnimationFrame(step);
      return;
    }
    if (dt > 50) dt = 50;

    if (!scroller || !scroller.isConnected) {
      stop();
      return;
    }

    const before = scroller.scrollTop;
    const limit = maxScrollTop(scroller);
    let next = before + velocity * dt;
    if (next < 0) next = 0;
    if (next > limit) next = limit;
    if (next !== before) setScrollTop(scroller, next);

    // Hit the wall: nothing left to animate.
    if (next !== before && scroller.scrollTop === before) {
      stop();
      return;
    }

    velocity *= Math.pow(CONFIG.friction, dt / 16.7);
    if (Math.abs(velocity) < CONFIG.stopVelocity) {
      stop();
      return;
    }
    rafId = requestAnimationFrame(step);
  }

  function onWheel(e) {
    // Zoom, horizontal scrolling or an already handled event: leave it.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.defaultPrevented) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    const lineMode = e.deltaMode === 1;
    const pageMode = e.deltaMode === 2;

    // Small pixel deltas mean touchpad: keep native + kinetic scrolling.
    if (!lineMode && !pageMode && Math.abs(e.deltaY) < CONFIG.wheelDeltaThreshold) return;

    const el = findScroller(e.target);
    if (!el) return;

    const px = pageMode
      ? e.deltaY * el.clientHeight
      : lineMode
        ? e.deltaY * lineHeightOf(el)
        : e.deltaY;

    if (!px) return;

    // At a boundary: let the native scroll chain to the parent.
    const limit = maxScrollTop(el);
    if ((px > 0 && el.scrollTop >= limit) || (px < 0 && el.scrollTop <= 0)) {
      stop();
      return;
    }

    e.preventDefault();

    if (el !== scroller) {
      stop();
      scroller = el;
    }

    const dist = Math.max(
      CONFIG.minDistance,
      Math.min(CONFIG.maxDistance, Math.abs(px) * CONFIG.distanceMultiplier)
    );
    const dir = px < 0 ? -1 : 1;
    // dist = v0 * dt / (1 - friction)  =>  v0 = dist * (1 - friction) / dt
    const v0 = (dist * (1 - CONFIG.friction)) / 16.7;

    let v = velocity + dir * v0;
    if (v > CONFIG.maxVelocity) v = CONFIG.maxVelocity;
    if (v < -CONFIG.maxVelocity) v = -CONFIG.maxVelocity;
    velocity = v;

    if (!rafId) {
      lastTs = 0;
      rafId = requestAnimationFrame(step);
    }
  }

  function cancel() {
    stop();
  }

  window.addEventListener("wheel", onWheel, { capture: true, passive: false });
  window.addEventListener("keydown", cancel, true);
  window.addEventListener("mousedown", cancel, true);
  window.addEventListener("touchstart", cancel, true);
  window.addEventListener("dragstart", cancel, true);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
})();
