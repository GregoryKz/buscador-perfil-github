import {
    getRepo, getBranches, getTree, getLanguages, getFileText, getFileBlob,
    rawUrl, zipUrl, githubUrl,
} from "../api.js";
import {
    html, raw, mount, icon, num, compact, ago, date, bytes, plural,
    loading, errorBox, copyText, downloadBlob, debounce, toast,
} from "../ui.js";
import { langColor, hljsLanguage, fileKind } from "../langs.js";

const MAX_HIGHLIGHT = 400 * 1024;   // acima disso, mostra sem cores
const MAX_SHOW = 2 * 1024 * 1024;   // acima disso, só oferece o download

// Estado do repositório aberto, para trocar de arquivo sem recarregar tudo.
let current = null;

export function repoHref(owner, repo, path = "", ref = null, line = null) {
    let h = `#/${owner}/${repo}`;
    if (path) h += "/" + path.split("/").map(encodeURIComponent).join("/");
    const q = new URLSearchParams();
    if (ref && current && ref !== current.info.default_branch) q.set("ref", ref);
    if (line) q.set("line", line);
    const qs = q.toString();
    return qs ? `${h}?${qs}` : h;
}

export function isSameRepo(params) {
    return current && current.owner.toLowerCase() === params.owner.toLowerCase()
        && current.repo.toLowerCase() === params.repo.toLowerCase()
        && (params.ref || current.info.default_branch) === current.ref
        && document.getElementById("viewer");
}

export async function renderRepo(main, params) {
    const { owner, repo } = params;
    current = null;
    mount(main, loading(`Abrindo ${owner}/${repo}`));

    let info;
    try {
        info = await getRepo(owner, repo);
    } catch (err) {
        const notFound = err.kind === "notfound";
        mount(main, html`<div class="narrow">${errorBox(notFound ? { message: `O repositório ${owner}/${repo} não existe ou é privado.` } : err, {
            title: notFound ? "Repositório não encontrado" : "Não foi possível abrir o repositório",
            action: html`<p><a class="btn" href="#/${owner}">Ver repositórios de ${owner}</a></p>`,
        })}</div>`);
        return;
    }

    const ref = params.ref || info.default_branch;
    current = { owner: info.owner.login, repo: info.name, ref, info, items: [], byPath: new Map() };
    document.title = `${info.full_name} · Buscador de perfis`;

    mount(main, html`
        <div class="repo-page">
            ${headerHtml(info, ref)}
            <div class="browser">
                <nav class="tree" aria-label="Arquivos do repositório" id="tree">${loading("Lendo arquivos")}</nav>
                <section class="viewer" id="viewer" aria-live="polite"></section>
            </div>
        </div>`);

    bindHeader(main, info);
    getLanguages(info.owner.login, info.name).then((l) => renderLangs(main.querySelector("#repo-langs"), l)).catch(() => {});
    getBranches(info.owner.login, info.name).then((b) => fillBranches(main.querySelector("#branch"), b, ref)).catch(() => {});

    const treeEl = main.querySelector("#tree");
    const viewer = main.querySelector("#viewer");

    if (info.size === 0) {
        mount(treeEl, "");
        mount(viewer, emptyRepo(info));
        return;
    }

    try {
        const { items, truncated } = await getTree(current.owner, current.repo, ref);
        current.items = items;
        items.forEach((it) => current.byPath.set(it.path, it));
        renderTree(treeEl, items, truncated);
    } catch (err) {
        mount(treeEl, "");
        if (err.kind === "empty") mount(viewer, emptyRepo(info));
        else if (err.kind === "notfound") mount(viewer, errorBox({ message: `O branch “${ref}” não existe neste repositório.` }, { title: "Branch não encontrado", action: html`<p><a class="btn" href="#/${current.owner}/${current.repo}">Abrir o branch principal</a></p>` }));
        else mount(viewer, errorBox(err, { title: "Não foi possível listar os arquivos" }));
        return;
    }

    openPath(params.path || "", params.line);
}

export function updateRepo(params) {
    openPath(params.path || "", params.line);
}

// ---------- Cabeçalho ----------

