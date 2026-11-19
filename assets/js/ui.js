// Utilitários de interface: HTML seguro, formatação e pequenos componentes.

class Raw {
    constructor(s) { this.s = s; }
    toString() { return this.s; }
}

export const raw = (s) => new Raw(s);

export function esc(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function render(v) {
    if (v === null || v === undefined || v === false) return "";
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(render).join("");
    return esc(v);
}

/** Template que escapa tudo por padrão. Use raw() só para HTML já confiável. */
export function html(strings, ...values) {
    let out = strings[0];
    values.forEach((v, i) => { out += render(v) + strings[i + 1]; });
    return raw(out);
}

export function mount(el, content) {
    el.innerHTML = render(content);
}

/** Só aceita links http(s); evita "javascript:" vindo de campos do perfil. */
export function safeUrl(url) {
    if (!url) return null;
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
        const u = new URL(withProto);
        return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
    } catch { return null; }
}

const nf = new Intl.NumberFormat("pt-BR");
const nfCompact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const df = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });
const dfMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export const num = (n) => nf.format(n || 0);
export const compact = (n) => (n >= 10000 ? nfCompact.format(n) : nf.format(n || 0));
export const date = (d) => df.format(new Date(d));
export const monthYear = (d) => dfMonth.format(new Date(d));

export function ago(d) {
    const diff = (new Date(d) - Date.now()) / 1000;
    const units = [
        ["year", 31536000], ["month", 2592000], ["week", 604800],
        ["day", 86400], ["hour", 3600], ["minute", 60],
    ];
    for (const [unit, sec] of units) {
        if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
    }
    return "agora há pouco";
}

export function bytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace(".", ",")} KB`;
    return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function plural(n, one, many) {
    return `${num(n)} ${n === 1 ? one : many}`;
}

// ---------- Ícones (traço simples, 16px) ----------

const paths = {
    star: '<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>',
    fork: '<circle cx="4" cy="3" r="1.6"/><circle cx="12" cy="3" r="1.6"/><circle cx="8" cy="13" r="1.6"/><path d="M4 4.6v1.2c0 1.2 1 2.2 2.2 2.2h3.6c1.2 0 2.2-1 2.2-2.2V4.6M8 8v3.4"/>',
    download: '<path d="M8 2v8M4.5 6.8L8 10.3l3.5-3.5M2.5 13.5h11"/>',
    external: '<path d="M9.5 2.5h4v4M13.5 2.5L7 9M11.5 9.5v4h-9v-9h4"/>',
    copy: '<rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M11 5V3.5c0-.8-.7-1.5-1.5-1.5h-6C2.7 2 2 2.7 2 3.5v6c0 .8.7 1.5 1.5 1.5H5"/>',
    folder: '<path d="M1.8 4.2c0-.8.6-1.4 1.4-1.4h3l1.5 1.6h5.1c.8 0 1.4.6 1.4 1.4v6.5c0 .8-.6 1.4-1.4 1.4H3.2c-.8 0-1.4-.6-1.4-1.4z"/>',
    file: '<path d="M4 1.8h5l3.2 3.2v8.2c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1V2.8c0-.6.4-1 1-1z"/><path d="M9 1.8V5h3.2"/>',
    chevron: '<path d="M6 4l4 4-4 4"/>',
    location: '<path d="M8 14.5s4.8-4.3 4.8-8a4.8 4.8 0 10-9.6 0c0 3.7 4.8 8 4.8 8z"/><circle cx="8" cy="6.5" r="1.6"/>',
    building: '<path d="M2.5 14V3.2c0-.6.4-1 1-1h5.5c.6 0 1 .4 1 1V14M10 6.5h2.5c.6 0 1 .4 1 1V14M1.5 14h13M5 5h2M5 8h2M5 11h2"/>',
    link: '<path d="M6.8 9.2a3 3 0 004.2 0l2-2a3 3 0 00-4.2-4.2l-.9.9M9.2 6.8a3 3 0 00-4.2 0l-2 2a3 3 0 004.2 4.2l.9-.9"/>',
    mail: '<rect x="1.8" y="3.2" width="12.4" height="9.6" rx="1.2"/><path d="M2.2 4l5.8 4.6L13.8 4"/>',
    calendar: '<rect x="2" y="3" width="12" height="11" rx="1.2"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3"/>',
    at: '<circle cx="8" cy="8" r="2.6"/><path d="M10.6 8v1c0 1.2 1 2 2 2s1.6-1 1.6-2.5A6.2 6.2 0 108 14.2c1.2 0 2.3-.3 3.2-.9"/>',
    key: '<circle cx="5" cy="11" r="2.8"/><path d="M7 9l6.5-6.5M11.5 4.5l1.5 1.5M10 6l1.2 1.2"/>',
    close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
    book: '<path d="M2 3c2-.8 4-.8 6 .6 2-1.4 4-1.4 6-.6v10c-2-.8-4-.8-6 .6-2-1.4-4-1.4-6-.6zM8 3.6v10"/>',
    code: '<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"/>',
};

export function icon(name, cls = "") {
    return raw(`<svg class="ico ${cls}" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ""}</svg>`);
}

// ---------- Toast ----------

let toastTimer;
export function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2400);
}

export async function copyText(text, okMessage = "Copiado") {
    try {
        await navigator.clipboard.writeText(text);
        toast(okMessage);
    } catch {
        toast("Não foi possível copiar. Selecione o texto e use Ctrl+C.");
    }
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

// ---------- Estados de carregamento e erro ----------

export function loading(text = "Carregando") {
    return html`<div class="state state--loading" role="status"><span class="spinner" aria-hidden="true"></span>${text}…</div>`;
}

export function errorBox(err, { title = "Não deu certo", action = "" } = {}) {
    return html`<div class="state state--error" role="alert">
        <p class="state__title">${title}</p>
        <p>${err.message || err}</p>
        ${action}
    </div>`;
}

// ---------- Vistos recentemente ----------

const RECENT_KEY = "bpg:recent";

export function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}

export function addRecent(user) {
    const item = { login: user.login, name: user.name || "", avatar: user.avatar_url };
    const list = [item, ...getRecent().filter((u) => u.login.toLowerCase() !== user.login.toLowerCase())].slice(0, 12);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* sem armazenamento */ }
}

export function clearRecent() {
    try { localStorage.removeItem(RECENT_KEY); } catch { /* sem armazenamento */ }
}
