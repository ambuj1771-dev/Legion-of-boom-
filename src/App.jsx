import React, { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   THE ONE JOURNAL — a news magazine with a publishing control panel
   Design tokens:
   ink:    #0B1320  (headlines, masthead)
   paper:  #FAF8F3  (background)
   flag:   #C8102E  (wire-red accent, breaking/live)
   slate:  #5B6470  (secondary text)
   rule:   #D8D4C9  (hairlines)
   ============================================================ */

const ADMIN_PASSWORD = "wire2026"; // demo-only gate

const SECTIONS = ["World", "Tech", "HTML Journal"];

const SEED_ARTICLES = [
  {
    id: "seed-2",
    section: "Tech",
    headline: "Chipmakers report record backlog as AI buildout accelerates",
    deck: "Order books stretch into next year as data center operators lock in capacity ahead of anticipated demand.",
    byline: "R. Chen",
    body: "Several of the world's largest semiconductor manufacturers disclosed backlog figures this week that analysts described as unprecedented in the industry's history.\n\nThe surge is being driven almost entirely by data center buildouts tied to AI training and inference workloads, with hyperscale cloud providers said to be securing capacity years in advance.\n\nSupply chain analysts caution that the concentration of demand among a handful of buyers introduces fragility, even as headline numbers remain strong.",
    imageUrl: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=1200&q=80",
    imageCaption: "Semiconductor wafers on a production line.",
    breaking: true,
    featured: true,
    timestamp: Date.now() - 1000 * 60 * 45,
  },
  {
    id: "seed-3",
    section: "World",
    headline: "Drought conditions ease across the Horn of Africa after seasonal rains",
    deck: "Early rainfall data offers relief to a region that has faced five consecutive failed seasons.",
    byline: "A. Hassan",
    body: "Meteorological agencies across the Horn of Africa reported the strongest seasonal rainfall in over two years, raising cautious hope among aid organizations that have warned of deteriorating food security since 2023.\n\nWhile the rains are a welcome reprieve, officials note that rebuilding livestock herds and depleted grain reserves will take considerably longer than a single good season.",
    breaking: false,
    featured: false,
    timestamp: Date.now() - 1000 * 60 * 90,
  },
];

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDateLine() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function uid() {
  return "a-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // ~1.5MB, keeps storage requests small

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsText(file);
  });
}

// Strips an HTML document down to plain text paragraphs, so uploaded .html
// files match the look of every other article on the site.
function htmlToPlainParagraphs(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  doc.querySelectorAll("script, style").forEach((el) => el.remove());

  const blockSelector = "p, h1, h2, h3, h4, h5, h6, li, blockquote, div";
  const blocks = doc.body ? doc.body.querySelectorAll(blockSelector) : [];

  const paragraphs = [];
  blocks.forEach((el) => {
    // Skip blocks whose text is already captured by a nested block we'll visit
    if (el.querySelector(blockSelector)) return;
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (text) paragraphs.push(text);
  });

  if (paragraphs.length === 0) {
    const fallback = (doc.body ? doc.body.textContent : htmlString).replace(/\s+/g, " ").trim();
    return fallback;
  }
  return paragraphs.join("\n\n");
}

function extractTitleFromHtml(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const h1 = doc.querySelector("h1");
  if (h1 && h1.textContent.trim()) return h1.textContent.replace(/\s+/g, " ").trim();
  if (doc.title && doc.title.trim()) return doc.title.trim();
  return "";
}

/* ---------- storage helpers ----------
   NOTE: This uses the browser's localStorage, which means each visitor's
   browser stores its own copy of the articles. That's fine for a single
   admin testing on one device, but it means:
     - Articles published from your laptop won't show up on your phone
     - If a visitor clears their browser data, they lose what was stored
   For a real multi-device, multi-visitor site, swap this out for a real
   backend + database (see the README for notes on adding Supabase/Firebase).
*/
const STORAGE_KEY = "one-journal:articles";

async function loadArticles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    /* storage unavailable or corrupted — fall through to seed */
  }
  return SEED_ARTICLES;
}

async function saveArticles(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   Icons (inline SVG, no deps)
   ============================================================ */
const Icon = {
  Lock: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <rect x="4" y="11" width="16" height="9" rx="1.5" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  Trash: (p) => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Edit: (p) => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" strokeLinejoin="round" />
    </svg>
  ),
  Back: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Close: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  ),
};