function headerHtml(r, ref) {
    const license = r.license && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : null;
    return html`
        <header class="repo-head">
            <div class="repo-head__title">
                <p class="crumbs"><a href="#/${r.owner.login}"><img src="${r.owner.avatar_url}&s=48" alt="" width="22" height="22">${r.owner.login}</a><span aria-hidden="true">/</span></p>
                <h1>${r.name}</h1>
                ${r.private ? html`<span class="tag">privado</span>` : ""}
                ${r.archived ? html`<span class="tag">arquivado</span>` : ""}
            </div>
            ${r.fork && r.parent ? html`<p class="repo-head__fork">${icon("fork")} Fork de <a href="#/${r.parent.owner.login}/${r.parent.name}">${r.parent.full_name}</a></p>` : ""}
            ${r.description ? html`<p class="repo-head__desc">${r.description}</p>` : ""}
            ${r.topics?.length ? html`<ul class="topics">${r.topics.map((t) => html`<li>${t}</li>`)}</ul>` : ""}

            <dl class="repo-facts">
                <div><dt>Estrelas</dt><dd>${compact(r.stargazers_count)}</dd></div>
                <div><dt>Forks</dt><dd>${compact(r.forks_count)}</dd></div>
                <div><dt>Criado em</dt><dd>${date(r.created_at)}</dd></div>
                <div><dt>Último envio</dt><dd><time datetime="${r.pushed_at}" title="${date(r.pushed_at)}">${ago(r.pushed_at)}</time></dd></div>
                ${license ? html`<div><dt>Licença</dt><dd>${license}</dd></div>` : ""}
            </dl>
            <div id="repo-langs"></div>

            <div class="repo-actions">
                <label class="field field--branch">${icon("fork")}<span class="sr-only">Branch</span>
                    <select id="branch"><option>${ref}</option></select></label>
                <a class="btn btn--pen" id="zip" href="${zipUrl(r.owner.login, r.name, ref)}">${icon("download")}Baixar ZIP</a>
                <button class="btn" type="button" id="clone">${icon("copy")}Copiar git clone</button>
                <a class="btn" href="${githubUrl(r.owner.login, r.name, ref === r.default_branch ? null : ref)}" target="_blank" rel="noopener">${icon("external")}Abrir no GitHub</a>
            </div>
        </header>`;
}

function bindHeader(main, info) {
    main.querySelector("#clone").addEventListener("click", () =>
        copyText(`git clone ${info.clone_url}`, "Comando git clone copiado"));
    main.querySelector("#branch").addEventListener("change", (e) => {
        location.hash = repoHref(info.owner.login, info.name, "", e.target.value);
    });
}

function fillBranches(select, branches, ref) {
    if (!branches.length) return;
    const names = branches.map((b) => b.name);
    if (!names.includes(ref)) names.unshift(ref);
    mount(select, names.map((n) => html`<option ${n === ref ? raw("selected") : ""}>${n}</option>`));
    select.closest(".field").title = plural(branches.length, "branch", "branches");
}

function renderLangs(el, langs) {
    const entries = Object.entries(langs);
    const total = entries.reduce((s, [, n]) => s + n, 0);
    if (!total) return;
    const pct = (n) => ((n / total) * 100).toFixed(1).replace(".", ",");
    mount(el, html`
        <div class="langbar langbar--thin" aria-hidden="true">
            ${entries.map(([l, n]) => html`<span style="width:${(n / total) * 100}%;background:${langColor(l)}"></span>`)}
        </div>
        <ul class="langlist langlist--inline">
            ${entries.slice(0, 6).map(([l, n]) => html`<li><span class="dot" style="background:${langColor(l)}"></span>${l} <span class="langlist__n">${pct(n)}%</span></li>`)}
        </ul>`);
}

function emptyRepo(info) {
    return html`<div class="state"><p class="state__title">Repositório vazio</p><p>${info.full_name} ainda não tem nenhum arquivo enviado.</p></div>`;
}

// ---------- Árvore de arquivos ----------

function buildTree(items) {
    const root = { name: "", path: "", dirs: new Map(), files: [] };
    for (const it of items) {
        const parts = it.path.split("/");
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
            const key = parts[i];
            if (!node.dirs.has(key)) node.dirs.set(key, { name: key, path: parts.slice(0, i + 1).join("/"), dirs: new Map(), files: [] });
            node = node.dirs.get(key);
        }
        if (it.type === "tree") {
            if (!node.dirs.has(parts.at(-1))) node.dirs.set(parts.at(-1), { name: parts.at(-1), path: it.path, dirs: new Map(), files: [] });
        } else if (it.type === "blob") {
            node.files.push({ name: parts.at(-1), path: it.path, size: it.size });
        }
    }
    return root;
}

