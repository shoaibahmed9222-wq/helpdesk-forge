(() => {
  const current = document.currentScript;
  const script =
    current instanceof HTMLScriptElement
      ? current
      : document.querySelector("script[data-key][src*='widget.js']");
  if (!(script instanceof HTMLScriptElement)) return;
  const key = (script.dataset.key || "").trim();
  if (!key || document.getElementById("helpdesk-forge-widget")) return;

  let origin = "";
  try {
    origin = new URL(script.src, window.location.href).origin;
  } catch {
    return;
  }

  const storageKey = `hf-widget:${key}`;
  const sessionPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let sessionId = "";
  try {
    sessionId = localStorage.getItem(storageKey) || "";
  } catch {
    sessionId = "";
  }
  if (!sessionPattern.test(sessionId)) {
    sessionId = crypto.randomUUID();
    try {
      localStorage.setItem(storageKey, sessionId);
    } catch {
      /* private mode still chats for this page load */
    }
  }

  const host = document.createElement("div");
  host.id = "helpdesk-forge-widget";
  host.setAttribute("data-helpdesk-forge", "");
  for (const [prop, value] of [
    ["all", "initial"],
    ["position", "fixed"],
    ["z-index", "2147483647"],
    ["inset", "auto 0 0 auto"],
    ["width", "0"],
    ["height", "0"],
    ["margin", "0"],
    ["padding", "0"],
    ["border", "0"],
    ["overflow", "visible"],
    ["background", "transparent"],
    ["transform", "none"],
    ["filter", "none"],
    ["color-scheme", "light"],
  ]) {
    host.style.setProperty(prop, value, "important");
  }
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .launcher, .panel, button, textarea, input, p, h2, a, span {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: normal;
      text-transform: none;
      font-weight: 400;
    }
    .launcher {
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 56px;
      height: 56px;
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: var(--ink);
      box-shadow: 0 8px 24px rgba(28, 25, 21, 0.18);
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .launcher svg { width: 26px; height: 26px; display: block; }
    .panel {
      position: fixed;
      right: 20px;
      bottom: 88px;
      width: min(380px, calc(100vw - 32px));
      height: min(560px, calc(100vh - 120px));
      display: none;
      flex-direction: column;
      background: #fffdf8;
      color: #1c1915;
      border: 1px solid #e3d9cc;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 16px 48px rgba(28, 25, 21, 0.18);
    }
    .panel.open { display: flex; }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 14px 14px 16px;
      background: var(--accent);
      color: var(--ink);
    }
    h2 { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.3; }
    .close, .send, .choice {
      border: 0;
      cursor: pointer;
      background: transparent;
      color: inherit;
    }
    .close {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 20px;
      line-height: 1;
    }
    .close:hover, .choice.ghost:hover { background: rgba(255, 255, 255, 0.16); }
    .log {
      flex: 1;
      overflow: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #fffdf8;
    }
    .row { display: flex; flex-direction: column; max-width: 100%; }
    .row.user { align-items: flex-end; }
    .row.bot { align-items: flex-start; }
    .bubble {
      width: fit-content;
      max-width: 85%;
      margin: 0;
      padding: 10px 12px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .assistant { background: #f3efe6; color: #1c1915; }
    .customer { background: var(--accent); color: var(--ink); }
    .cites { margin: 6px 0 0; font-size: 12px; line-height: 1.4; color: #6d645c; }
    .cite { color: #0e5c56; margin-right: 8px; text-underline-offset: 2px; }
    .typing { align-self: flex-start; width: fit-content; color: #6d645c; font-size: 13px; }
    .handoff, .composer { padding: 0 12px 12px; background: #fffdf8; }
    .handoff p { margin: 0 0 8px; font-size: 13px; line-height: 1.45; color: #1c1915; }
    .handoff form, .composer form { display: flex; gap: 8px; }
    input, textarea {
      width: 100%;
      border: 1px solid #e3d9cc;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 16px;
      line-height: 1.4;
      color: #1c1915;
      background: #fff;
    }
    textarea { resize: none; min-height: 44px; max-height: 120px; }
    .send, .choice {
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      font-weight: 600;
      background: var(--accent);
      color: var(--ink);
      white-space: nowrap;
    }
    .choice.ghost { background: transparent; color: #6d645c; }
    .error { margin: 0 12px 8px; font-size: 13px; line-height: 1.4; color: #8a2b2b; }
    .thanks { margin: 0 12px 12px; font-size: 13px; line-height: 1.45; color: #1c1915; }
    button:disabled { opacity: 0.6; cursor: default; }
    button:focus-visible, textarea:focus-visible, input:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    @media (max-width: 640px) {
      .panel.open {
        inset: 0;
        width: auto;
        height: auto;
        border-radius: 0;
        bottom: 0;
        right: 0;
      }
      :host([data-open]) .launcher { display: none; }
    }
  `;

  const launcher = document.createElement("button");
  launcher.className = "launcher";
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open chat");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H13l-3.6 2.7a.8.8 0 0 1-1.3-.6V16H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"/></svg>';

  const panel = document.createElement("section");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-label", "Chat");

  const header = document.createElement("header");
  const title = document.createElement("h2");
  const close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.setAttribute("aria-label", "Close chat");
  close.textContent = "×";
  header.append(title, close);

  const log = document.createElement("div");
  log.className = "log";

  const handoff = document.createElement("div");
  handoff.className = "handoff";
  handoff.hidden = true;
  const handoffCopy = document.createElement("p");
  handoffCopy.textContent =
    "A person on the team can follow up. Leave your email if you would like that. It is optional.";
  const handoffForm = document.createElement("form");
  const email = document.createElement("input");
  email.type = "email";
  email.name = "email";
  email.placeholder = "you@example.com";
  email.setAttribute("aria-label", "Email");
  email.autocomplete = "email";
  email.maxLength = 200;
  const emailButton = document.createElement("button");
  emailButton.className = "choice";
  emailButton.type = "submit";
  emailButton.textContent = "Send";
  const skip = document.createElement("button");
  skip.className = "choice ghost";
  skip.type = "button";
  skip.textContent = "No thanks";
  handoffForm.append(email, emailButton);
  handoff.append(handoffCopy, handoffForm, skip);

  const thanks = document.createElement("p");
  thanks.className = "thanks";
  thanks.hidden = true;
  thanks.textContent = "Thanks. A person will follow up at that email.";

  const error = document.createElement("p");
  error.className = "error";
  error.hidden = true;

  const composer = document.createElement("div");
  composer.className = "composer";
  const form = document.createElement("form");
  const input = document.createElement("textarea");
  input.rows = 1;
  input.maxLength = 2000;
  input.required = true;
  input.placeholder = "Write a message";
  input.setAttribute("aria-label", "Message");
  const send = document.createElement("button");
  send.className = "send";
  send.type = "submit";
  send.textContent = "Send";
  form.append(input, send);
  composer.append(form);

  panel.append(header, log, handoff, thanks, error, composer);
  shadow.append(style, launcher, panel);

  const state = {
    open: false,
    sending: false,
    emailProvided: false,
    dismissed: false,
    messages: [],
    config: {
      title: "Chat with us",
      greeting: "Hi. Ask a question and we will answer from our docs.",
      accent: "#0e5c56",
    },
  };

  function ink(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1c1915" : "#ffffff";
  }

  function applyTheme() {
    const accent = /^#[0-9a-fA-F]{6}$/.test(state.config.accent) ? state.config.accent : "#0e5c56";
    shadow.host.style.setProperty("--accent", accent, "important");
    shadow.host.style.setProperty("--ink", ink(accent), "important");
    title.textContent = state.config.title || "Chat with us";
    panel.setAttribute("aria-label", title.textContent);
  }

  function setOpen(next) {
    state.open = next;
    panel.classList.toggle("open", next);
    launcher.setAttribute("aria-expanded", next ? "true" : "false");
    launcher.setAttribute("aria-label", next ? "Close chat" : "Open chat");
    if (next) host.setAttribute("data-open", "");
    else host.removeAttribute("data-open");
    if (next) input.focus();
  }

  function showError(text) {
    error.hidden = !text;
    error.textContent = text || "";
  }

  function problem(response, data) {
    if (response.status === 403) return "This chat is not available on this site.";
    if (response.status === 429) return "Too many messages. Please wait a minute and try again.";
    if (response.status === 401) return "This chat is not available.";
    if (data && data.error === "message") return "That message is too long.";
    if (data && data.error === "email") return "Enter a valid email, or choose No thanks.";
    return "Something went wrong. Please try again.";
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function apiUrl(path, withSession) {
    const url = new URL(path, origin);
    url.searchParams.set("key", key);
    if (withSession) url.searchParams.set("session", sessionId);
    return url;
  }

  function bubble(role, text) {
    const node = document.createElement("p");
    node.className = `bubble ${role}`;
    node.textContent = text;
    return node;
  }

  function citations(titles) {
    if (!titles || titles.length === 0) return null;
    const row = document.createElement("p");
    row.className = "cites";
    row.append("Sources: ");
    titles.forEach((item, index) => {
      if (index > 0) row.append(" ");
      const link = document.createElement("a");
      link.className = "cite";
      link.href = "#citation";
      link.dataset.citation = item;
      link.textContent = item;
      link.addEventListener("click", (event) => event.preventDefault());
      row.append(link);
    });
    return row;
  }

  function renderLog() {
    log.replaceChildren();
    const visible =
      state.messages.length > 0
        ? state.messages
        : [{ role: "assistant", body: state.config.greeting, citations: [], handoff: false }];
    for (const message of visible) {
      const mine = message.role === "customer";
      const wrap = document.createElement("div");
      wrap.className = mine ? "row user" : "row bot";
      wrap.append(bubble(mine ? "customer" : "assistant", message.body));
      const cites = message.role === "assistant" ? citations(message.citations) : null;
      if (cites) wrap.append(cites);
      log.append(wrap);
    }
    if (state.sending) {
      const pending = document.createElement("p");
      pending.className = "bubble assistant typing";
      pending.textContent = "Typing…";
      log.append(pending);
    }
    const last = state.messages[state.messages.length - 1];
    const showHandoff = Boolean(last && last.handoff && !state.emailProvided && !state.dismissed);
    handoff.hidden = !showHandoff;
    thanks.hidden = !(last && last.handoff && state.emailProvided);
    log.scrollTop = log.scrollHeight;
  }

  function lock(locked) {
    state.sending = locked;
    input.disabled = locked;
    send.disabled = locked;
    email.disabled = locked;
    emailButton.disabled = locked;
    renderLog();
  }

  launcher.addEventListener("click", () => setOpen(!state.open));
  close.addEventListener("click", () => setOpen(false));
  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.open) setOpen(false);
  });
  skip.addEventListener("click", () => {
    state.dismissed = true;
    showError("");
    renderLog();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || state.sending) return;
    showError("");
    state.messages.push({ role: "customer", body: message, citations: [], handoff: false });
    input.value = "";
    lock(true);
    try {
      const response = await fetch(apiUrl("/api/widget/chat", false), {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        state.messages.pop();
        input.value = message;
        showError(problem(response, data));
        return;
      }
      state.dismissed = false;
      state.messages.push({
        role: "assistant",
        body: typeof data.answer === "string" ? data.answer : "",
        citations: Array.isArray(data.citations) ? data.citations.filter((item) => typeof item === "string") : [],
        handoff: data.handoff === true,
      });
    } catch {
      state.messages.pop();
      input.value = message;
      showError("Something went wrong. Please try again.");
    } finally {
      lock(false);
      input.focus();
    }
  });

  handoffForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = email.value.trim();
    if (!value || state.sending) return;
    showError("");
    lock(true);
    try {
      const response = await fetch(apiUrl("/api/widget/handoff", false), {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email: value }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        showError(problem(response, data));
        return;
      }
      state.emailProvided = true;
      email.value = "";
    } catch {
      showError("Something went wrong. Please try again.");
    } finally {
      lock(false);
    }
  });

  applyTheme();
  renderLog();
  host.setAttribute("data-ready", "pending");

  (async () => {
    try {
      const configResponse = await fetch(apiUrl("/api/widget/config", false), {
        mode: "cors",
        credentials: "omit",
      });
      const config = await readJson(configResponse);
      if (!configResponse.ok) {
        showError(problem(configResponse, config));
        host.setAttribute("data-ready", "error");
        return;
      }
      state.config = {
        title: typeof config.title === "string" ? config.title : state.config.title,
        greeting: typeof config.greeting === "string" ? config.greeting : state.config.greeting,
        accent: typeof config.accent === "string" ? config.accent : state.config.accent,
      };
      applyTheme();
      const historyResponse = await fetch(apiUrl("/api/widget/chat", true), {
        mode: "cors",
        credentials: "omit",
      });
      const history = await readJson(historyResponse);
      if (!historyResponse.ok) {
        showError(problem(historyResponse, history));
        host.setAttribute("data-ready", "error");
        renderLog();
        return;
      }
      state.emailProvided = history.emailProvided === true;
      state.messages = Array.isArray(history.messages)
        ? history.messages
            .filter((item) => item && (item.role === "customer" || item.role === "assistant"))
            .map((item) => ({
              role: item.role,
              body: typeof item.body === "string" ? item.body : "",
              citations: Array.isArray(item.citations)
                ? item.citations.filter((title) => typeof title === "string")
                : [],
              handoff: item.handoff === true,
            }))
        : [];
      host.setAttribute("data-ready", "true");
      renderLog();
    } catch {
      showError("Something went wrong. Please try again.");
      host.setAttribute("data-ready", "error");
    }
  })();
})();