/* ============================================================
   Masthead + ticker (signature element)
   ============================================================ */
function Masthead({ onNav, activeSection, onAdminClick }) {
  return (
    <header style={{ background: "var(--paper)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--slate)",
          padding: "8px 24px",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <span>{formatDateLine()}</span>
        <button
          onClick={onAdminClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "none",
            border: "none",
            color: "var(--slate)",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Icon.Lock /> Control Panel
        </button>
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "28px 16px 18px",
          borderBottom: "1px solid var(--ink)",
        }}
      >
        <button
          onClick={() => onNav(null)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--serif)",
            fontWeight: 800,
            fontSize: "clamp(36px, 7vw, 64px)",
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            lineHeight: 1,
          }}
        >
          The One Journal
        </button>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            color: "var(--flag)",
            marginTop: 8,
            textTransform: "uppercase",
          }}
        >
          Independent &middot; Est. on this server &middot; Updated continuously
        </div>
      </div>

      <nav
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 28,
          padding: "12px 16px",
          borderBottom: "1px solid var(--rule)",
          fontFamily: "var(--sans)",
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          overflowX: "auto",
          whiteSpace: "nowrap",
        }}
      >
        <button
          onClick={() => onNav(null)}
          style={navBtnStyle(activeSection === null)}
        >
          Front Page
        </button>
        {SECTIONS.map((s) => (
          <button key={s} onClick={() => onNav(s)} style={navBtnStyle(activeSection === s)}>
            {s}
          </button>
        ))}
      </nav>
    </header>
  );
}

function navBtnStyle(active) {
  return {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: active ? "var(--ink)" : "var(--slate)",
    borderBottom: active ? "2px solid var(--flag)" : "2px solid transparent",
    paddingBottom: 4,
    fontFamily: "inherit",
    fontWeight: "inherit",
    fontSize: "inherit",
    letterSpacing: "inherit",
    textTransform: "inherit",
  };
}