const byName = (a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true });

function nodeChildrenHtml(node) {
    const { owner, repo, ref } = current;
    const dirs = [...node.dirs.values()].sort(byName);
    const files = [...node.files].sort(byName);
    return html`${dirs.map((d) => html`
        <li><details data-path="${d.path}"><summary>${icon("chevron", "ico--chev")}${icon("folder")}<span>${d.name}</span></summary><ul></ul></details></li>`)}
        ${files.map((f) => html`
        <li><a class="tree__file" href="${repoHref(owner, repo, f.path, ref)}" data-path="${f.path}">${icon("file")}<span>${f.name}</span></a></li>`)}`;
}

function renderTree(el, items, truncated) {
    const root = buildTree(items);
    current.root = root;
    const fileCount = items.filter((i) => i.type === "blob").length;

    mount(el, html`
        <div class="tree__head">
            <a class="tree__root" href="${repoHref(current.owner, current.repo, "", current.ref)}">Arquivos</a>
            <span class="count">${num(fileCount)}</span>
        </div>
        <label class="field tree__filter"><span class="sr-only">Filtrar arquivos</span>
            <input type="search" id="tree-q" placeholder="Filtrar arquivos"></label>
        ${truncated ? html`<p class="tree__warn">Repositório muito grande: a lista abaixo está incompleta. Baixe o ZIP para ver tudo.</p>` : ""}
        <ul class="tree__list" id="tree-list">${nodeChildrenHtml(root)}</ul>
        <ul class="tree__list" id="tree-results" hidden></ul>`);

    const list = el.querySelector("#tree-list");
    const results = el.querySelector("#tree-results");

    // Pastas preenchidas sob demanda: repositórios grandes continuam leves.
    list.addEventListener("toggle", (e) => {
        const det = e.target;
        if (!det.open || det.dataset.filled) return;
        const node = findNode(det.dataset.path);
        if (node) mount(det.querySelector("ul"), nodeChildrenHtml(node));
        det.dataset.filled = "1";
        markCurrent();
    }, true);

    el.querySelector("#tree-q").addEventListener("input", debounce((e) => {
        const q = e.target.value.trim().toLowerCase();
        list.hidden = !!q;
        results.hidden = !q;
        if (!q) return;
        const hits = items.filter((i) => i.type === "blob" && i.path.toLowerCase().includes(q)).slice(0, 200);
        mount(results, hits.length ? hits.map((f) => html`
            <li><a class="tree__file tree__file--full" href="${repoHref(current.owner, current.repo, f.path, current.ref)}" data-path="${f.path}">${icon("file")}<span>${f.path}</span></a></li>`)
            : html`<li class="tree__none">Nenhum arquivo com “${q}”.</li>`);
        markCurrent();
    }, 120));
}

function findNode(path) {
    let node = current.root;
    if (!path) return node;
    for (const part of path.split("/")) {
        node = node?.dirs.get(part);
    }
    return node;
}

function revealInTree(path) {
    const parts = path.split("/");
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i];
        const det = document.querySelector(`#tree-list details[data-path="${CSS.escape(acc)}"]`);
        if (det && !det.open) {
            const node = findNode(acc);
            if (node && !det.dataset.filled) { mount(det.querySelector("ul"), nodeChildrenHtml(node)); det.dataset.filled = "1"; }
            det.open = true;
        }
    }
}

