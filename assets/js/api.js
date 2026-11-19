// Cliente da API do GitHub.
// Centraliza cache, token, limite de requisições e mensagens de erro,
// para que o resto do app (e a futura correção automática) só chame funções.

const BASE = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const TOKEN_KEY = "bpg:token";

export const rate = { remaining: null, limit: null, reset: null };
const rateListeners = new Set();
const cache = new Map();

export class ApiError extends Error {
    constructor(message, { status = 0, kind = "unknown", reset = null } = {}) {
        super(message);
        this.status = status;
        this.kind = kind;
        this.reset = reset;
    }
}

export function onRateChange(fn) {
    rateListeners.add(fn);
    fn(rate);
}

export function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

export function setToken(token) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch { /* navegação privada: segue só em memória */ }
    cache.clear();
}

function updateRate(res) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === null) return;
    rate.remaining = Number(remaining);
    rate.limit = Number(res.headers.get("x-ratelimit-limit"));
    rate.reset = new Date(Number(res.headers.get("x-ratelimit-reset")) * 1000);
    rateListeners.forEach((fn) => fn(rate));
}

function timeUntil(date) {
    const min = Math.max(1, Math.ceil((date - Date.now()) / 60000));
    return min === 1 ? "1 minuto" : `${min} minutos`;
}

async function toError(res) {
    let body = {};
    try { body = await res.json(); } catch { /* corpo vazio */ }
    const msg = (body.message || "").toLowerCase();

    if (res.status === 401) {
        return new ApiError("O token salvo foi recusado pelo GitHub. Remova ou troque o token em “Token”.", { status: 401, kind: "auth" });
    }
    if ((res.status === 403 || res.status === 429) && (rate.remaining === 0 || msg.includes("rate limit"))) {
        const reset = rate.reset;
        const quando = reset ? ` Ele volta em ${timeUntil(reset)}.` : "";
        return new ApiError(
            `O limite de consultas do GitHub acabou.${quando} Para consultar mais, adicione um token pessoal em “Token”.`,
            { status: res.status, kind: "ratelimit", reset }
        );
    }
    if (res.status === 404) return new ApiError("Não encontrado.", { status: 404, kind: "notfound" });
    if (res.status === 409) return new ApiError("Este repositório está vazio.", { status: 409, kind: "empty" });
    if (res.status === 451) return new ApiError("Este conteúdo foi bloqueado pelo GitHub.", { status: 451, kind: "blocked" });
    return new ApiError(body.message || `O GitHub respondeu com erro ${res.status}.`, { status: res.status });
}

async function request(path, { as = "json" } = {}) {
    const url = path.startsWith("http") ? path : BASE + path;
    const key = `${as} ${url}`;
    if (cache.has(key)) return cache.get(key);

    const isApi = url.startsWith(BASE);
    const headers = {};
    if (isApi) {
        headers.Accept = "application/vnd.github+json";
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const promise = (async () => {
        let res;
        try {
            res = await fetch(url, { headers });
        } catch {
            throw new ApiError("Não foi possível falar com o GitHub. Confira sua conexão e tente de novo.", { kind: "network" });
        }
        if (isApi) updateRate(res);
        if (!res.ok) throw await toError(res);

        const link = res.headers.get("link");
        let data;
        if (as === "text") data = await res.text();
        else if (as === "blob") data = await res.blob();
        else data = await res.json();
        return { data, link };
    })();

    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    return promise;
}

function nextPage(link) {
    if (!link) return null;
    const match = link.split(",").find((part) => part.includes('rel="next"'));
    return match ? match.slice(match.indexOf("<") + 1, match.indexOf(">")) : null;
}

const enc = (s) => encodeURIComponent(s);
const encPath = (p) => p.split("/").map(enc).join("/");

// ---------- Usuários ----------

export async function getUser(login) {
    return (await request(`/users/${enc(login)}`)).data;
}

/** Busca por login ou nome. Retorna até `limit` usuários (login, avatar, tipo). */
export async function searchUsers(query, limit = 8) {
    const q = `${query} in:login in:name`;
    const { data } = await request(`/search/users?q=${enc(q)}&per_page=${limit}`);
    return data.items || [];
}

/** Todos os repositórios públicos do usuário (até 500). */
export async function getRepos(login, maxPages = 5) {
    let url = `/users/${enc(login)}/repos?per_page=100&sort=updated&type=owner`;
    const all = [];
    for (let page = 0; url && page < maxPages; page++) {
        const { data, link } = await request(url);
        all.push(...data);
        url = nextPage(link);
    }
    return all;
}

export async function getOrgs(login) {
    return (await request(`/users/${enc(login)}/orgs?per_page=30`)).data;
}

export async function getEvents(login) {
    return (await request(`/users/${enc(login)}/events/public?per_page=30`)).data;
}

// ---------- Repositórios ----------

export async function getRepo(owner, repo) {
    return (await request(`/repos/${enc(owner)}/${enc(repo)}`)).data;
}

export async function getBranches(owner, repo) {
    return (await request(`/repos/${enc(owner)}/${enc(repo)}/branches?per_page=100`)).data;
}

export async function getLanguages(owner, repo) {
    return (await request(`/repos/${enc(owner)}/${enc(repo)}/languages`)).data;
}

/** Árvore completa de arquivos de um branch. `truncated` = true em repositórios enormes. */
export async function getTree(owner, repo, ref) {
    const { data } = await request(`/repos/${enc(owner)}/${enc(repo)}/git/trees/${enc(ref)}?recursive=1`);
    return { items: data.tree || [], truncated: !!data.truncated };
}

/** URL do arquivo cru (não consome o limite da API). */
export function rawUrl(owner, repo, ref, path) {
    return `${RAW}/${enc(owner)}/${enc(repo)}/${encPath(ref)}/${encPath(path)}`;
}

export async function getFileText(owner, repo, ref, path) {
    return (await request(rawUrl(owner, repo, ref, path), { as: "text" })).data;
}

export async function getFileBlob(owner, repo, ref, path) {
    return (await request(rawUrl(owner, repo, ref, path), { as: "blob" })).data;
}

export function zipUrl(owner, repo, ref) {
    return `https://github.com/${enc(owner)}/${enc(repo)}/archive/${encPath(ref)}.zip`;
}

export function githubUrl(owner, repo, ref, path) {
    let url = `https://github.com/${enc(owner)}/${enc(repo)}`;
    if (ref && path) url += `/blob/${encPath(ref)}/${encPath(path)}`;
    else if (ref) url += `/tree/${encPath(ref)}`;
    return url;
}
