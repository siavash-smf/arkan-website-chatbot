/*
 * ویجت چت آرکان — اسنیپت قابل‌جاسازی
 * نصب در هر سایت:
 *   <script src="https://arkan-website-chatbot.vercel.app/widget.js" async></script>
 * یک حباب شناور می‌سازد که گفتگو را داخل یک iframe امن باز می‌کند.
 */
(function () {
  "use strict";
  var current = document.currentScript;
  var BASE = (function () {
    try {
      return new URL(current.src).origin;
    } catch (e) {
      return "https://arkan-website-chatbot.vercel.app";
    }
  })();

  if (window.__arkanWidgetLoaded) return;
  window.__arkanWidgetLoaded = true;

  fetch(BASE + "/api/widget-config")
    .then(function (r) {
      return r.json();
    })
    .then(function (cfg) {
      if (cfg && cfg.enabled === false) return;
      init(cfg || {});
    })
    .catch(function () {
      init({});
    });

  function init(cfg) {
    var color = cfg.primary_color || "#143A32";
    var bone = "#F7F3EC";
    var side = cfg.position === "right" ? "right" : "left";
    var launcherText = cfg.launcher_text || "گفت‌وگو با مشاور";
    var isOpen = false;

    var root = document.createElement("div");
    root.setAttribute("dir", "rtl");
    root.style.cssText =
      "position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;" +
      "display:flex;flex-direction:column;align-items:" + (side === "left" ? "flex-start" : "flex-end") + ";" +
      "font-family:Tahoma,Arial,sans-serif;";

    var iframe = document.createElement("iframe");
    iframe.src = BASE + "/widget";
    iframe.title = "دستیار آرکان";
    iframe.style.cssText =
      "border:0;width:380px;height:600px;max-width:calc(100vw - 40px);" +
      "max-height:calc(100vh - 120px);border-radius:16px;background:" + bone + ";" +
      "box-shadow:0 12px 48px rgba(20,58,50,0.22);margin-bottom:12px;display:none;";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", launcherText);
    btn.style.cssText =
      "display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer;" +
      "background:" + color + ";color:" + bone + ";border-radius:999px;" +
      "padding:13px 18px;font-size:14px;font-weight:700;line-height:1;" +
      "box-shadow:0 6px 22px rgba(20,58,50,0.28);transition:transform .15s ease;";
    btn.onmouseenter = function () { btn.style.transform = "translateY(-2px)"; };
    btn.onmouseleave = function () { btn.style.transform = "none"; };

    function render() {
      if (isOpen) {
        btn.innerHTML = closeSvg();
        btn.style.padding = "13px";
        btn.style.borderRadius = "50%";
      } else {
        btn.innerHTML = chatSvg() + "<span>" + escapeHtml(launcherText) + "</span>";
        btn.style.padding = "13px 18px";
        btn.style.borderRadius = "999px";
      }
    }

    btn.addEventListener("click", function () {
      isOpen = !isOpen;
      iframe.style.display = isOpen ? "block" : "none";
      render();
    });

    render();
    root.appendChild(iframe);
    root.appendChild(btn);
    document.body.appendChild(root);
  }

  function chatSvg() {
    return (
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H9l-5 4V6a1 1 0 011-1z"/></svg>'
    );
  }
  function closeSvg() {
    return (
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 6l12 12M18 6L6 18"/></svg>'
    );
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
})();