function markCurrent() {
    const path = current?.path || "";
    document.querySelectorAll(".tree__file[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
    document.querySelectorAll(`.tree__file[data-path="${CSS.escape(path)}"]`).forEach((a) => a.setAttribute("aria-current", "page"));
}

// ---------- Visualizador ----------

function crumbsHtml(path) {
    const { owner, repo, ref } = current;
    const parts = path ? path.split("/") : [];
    return html`<nav class="path" aria-label="Caminho">
        <a href="${repoHref(owner, repo, "", ref)}">${repo}</a>
        ${parts.map((p, i) => {
            const sub = parts.slice(0, i + 1).join("/");
            return i === parts.length - 1
                ? html`<span aria-hidden="true">/</span><strong aria-current="page">${p}</strong>`
                : html`<span aria-hidden="true">/</span><a href="${repoHref(owner, repo, sub, ref)}">${p}</a>`;
        })}
    </nav>`;
}

async function openPath(path, line) {
    if (!current) return;
    const viewer = document.getElementById("viewer");
    if (!viewer) return;
    current.path = path;
    const item = path ? current.byPath.get(path) : null;

    if (path && !item && !findNode(path)) {
        mount(viewer, errorBox({ message: `“${path}” não existe no branch ${current.ref}.` }, { title: "Arquivo não encontrado" }));
        return;
    }

    if (!item || item.type === "tree") {
        revealInTree(path + "/x");
        markCurrent();
        return renderDir(viewer, path);
    }

    revealInTree(path);
    markCurrent();
    document.title = `${path.split("/").pop()} · ${current.info.full_name}`;
    await renderFile(viewer, item, line);
}

function renderDir(viewer, path) {
    const node = findNode(path);
    const { owner, repo, ref } = current;
    const dirs = [...node.dirs.values()].sort(byName);
    const files = [...node.files].sort(byName);
    const readme = files.find((f) => /^readme(\.md|\.markdown|\.txt)?$/i.test(f.name));

    mount(viewer, html`
        <div class="viewer__bar">${crumbsHtml(path)}</div>
        <ul class="dir">
            ${path ? html`<li><a href="${repoHref(owner, repo, path.split("/").slice(0, -1).join("/"), ref)}">${icon("folder")}<span>..</span></a></li>` : ""}
            ${dirs.map((d) => html`<li><a href="${repoHref(owner, repo, d.path, ref)}">${icon("folder")}<span>${d.name}</span></a></li>`)}
            ${files.map((f) => html`<li><a href="${repoHref(owner, repo, f.path, ref)}">${icon("file")}<span>${f.name}</span><small>${bytes(f.size || 0)}</small></a></li>`)}
        </ul>
        ${readme ? html`<article class="readme" id="readme"><h2 class="readme__label">${icon("book")}${readme.name}</h2><div class="markdown">${loading("Lendo o README")}</div></article>` : ""}`);

    if (readme) {
        const target = viewer.querySelector("#readme .markdown");
        getFileText(owner, repo, ref, readme.path)
            .then((text) => mount(target, /\.txt$/i.test(readme.name) ? html`<pre>${text}</pre>` : markdownHtml(text, readme.path)))
            .catch((err) => mount(target, errorBox(err)));
    }
}

async function renderFile(viewer, item, line) {
    const { owner, repo, ref } = current;
    const path = item.path;
    const kind = fileKind(path);
    const name = path.split("/").pop();

    mount(viewer, html`
        <div class="viewer__bar">
            ${crumbsHtml(path)}
            <div class="viewer__tools">
                <span class="viewer__info" id="file-info">${bytes(item.size || 0)}</span>
                ${kind === "markdown" || kind === "notebook" ? html`<div class="seg" role="group" aria-label="Modo de exibição">
                    <button type="button" class="seg__btn" data-mode="preview" aria-pressed="true">Visualizar</button>
                    <button type="button" class="seg__btn" data-mode="code" aria-pressed="false">Código</button></div>` : ""}
                ${kind !== "image" && kind !== "binary" ? html`<button class="btn btn--sm" type="button" id="copy-file">${icon("copy")}Copiar</button>` : ""}
                <button class="btn btn--sm" type="button" id="dl-file">${icon("download")}Baixar</button>
                <a class="btn btn--sm btn--icon" href="${githubUrl(owner, repo, ref, path)}" target="_blank" rel="noopener" title="Abrir no GitHub" aria-label="Abrir no GitHub">${icon("external")}</a>
            </div>
        </div>
        <div class="viewer__body" id="file-body">${loading("Abrindo arquivo")}</div>`);

    const body = viewer.querySelector("#file-body");

    viewer.querySelector("#dl-file").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
            downloadBlob(await getFileBlob(owner, repo, ref, path), name);
        } catch (err) {
            toast(err.message);
        } finally {
            btn.disabled = false;
        }
    });

    if (kind === "image") {
        let src = rawUrl(owner, repo, ref, path);
        if (/\.svg$/i.test(path)) {
            try { src = URL.createObjectURL(new Blob([await getFileText(owner, repo, ref, path)], { type: "image/svg+xml" })); } catch { /* usa o link cru */ }
        }
        mount(body, html`<figure class="image-view"><img src="${src}" alt="${name}"></figure>`);
        return;
    }
    if (kind === "binary") {
        mount(body, html`<div class="state"><p class="state__title">Arquivo binário</p><p>${name} não é texto, então não dá para exibir aqui. Use “Baixar” para abrir no seu computador.</p></div>`);
        return;
    }
    if ((item.size || 0) > MAX_SHOW) {
        mount(body, html`<div class="state"><p class="state__title">Arquivo grande demais para exibir</p><p>${name} tem ${bytes(item.size)}. Use “Baixar” para abrir no seu computador.</p></div>`);
        return;
    }

    let text;
    try {
        text = await getFileText(owner, repo, ref, path);
    } catch (err) {
        mount(body, errorBox(err, { title: "Não foi possível abrir o arquivo" }));
        return;
    }
    if (current?.path !== path) return; // o usuário já abriu outro arquivo

    const lineCount = text.length ? text.split("\n").length - (text.endsWith("\n") ? 1 : 0) : 0;
    viewer.querySelector("#file-info").textContent = `${plural(lineCount, "linha", "linhas")}, ${bytes(item.size || text.length)}`;
    viewer.querySelector("#copy-file")?.addEventListener("click", () => copyText(text, "Código copiado"));

    const showCode = () => {
        mount(body, codeHtml(text, path));
        bindLines(body, line);
    };
    const showPreview = () => {
        if (kind === "notebook") mount(body, notebookHtml(text, path));
        else mount(body, html`<article class="markdown markdown--file">${markdownHtml(text, path)}</article>`);
    };

    const seg = viewer.querySelector(".seg");
    if (seg) {
        seg.addEventListener("click", (e) => {
            const b = e.target.closest("[data-mode]");
            if (!b) return;
            seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            b.dataset.mode === "code" ? showCode() : showPreview();
        });
        if (line) {
            seg.querySelector('[data-mode="code"]').click();
        } else {
            showPreview();
        }
    } else {
        showCode();
    }
}