function Ticker({ articles, onSelect }) {
  const items = articles.slice(0, 10);
  if (!items.length) return null;
  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--paper)",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          background: "var(--flag)",
          color: "#fff",
          fontFamily: "var(--mono)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          padding: "7px 14px",
          flexShrink: 0,
          zIndex: 2,
          textTransform: "uppercase",
        }}
      >
        Latest
      </div>
      <div className="wire-ticker-track" style={{ display: "flex", flexShrink: 0 }}>
        {[0, 1].map((copy) => (
          <div key={copy} style={{ display: "flex" }} aria-hidden={copy === 1}>
            {items.map((a) => (
              <button
                key={copy + a.id}
                onClick={() => onSelect(a)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--paper)",
                  fontFamily: "var(--sans)",
                  fontSize: 13,
                  padding: "8px 28px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--flag)", fontFamily: "var(--mono)", fontSize: 11 }}>
                  {a.section.toUpperCase()}
                </span>
                {a.headline}
              </button>
            ))}
          </div>
        ))}
      </div>
      <style>{`
        .wire-ticker-track { animation: wire-scroll 40s linear infinite; }
        @keyframes wire-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .wire-ticker-track { animation: none; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Article cards
   ============================================================ */
function LeadCard({ article, onSelect }) {
  return (
    <article style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 24 }}>
      <Eyebrow article={article} />
      <button
        onClick={() => onSelect(article)}
        style={{
          background: "none",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          display: "block",
          padding: 0,
          width: "100%",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--serif)",
            fontWeight: 700,
            fontSize: "clamp(28px, 4vw, 42px)",
            lineHeight: 1.08,
            color: "var(--ink)",
            margin: "10px 0 12px",
          }}
        >
          {article.headline}
        </h1>
      </button>
      {article.imageUrl && (
        <button
          onClick={() => onSelect(article)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", width: "100%", marginBottom: 14 }}
        >
          <img
            src={article.imageUrl}
            alt={article.imageCaption || article.headline}
            style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </button>
      )}
      <p style={{ fontFamily: "var(--sans)", fontSize: 17, lineHeight: 1.5, color: "var(--slate)", margin: 0 }}>
        {article.deck}
      </p>
      <Byline article={article} />
    </article>
  );
}

function RiverCard({ article, onSelect }) {
  return (
    <article style={{ borderBottom: "1px solid var(--rule)", padding: "18px 0", display: "flex", gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow article={article} small />
        <button
          onClick={() => onSelect(article)}
          style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", padding: 0, display: "block" }}
        >
          <h2
            style={{
              fontFamily: "var(--serif)",
              fontWeight: 700,
              fontSize: 21,
              lineHeight: 1.2,
              color: "var(--ink)",
              margin: "6px 0 6px",
            }}
          >
            {article.headline}
          </h2>
        </button>
        <p style={{ fontFamily: "var(--sans)", fontSize: 14.5, lineHeight: 1.5, color: "var(--slate)", margin: "0 0 6px" }}>
          {article.deck}
        </p>
        <Byline article={article} small />
      </div>
      {article.imageUrl && (
        <button
          onClick={() => onSelect(article)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}
        >
          <img
            src={article.imageUrl}
            alt={article.imageCaption || article.headline}
            style={{ width: 120, height: 90, objectFit: "cover", display: "block" }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </button>
      )}
    </article>
  );
}

function Eyebrow({ article, small }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {article.breaking && (
        <span
          style={{
            background: "var(--flag)",
            color: "#fff",
            fontFamily: "var(--mono)",
            fontSize: small ? 10 : 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "2px 6px",
            textTransform: "uppercase",
          }}
        >
          Breaking
        </span>
      )}
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: small ? 10 : 11,
          letterSpacing: "0.08em",
          color: "var(--flag)",
          textTransform: "uppercase",
        }}
      >
        {article.section}
      </span>
    </div>
  );
}

function Byline({ article, small }) {
  return (
    <div
      style={{
        fontFamily: "var(--mono)",
        fontSize: small ? 11 : 12,
        color: "var(--slate)",
        marginTop: 4,
      }}
    >
      By {article.byline} &middot; {timeAgo(article.timestamp)}
    </div>
  );
}

/* ============================================================
   Front page / section page
   ============================================================ */
function FrontPage({ articles, onSelect }) {
  const sorted = [...articles].sort((a, b) => b.timestamp - a.timestamp);
  const lead = sorted.find((a) => a.featured) || sorted[0];
  const rest = sorted.filter((a) => a.id !== lead?.id);

  if (!lead) return <EmptyState />;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 20px 60px" }}>
      <LeadCard article={lead} onSelect={onSelect} />
      <div style={{ marginTop: 8 }}>
        {rest.map((a) => (
          <RiverCard key={a.id} article={a} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function SectionPage({ section, articles, onSelect }) {
  const filtered = articles
    .filter((a) => a.section === section)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 60px" }}>
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 800,
          fontSize: 32,
          color: "var(--ink)",
          borderBottom: "3px solid var(--ink)",
          paddingBottom: 10,
          marginBottom: 8,
        }}
      >
        {section}
      </h1>
      {filtered.length === 0 ? (
        <EmptyState section={section} />
      ) : (
        filtered.map((a) => <RiverCard key={a.id} article={a} onSelect={onSelect} />)
      )}
    </div>
  );
}

function EmptyState({ section }) {
  return (
    <div style={{ padding: "60px 0", textAlign: "center" }}>
      <p style={{ fontFamily: "var(--serif)", fontSize: 20, color: "var(--ink)", marginBottom: 6 }}>
        {section ? `No ${section} stories yet.` : "No stories yet."}
      </p>
      <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--slate)" }}>
        Publish one from the control panel and it will appear here.
      </p>
    </div>
  );
}

/* ============================================================
   Article detail
   ============================================================ */
function ArticleView({ article, onBack }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 80px" }}>
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "var(--flag)",
          fontFamily: "var(--sans)",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
          padding: 0,
          marginBottom: 24,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        <Icon.Back /> Back
      </button>
      <Eyebrow article={article} />
      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 700,
          fontSize: "clamp(28px, 5vw, 40px)",
          lineHeight: 1.1,
          color: "var(--ink)",
          margin: "12px 0 14px",
        }}
      >
        {article.headline}
      </h1>
      <p
        style={{
          fontFamily: "var(--sans)",
          fontSize: 18,
          lineHeight: 1.5,
          color: "var(--slate)",
          margin: "0 0 14px",
        }}
      >
        {article.deck}
      </p>
      <Byline article={article} />
      {article.imageUrl && (
        <figure style={{ margin: "18px 0 0" }}>
          <img
            src={article.imageUrl}
            alt={article.imageCaption || article.headline}
            style={{ width: "100%", maxHeight: 480, objectFit: "cover", display: "block" }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
          {article.imageCaption && (
            <figcaption
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--slate)",
                marginTop: 6,
              }}
            >
              {article.imageCaption}
            </figcaption>
          )}
        </figure>
      )}
      <div style={{ borderTop: "1px solid var(--rule)", marginTop: 20, paddingTop: 24 }}>
        {article.body.split("\n\n").map((para, i) => (
          <p
            key={i}
            style={{
              fontFamily: "var(--serif)",
              fontSize: 18,
              lineHeight: 1.7,
              color: "var(--ink)",
              margin: "0 0 18px",
            }}
          >
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Admin: login gate
   ============================================================ */
function AdminGate({ onSuccess, onCancel }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError("Incorrect password.");
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 360 }}>
        <button onClick={onCancel} style={closeBtnStyle}>
          <Icon.Close />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Icon.Lock color="var(--flag)" />
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
            Control Panel
          </h2>
        </div>
        <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--slate)", margin: "4px 0 18px" }}>
          Enter the admin password to continue.
        </p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={pw}
            autoFocus
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            style={inputStyle}
          />
          {error && (
            <p style={{ color: "var(--flag)", fontFamily: "var(--sans)", fontSize: 13, margin: "8px 0 0" }}>{error}</p>
          )}
          <button type="submit" style={{ ...primaryBtnStyle, width: "100%", marginTop: 14 }}>
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Admin: control panel
   ============================================================ */
const emptyDraft = () => ({
  id: null,
  section: SECTIONS[0],
  headline: "",
  deck: "",
  byline: "",
  body: "",
  imageUrl: "",
  imageCaption: "",
  breaking: false,
  featured: false,
});

function AdminPanel({ articles, setArticles, onClose }) {
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [htmlImporting, setHtmlImporting] = useState(false);
  const fileInputRef = useRef(null);
  const htmlFileInputRef = useRef(null);

  const sorted = [...articles].sort((a, b) => b.timestamp - a.timestamp);

  async function handleFilePicked(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus(`That image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please use one under 1.5MB.`);
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDraft((d) => ({ ...d, imageUrl: dataUrl }));
      setStatus("Photo attached.");
    } catch (err) {
      setStatus("Could not read that file. Please try again.");
    } finally {
      setUploading(false);
      setTimeout(() => setStatus(""), 2000);
    }
  }

  async function handleHtmlFilePicked(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const looksLikeHtml = file.type === "text/html" || /\.html?$/i.test(file.name);
    if (!looksLikeHtml) {
      setStatus("Please choose an .html file.");
      return;
    }
    setHtmlImporting(true);
    try {
      const raw = await readFileAsText(file);
      const plainBody = htmlToPlainParagraphs(raw);
      const title = extractTitleFromHtml(raw);
      setDraft((d) => ({
        ...d,
        section: "HTML Journal",
        body: plainBody,
        headline: d.headline || title,
      }));
      setStatus("HTML file imported as plain text.");
    } catch (err) {
      setStatus("Could not read that file. Please try again.");
    } finally {
      setHtmlImporting(false);
      setTimeout(() => setStatus(""), 2500);
    }
  }

  function startEdit(article) {
    setDraft({ ...article });
    setEditingId(article.id);
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setDraft(emptyDraft());
    setEditingId(null);
  }

  async function persist(next) {
    setArticles(next);
    const ok = await saveArticles(next);
    setStatus(ok ? "Saved." : "Could not save — changes may not persist.");
    setTimeout(() => setStatus(""), 2500);
  }

  async function publish(e) {
    e.preventDefault();
    if (!draft.headline.trim() || !draft.body.trim()) {
      setStatus("Headline and article body are required.");
      return;
    }
    if (editingId) {
      const next = articles.map((a) =>
        a.id === editingId ? { ...draft, id: editingId, timestamp: a.timestamp } : a
      );
      await persist(next);
    } else {
      const newArticle = { ...draft, id: uid(), timestamp: Date.now() };
      await persist([newArticle, ...articles]);
    }
    resetForm();
  }

  async function removeArticle(id) {
    await persist(articles.filter((a) => a.id !== id));
    setConfirmDeleteId(null);
    if (editingId === id) resetForm();
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 880, maxHeight: "88vh", overflowY: "auto" }}>
        <button onClick={onClose} style={closeBtnStyle}>
          <Icon.Close />
        </button>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 800, color: "var(--ink)", margin: "0 0 4px" }}>
          Control Panel
        </h2>
        <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--slate)", margin: "0 0 20px" }}>
          Publish, edit, or remove stories. Changes go live on the site immediately.
        </p>

        <form onSubmit={publish} style={{ display: "grid", gap: 12, marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <select
              value={draft.section}
              onChange={(e) => setDraft({ ...draft, section: e.target.value })}
              style={{ ...inputStyle, flex: "1 1 160px" }}
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              placeholder="Byline (e.g. J. Smith)"
              value={draft.byline}
              onChange={(e) => setDraft({ ...draft, byline: e.target.value })}
              style={{ ...inputStyle, flex: "2 1 220px" }}
            />
          </div>

          <input
            placeholder="Headline"
            value={draft.headline}
            onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
            style={{ ...inputStyle, fontFamily: "var(--serif)", fontWeight: 700, fontSize: 18 }}
          />

          <textarea
            placeholder="Deck — one or two sentence summary shown on cards"
            value={draft.deck}
            onChange={(e) => setDraft({ ...draft, deck: e.target.value })}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <div
            style={{
              border: "1px dashed var(--rule)",
              borderRadius: 3,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <input
              ref={htmlFileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={handleHtmlFilePicked}
              style={{ display: "none" }}
            />
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--slate)" }}>
              Or import an .html file
            </span>
            <button
              type="button"
              onClick={() => htmlFileInputRef.current && htmlFileInputRef.current.click()}
              style={secondaryBtnStyle}
              disabled={htmlImporting}
            >
              {htmlImporting ? "Importing…" : "Choose .html file"}
            </button>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--slate)" }}>
              Text is pulled out and placed in the body field below — sets section to HTML Journal.
            </span>
          </div>

          <textarea
            placeholder="Article body. Separate paragraphs with a blank line."
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={8}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.5 }}
          />

          <div>
            <label
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--slate)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Photo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFilePicked}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={secondaryBtnStyle}
                disabled={uploading}
              >
                {uploading ? "Reading photo…" : "Choose photo from device"}
              </button>
              {draft.imageUrl && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, imageUrl: "", imageCaption: "" })}
                  style={{ ...secondaryBtnStyle, color: "var(--flag)" }}
                >
                  Remove photo
                </button>
              )}
            </div>
            <input
              placeholder="…or paste an image URL instead"
              value={draft.imageUrl && draft.imageUrl.startsWith("data:") ? "" : draft.imageUrl}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              style={{ ...inputStyle, marginTop: 10 }}
              disabled={draft.imageUrl && draft.imageUrl.startsWith("data:")}
            />
            <input
              placeholder="Image caption (optional)"
              value={draft.imageCaption}
              onChange={(e) => setDraft({ ...draft, imageCaption: e.target.value })}
              style={{ ...inputStyle, marginTop: 10 }}
            />
          </div>
          {draft.imageUrl && (
            <div>
              <img
                src={draft.imageUrl}
                alt="Preview"
                style={{ maxWidth: "100%", maxHeight: 180, display: "block", border: "1px solid var(--rule)" }}
                onError={(e) => { e.target.style.display = "none"; }}
                onLoad={(e) => { e.target.style.display = "block"; }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={draft.breaking}
                onChange={(e) => setDraft({ ...draft, breaking: e.target.checked })}
              />
              Mark as Breaking
            </label>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
              />
              Feature on Front Page
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="submit" style={primaryBtnStyle}>
              <Icon.Plus /> {editingId ? "Save changes" : "Publish article"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={secondaryBtnStyle}>
                Cancel edit
              </button>
            )}
            {status && (
              <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--slate)" }}>{status}</span>
            )}
          </div>
        </form>

        <h3
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--slate)",
            borderBottom: "1px solid var(--rule)",
            paddingBottom: 8,
            marginBottom: 4,
          }}
        >
          Published ({articles.length})
        </h3>

        {sorted.map((a) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--flag)", textTransform: "uppercase" }}>
                  {a.section}
                </span>
                {a.featured && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--slate)" }}>FEATURED</span>
                )}
                {a.breaking && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--slate)" }}>BREAKING</span>
                )}
              </div>
              <div
                style={{
                  fontFamily: "var(--sans)",
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {a.headline}
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--slate)" }}>
                {timeAgo(a.timestamp)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => startEdit(a)} style={iconBtnStyle} title="Edit">
                <Icon.Edit />
              </button>
              {confirmDeleteId === a.id ? (
                <>
                  <button onClick={() => removeArticle(a.id)} style={{ ...iconBtnStyle, color: "var(--flag)" }}>
                    Confirm
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)} style={iconBtnStyle}>
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmDeleteId(a.id)} style={iconBtnStyle} title="Delete">
                  <Icon.Trash />
                </button>
              )}
            </div>
          </div>
        ))}
        {articles.length === 0 && (
          <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--slate)", padding: "20px 0" }}>
            No articles yet. Use the form above to publish your first story.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- shared inline styles ---------- */
const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(11,19,32,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 50,
};
const modalStyle = {
  background: "var(--paper)",
  width: "100%",
  borderRadius: 4,
  padding: 28,
  position: "relative",
  boxShadow: "0 24px 60px rgba(11,19,32,0.3)",
};
const closeBtnStyle = {
  position: "absolute",
  top: 16,
  right: 16,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--slate)",
};
const inputStyle = {
  width: "100%",
  fontFamily: "var(--sans)",
  fontSize: 14,
  padding: "10px 12px",
  border: "1px solid var(--rule)",
  borderRadius: 3,
  background: "#fff",
  color: "var(--ink)",
  boxSizing: "border-box",
};
const primaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--ink)",
  color: "var(--paper)",
  border: "none",
  borderRadius: 3,
  padding: "10px 18px",
  fontFamily: "var(--sans)",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  cursor: "pointer",
};
const secondaryBtnStyle = {
  ...primaryBtnStyle,
  background: "none",
  color: "var(--slate)",
  border: "1px solid var(--rule)",
};
const iconBtnStyle = {
  background: "none",
  border: "1px solid var(--rule)",
  borderRadius: 3,
  padding: "6px 10px",
  cursor: "pointer",
  color: "var(--slate)",
  fontFamily: "var(--sans)",
  fontSize: 12,
  display: "flex",
  alignItems: "center",
};
const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--sans)",
  fontSize: 13,
  color: "var(--ink)",
  cursor: "pointer",
};
const codeStyle = {
  background: "var(--rule)",
  padding: "1px 6px",
  borderRadius: 3,
  fontFamily: "var(--mono)",
};

/* ============================================================
   Root app
   ============================================================ */
export default function App() {
  const [articles, setArticles] = useState(SEED_ARTICLES);
  const [loaded, setLoaded] = useState(false);
  const [section, setSection] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showGate, setShowGate] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    loadArticles().then((list) => {
      setArticles(list);
      setLoaded(true);
    });
  }, []);

  function handleNav(sec) {
    setSection(sec);
    setSelected(null);
  }

  return (
    <div
      style={{
        "--ink": "#0B1320",
        "--paper": "#FAF8F3",
        "--flag": "#C8102E",
        "--slate": "#5B6470",
        "--rule": "#D8D4C9",
        "--serif": "'Source Serif 4', Georgia, serif",
        "--sans": "'Inter', -apple-system, sans-serif",
        "--mono": "'IBM Plex Mono', monospace",
        background: "var(--paper)",
        minHeight: "100vh",
        color: "var(--ink)",
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,700;8..60,800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&display=swap"
      />

      <Masthead onNav={handleNav} activeSection={section} onAdminClick={() => setShowGate(true)} />
      <Ticker
        articles={[...articles].sort((a, b) => b.timestamp - a.timestamp)}
        onSelect={(a) => {
          setSelected(a);
          setSection(null);
        }}
      />

      {!loaded ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--slate)", fontFamily: "var(--sans)" }}>
          Loading the wire…
        </div>
      ) : selected ? (
        <ArticleView article={selected} onBack={() => setSelected(null)} />
      ) : section ? (
        <SectionPage section={section} articles={articles} onSelect={setSelected} />
      ) : (
        <FrontPage articles={articles} onSelect={setSelected} />
      )}

      <footer
        style={{
          borderTop: "1px solid var(--rule)",
          padding: "24px 20px",
          textAlign: "center",
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--slate)",
          letterSpacing: "0.04em",
        }}
      >
        THE ONE JOURNAL — DEMO BUILD &middot; ARTICLES STORED IN SHARED DEMO STORAGE
      </footer>

      {showGate && (
        <AdminGate
          onCancel={() => setShowGate(false)}
          onSuccess={() => {
            setShowGate(false);
            setShowAdmin(true);
          }}
        />
      )}
      {showAdmin && (
        <AdminPanel articles={articles} setArticles={setArticles} onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}
