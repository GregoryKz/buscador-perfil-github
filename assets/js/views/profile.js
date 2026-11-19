import { getUser, getRepos, getOrgs, getEvents, searchUsers, zipUrl } from "../api.js";
import {
    html, mount, icon, safeUrl, num, compact, ago, monthYear, plural,
    loading, errorBox, addRecent, debounce,
} from "../ui.js";
import { langColor } from "../langs.js";

const SORTS = {
    pushed: { label: "Atualizados recentemente", fn: (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at) },
    stars: { label: "Mais estrelas", fn: (a, b) => b.stargazers_count - a.stargazers_count },
    name: { label: "Nome (A–Z)", fn: (a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) },
    created: { label: "Criados recentemente", fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
};

export async function renderProfile(main, { login }) {
    mount(main, loading(`Carregando ${login}`));

    let user;
    try {
        user = await getUser(login);
    } catch (err) {
        return renderNotFound(main, login, err);
    }

    document.title = `${user.name || user.login} (${user.login}) · Buscador de perfis`;
    addRecent(user);

    mount(main, html`
        <div class="profile">
            <aside class="person" aria-label="Perfil">${personHtml(user)}
                <div id="langs"></div>
                <div id="orgs"></div>
                <div id="events"></div>
            </aside>
            <section class="repos" aria-labelledby="repos-title" id="repos">
                <div class="repos__head">
                    <h2 id="repos-title">Repositórios <span class="count">${num(user.public_repos)}</span></h2>
                </div>
                ${loading("Carregando repositórios")}
            </section>
        </div>`);

    const reposEl = main.querySelector("#repos");

    getRepos(user.login)
        .then((repos) => {
            renderRepos(reposEl, user, repos);
            renderLangs(main.querySelector("#langs"), repos);
            const stars = repos.filter((r) => !r.fork).reduce((s, r) => s + r.stargazers_count, 0);
            const starEl = main.querySelector("#stars-total");
            if (starEl) starEl.textContent = compact(stars);
        })
        .catch((err) => mount(reposEl, errorBox(err, { title: "Não foi possível carregar os repositórios" })));

    getOrgs(user.login).then((orgs) => renderOrgs(main.querySelector("#orgs"), orgs)).catch(() => {});
    getEvents(user.login).then((ev) => renderEvents(main.querySelector("#events"), ev)).catch(() => {});
}

function personHtml(u) {
    const blog = safeUrl(u.blog);
    const facts = [
        u.company && html`<li>${icon("building")}<span>${u.company}</span></li>`,
        u.location && html`<li>${icon("location")}<span>${u.location}</span></li>`,
        blog && html`<li>${icon("link")}<a href="${blog}" target="_blank" rel="noopener">${blog.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></li>`,
        u.email && html`<li>${icon("mail")}<a href="mailto:${u.email}">${u.email}</a></li>`,
        u.twitter_username && html`<li>${icon("at")}<a href="https://x.com/${u.twitter_username}" target="_blank" rel="noopener">${u.twitter_username}</a></li>`,
        html`<li>${icon("calendar")}<span>No GitHub desde ${monthYear(u.created_at)}</span></li>`,
    ].filter(Boolean);

    return html`
        <div class="person__id">
            <img class="person__avatar" src="${u.avatar_url}" alt="Foto de ${u.name || u.login}" width="200" height="200">
            <div>
                <h1 class="person__name">${u.name || u.login}</h1>
                <a class="person__login" href="${u.html_url}" target="_blank" rel="noopener">${u.login} ${icon("external")}</a>
            </div>
        </div>
        ${u.type === "Organization" ? html`<p class="tag">Organização</p>` : ""}
        ${u.hireable ? html`<p class="tag tag--ok">Disponível para contratação</p>` : ""}
        ${u.bio ? html`<p class="person__bio">${u.bio}</p>` : html`<p class="person__bio is-empty">Sem biografia.</p>`}

        <dl class="figures">
            <div><dt>Repositórios</dt><dd>${compact(u.public_repos)}</dd></div>
            <div><dt>Seguidores</dt><dd>${compact(u.followers)}</dd></div>
            <div><dt>Seguindo</dt><dd>${compact(u.following)}</dd></div>
            <div><dt>Estrelas recebidas</dt><dd id="stars-total">–</dd></div>
        </dl>

        <ul class="facts">${facts}</ul>`;
}

function renderLangs(el, repos) {
    const counts = {};
    repos.filter((r) => !r.fork && r.language).forEach((r) => { counts[r.language] = (counts[r.language] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return;
    const total = entries.reduce((s, [, n]) => s + n, 0);
    const top = entries.slice(0, 6);
    const rest = entries.slice(6).reduce((s, [, n]) => s + n, 0);
    if (rest) top.push(["Outras", rest]);

    mount(el, html`
        <section class="side-block">
            <h2>Linguagens</h2>
            <p class="side-block__note">Linguagem principal de cada repositório próprio.</p>
            <div class="langbar" aria-hidden="true">
                ${top.map(([l, n]) => html`<span style="width:${(n / total) * 100}%;background:${langColor(l)}"></span>`)}
            </div>
            <ul class="langlist">
                ${top.map(([l, n]) => html`<li><span class="dot" style="background:${langColor(l)}"></span>${l}<span class="langlist__n">${plural(n, "repo", "repos")}</span></li>`)}
            </ul>
        </section>`);
}

function renderOrgs(el, orgs) {
    if (!orgs.length) return;
    mount(el, html`
        <section class="side-block">
            <h2>Organizações</h2>
            <ul class="orgs">
                ${orgs.map((o) => html`<li><a href="#/${o.login}" title="${o.login}"><img src="${o.avatar_url}" alt="${o.login}" width="36" height="36" loading="lazy"></a></li>`)}
            </ul>
        </section>`);
}

function describeEvent(e) {
    const repo = e.repo.name;
    const [owner, name] = repo.split("/");
    const link = html`<a href="#/${owner}/${name}">${repo}</a>`;
    const p = e.payload || {};
    switch (e.type) {
        case "PushEvent": {
            const n = p.size ?? p.distinct_size;
            const branch = (p.ref || "").replace("refs/heads/", "");
            return n ? html`Enviou ${plural(n, "commit", "commits")} para ${link}${branch ? html` <span class="muted">(${branch})</span>` : ""}`
                : html`Enviou commits para ${link}`;
        }
        case "CreateEvent":
            return p.ref_type === "repository" ? html`Criou o repositório ${link}` : html`Criou ${p.ref_type === "tag" ? "a tag" : "o branch"} ${p.ref} em ${link}`;
        case "DeleteEvent": return html`Apagou ${p.ref_type === "tag" ? "a tag" : "o branch"} ${p.ref} em ${link}`;
        case "WatchEvent": return html`Deu estrela em ${link}`;
        case "ForkEvent": return html`Fez fork de ${link}`;
        case "PullRequestEvent": return html`${p.action === "closed" ? "Fechou" : p.action === "opened" ? "Abriu" : "Atualizou"} um pull request em ${link}`;
        case "IssuesEvent": return html`${p.action === "closed" ? "Fechou" : "Abriu"} uma issue em ${link}`;
        case "IssueCommentEvent": return html`Comentou em uma issue de ${link}`;
        case "ReleaseEvent": return html`Publicou uma versão de ${link}`;
        case "PublicEvent": return html`Tornou ${link} público`;
        default: return html`Atividade em ${link}`;
    }
}

function renderEvents(el, events) {
    if (!events.length) return;
    mount(el, html`
        <section class="side-block">
            <h2>Atividade recente</h2>
            <ol class="events">
                ${events.slice(0, 8).map((e) => html`
                <li><p>${describeEvent(e)}</p><time datetime="${e.created_at}">${ago(e.created_at)}</time></li>`)}
            </ol>
        </section>`);
}

function renderRepos(el, user, repos) {
    const langs = [...new Set(repos.map((r) => r.language).filter(Boolean))].sort();
    const forks = repos.filter((r) => r.fork).length;
    const state = { q: "", lang: "", sort: "pushed", forks: true };

    mount(el, html`
        <div class="repos__head">
            <h2 id="repos-title">Repositórios <span class="count">${num(repos.length)}</span></h2>
        </div>
        ${repos.length ? html`
        <div class="toolbar">
            <label class="field field--grow"><span class="sr-only">Filtrar por nome</span>
                <input type="search" id="repo-q" placeholder="Filtrar por nome, descrição ou tópico"></label>
            <label class="field"><span class="sr-only">Linguagem</span>
                <select id="repo-lang"><option value="">Todas as linguagens</option>
                ${langs.map((l) => html`<option>${l}</option>`)}</select></label>
            <label class="field"><span class="sr-only">Ordenar</span>
                <select id="repo-sort">${Object.entries(SORTS).map(([k, s]) => html`<option value="${k}">${s.label}</option>`)}</select></label>
            ${forks ? html`<label class="check"><input type="checkbox" id="repo-forks" checked> Mostrar forks (${forks})</label>` : ""}
        </div>
        <p class="repos__summary" id="repo-summary" aria-live="polite"></p>
        <ol class="repo-list" id="repo-list"></ol>` : html`
        <div class="state"><p class="state__title">Nenhum repositório público</p><p>${user.login} ainda não publicou nada, ou só tem repositórios privados.</p></div>`}`);

    if (!repos.length) return;

    const listEl = el.querySelector("#repo-list");
    const summaryEl = el.querySelector("#repo-summary");

    function paint() {
        const q = state.q.toLowerCase();
        const shown = repos
            .filter((r) => state.forks || !r.fork)
            .filter((r) => !state.lang || r.language === state.lang)
            .filter((r) => !q || [r.name, r.description || "", ...(r.topics || [])].join(" ").toLowerCase().includes(q))
            .sort(SORTS[state.sort].fn);

        summaryEl.textContent = shown.length === repos.length ? "" : `Mostrando ${num(shown.length)} de ${num(repos.length)}`;
        if (!shown.length) {
            mount(listEl, html`<li class="state"><p>Nenhum repositório corresponde ao filtro.</p></li>`);
            return;
        }
        mount(listEl, shown.map((r) => repoRow(user.login, r)));
    }

    el.querySelector("#repo-q").addEventListener("input", debounce((e) => { state.q = e.target.value.trim(); paint(); }, 120));
    el.querySelector("#repo-lang").addEventListener("change", (e) => { state.lang = e.target.value; paint(); });
    el.querySelector("#repo-sort").addEventListener("change", (e) => { state.sort = e.target.value; paint(); });
    el.querySelector("#repo-forks")?.addEventListener("change", (e) => { state.forks = e.target.checked; paint(); });
    paint();
}

function repoRow(login, r) {
    const href = `#/${login}/${r.name}`;
    return html`
        <li class="repo">
            <div class="repo__main">
                <h3 class="repo__name"><a href="${href}">${r.name}</a>
                    ${r.fork ? html`<span class="tag">fork</span>` : ""}
                    ${r.archived ? html`<span class="tag">arquivado</span>` : ""}
                    ${r.is_template ? html`<span class="tag">modelo</span>` : ""}
                </h3>
                ${r.description ? html`<p class="repo__desc">${r.description}</p>` : ""}
                ${r.topics?.length ? html`<ul class="topics">${r.topics.slice(0, 6).map((t) => html`<li>${t}</li>`)}</ul>` : ""}
                <p class="repo__meta">
                    ${r.language ? html`<span><span class="dot" style="background:${langColor(r.language)}"></span>${r.language}</span>` : ""}
                    ${r.stargazers_count ? html`<span title="Estrelas">${icon("star")}${compact(r.stargazers_count)}</span>` : ""}
                    ${r.forks_count ? html`<span title="Forks">${icon("fork")}${compact(r.forks_count)}</span>` : ""}
                    <span>Atualizado <time datetime="${r.pushed_at}">${ago(r.pushed_at)}</time></span>
                </p>
            </div>
            <div class="repo__actions">
                <a class="btn" href="${href}">${icon("code")}Ver código</a>
                ${r.size > 0 ? html`<a class="btn btn--icon" href="${zipUrl(login, r.name, r.default_branch)}" title="Baixar ${r.name} em ZIP" aria-label="Baixar ${r.name} em ZIP">${icon("download")}</a>` : ""}
            </div>
        </li>`;
}

async function renderNotFound(main, login, err) {
    if (err.kind !== "notfound") {
        mount(main, html`<div class="narrow">${errorBox(err, { action: html`<p><a class="btn" href="#/">Voltar para a busca</a></p>` })}</div>`);
        return;
    }
    mount(main, html`
        <div class="narrow">
            <div class="state state--error" role="alert">
                <p class="state__title">Não existe usuário com o login “${login}”</p>
                <p>O login é o nome que aparece no endereço do perfil, como github.com/<strong>login</strong>. Veja se algum destes é quem você procura:</p>
                <div id="did-you-mean">${loading("Procurando parecidos")}</div>
            </div>
        </div>`);
    const box = main.querySelector("#did-you-mean");
    try {
        const users = await searchUsers(login, 6);
        mount(box, users.length ? html`<ul class="suggest">${users.map((u) => html`
            <li><a href="#/${u.login}"><img src="${u.avatar_url}&s=64" alt="" width="32" height="32">${u.login}</a></li>`)}</ul>`
            : html`<p>Nenhum perfil parecido. <a href="#/">Fazer outra busca</a>.</p>`);
    } catch (e) {
        mount(box, html`<p>${e.message}</p>`);
    }
}