// ---------- Código com números de linha ----------

function splitHighlighted(markup) {
    const lines = [];
    const open = [];
    let cur = "";
    const re = /(<span[^>]*>)|(<\/span>)|(\n)|([^<\n]+)/g;
    let m;
    while ((m = re.exec(markup))) {
        if (m[1]) { open.push(m[1]); cur += m[1]; }
        else if (m[2]) { open.pop(); cur += m[2]; }
        else if (m[3]) { cur += "</span>".repeat(open.length); lines.push(cur); cur = open.join(""); }
        else cur += m[4];
    }
    lines.push(cur);
    return lines;
}

function codeHtml(text, path) {
    const lang = hljsLanguage(path);
    let markup;
    if (window.hljs && text.length <= MAX_HIGHLIGHT) {
        markup = lang
            ? window.hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
            : window.hljs.highlight(text, { language: "plaintext" }).value;
    } else {
        markup = String(html`${text}`);
    }
    const lines = splitHighlighted(markup);
    if (lines.length > 1 && lines.at(-1) === "") lines.pop();

    return raw(`<div class="code hljs" data-lang="${lang || "texto"}"><div class="code__inner">${lines.map((l, i) =>
        `<div class="ln" id="L${i + 1}"><button type="button" class="ln__n" data-line="${i + 1}" aria-label="Linha ${i + 1}">${i + 1}</button><span class="ln__c">${l || " "}</span></div>`
    ).join("")}</div></div>`);
}

function parseLine(v) {
    if (!v) return null;
    const [a, b] = String(v).split("-").map(Number);
    if (!a) return null;
    return [Math.min(a, b || a), Math.max(a, b || a)];
}

function bindLines(body, initial) {
    let sel = parseLine(initial);
    let anchor = sel ? sel[0] : null;

    const apply = (scroll) => {
        body.querySelectorAll(".ln.is-sel").forEach((l) => l.classList.remove("is-sel"));
        if (!sel) return;
        for (let i = sel[0]; i <= sel[1]; i++) body.querySelector(`#L${i}`)?.classList.add("is-sel");
        if (scroll) body.querySelector(`#L${sel[0]}`)?.scrollIntoView({ block: "center" });
    };

    body.addEventListener("click", (e) => {
        const btn = e.target.closest(".ln__n");
        if (!btn) return;
        const n = Number(btn.dataset.line);
        if (e.shiftKey && anchor) sel = [Math.min(anchor, n), Math.max(anchor, n)];
        else if (sel && sel[0] === n && sel[1] === n) { sel = null; anchor = null; }
        else { sel = [n, n]; anchor = n; }
        apply(false);
        const lineParam = sel ? (sel[0] === sel[1] ? `${sel[0]}` : `${sel[0]}-${sel[1]}`) : null;
        history.replaceState(null, "", repoHref(current.owner, current.repo, current.path, current.ref, lineParam));
    });

    apply(true);
}

// ---------- Markdown e notebooks ----------

function isRelative(url) {
    return url && !/^([a-z][a-z\d+.-]*:|\/\/|#|data:)/i.test(url);
}

function resolvePath(base, rel) {
    const dir = base.split("/").slice(0, -1);
    const parts = rel.startsWith("/") ? [] : dir;
    for (const p of rel.replace(/^\//, "").split("/")) {
        if (p === "..") parts.pop();
        else if (p && p !== ".") parts.push(p);
    }
    return parts.join("/");
}

export function markdownHtml(text, filePath) {
    if (!window.marked || !window.DOMPurify) return html`<pre>${text}</pre>`;
    const clean = window.DOMPurify.sanitize(window.marked.parse(text, { gfm: true }), { ADD_ATTR: ["target"] });
    const tpl = document.createElement("template");
    tpl.innerHTML = clean;
    const { owner, repo, ref } = current;

    tpl.content.querySelectorAll("img[src]").forEach((img) => {
        const src = img.getAttribute("src");
        if (isRelative(src)) img.src = rawUrl(owner, repo, ref, resolvePath(filePath, src.split(/[?#]/)[0]));
        img.loading = "lazy";
    });
    tpl.content.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href");
        if (href.startsWith("#")) { a.removeAttribute("href"); return; }
        if (isRelative(href)) {
            a.setAttribute("href", repoHref(owner, repo, resolvePath(filePath, decodeURIComponent(href.split(/[?#]/)[0])), ref));
        } else {
            a.target = "_blank";
            a.rel = "noopener";
        }
    });
    tpl.content.querySelectorAll("pre code").forEach((code) => {
        if (window.hljs) window.hljs.highlightElement(code);
    });
    const div = document.createElement("div");
    div.append(tpl.content);
    return raw(div.innerHTML);
}

function notebookHtml(text, path) {
    let nb;
    try { nb = JSON.parse(text); } catch {
        return errorBox({ message: "O notebook não é um JSON válido. Use “Código” para ver o conteúdo cru." });
    }
    const lang = nb.metadata?.kernelspec?.language || nb.metadata?.language_info?.name || "python";
    const src = (s) => (Array.isArray(s) ? s.join("") : s || "");

    const cells = (nb.cells || []).map((c, i) => {
        const source = src(c.source);
        if (c.cell_type === "markdown") return html`<div class="nb-cell nb-cell--md markdown">${markdownHtml(source, path)}</div>`;
        if (c.cell_type !== "code") return html`<pre class="nb-cell">${source}</pre>`;
        const code = window.hljs?.getLanguage(lang)
            ? raw(window.hljs.highlight(source, { language: lang, ignoreIllegals: true }).value)
            : source;
        const outputs = (c.outputs || []).map((o) => {
            if (o.output_type === "stream") return html`<pre class="nb-out">${src(o.text)}</pre>`;
            if (o.output_type === "error") return html`<pre class="nb-out nb-out--err">${o.ename}: ${o.evalue}</pre>`;
            const d = o.data || {};
            if (d["image/png"]) return html`<img class="nb-img" alt="Saída da célula ${i + 1}" src="data:image/png;base64,${src(d["image/png"]).replace(/\s/g, "")}">`;
            if (d["text/plain"]) return html`<pre class="nb-out">${src(d["text/plain"])}</pre>`;
            return "";
        });
        return html`<div class="nb-cell nb-cell--code">
            <span class="nb-count">[${c.execution_count ?? " "}]</span>
            <pre class="hljs"><code>${code}</code></pre>
            ${outputs}
        </div>`;
    });
    return html`<div class="notebook">${cells}</div>`;
}
