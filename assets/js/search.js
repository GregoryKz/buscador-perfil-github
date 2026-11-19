// Campo de busca com sugestões (login ou nome). Usado na página inicial e na barra do topo.
import { searchUsers } from "./api.js";
import { html, mount, debounce } from "./ui.js";

const LOGIN_RE = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
let uid = 0;

export function createSearch(root, { size = "small", autofocus = false, onGo }) {
    const id = `search-${++uid}`;
    mount(root, html`
        <form class="search search--${size}" role="search" autocomplete="off">
            <label class="search__field" for="${id}">
                <span class="search__prefix" aria-hidden="true">github.com/</span>
                <input id="${id}" class="search__input" type="text" name="q"
                    placeholder="${size === "large" ? "login ou nome" : "buscar usuário"}"
                    aria-label="Login ou nome do usuário no GitHub"
                    role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list"
                    spellcheck="false" autocapitalize="off" maxlength="80">
            </label>
            <button class="search__submit btn btn--pen" type="submit">Buscar</button>
            <ul class="search__list" id="${id}-list" role="listbox" hidden></ul>
        </form>`);

    const form = root.querySelector("form");
    const input = form.querySelector("input");
    const list = form.querySelector("ul");
    let items = [];
    let active = -1;
    let lastQuery = "";
    let pending = null;

    if (autofocus) requestAnimationFrame(() => input.focus());

    function close() {
        list.hidden = true;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        active = -1;
    }

    function paint(message) {
        if (message) {
            mount(list, html`<li class="search__msg" role="presentation">${message}</li>`);
        } else {
            mount(list, items.map((u, i) => html`
                <li id="${id}-opt-${i}" role="option" class="search__opt" aria-selected="${i === active}" data-i="${i}">
                    <img src="${u.avatar_url}&s=64" alt="" width="28" height="28" loading="lazy">
                    <span class="search__login">${u.login}</span>
                    ${u.type === "Organization" ? html`<span class="tag">organização</span>` : ""}
                </li>`));
        }
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
        if (active >= 0) input.setAttribute("aria-activedescendant", `${id}-opt-${active}`);
        else input.removeAttribute("aria-activedescendant");
    }

    async function run(q) {
        lastQuery = q;
        pending = searchUsers(q);
        try {
            const result = await pending;
            if (q !== lastQuery) return;
            items = result;
            active = -1;
            if (document.activeElement === input) {
                items.length ? paint() : paint(`Ninguém encontrado para “${q}”. Confira a grafia do login.`);
            }
        } catch (err) {
            if (q !== lastQuery) return;
            items = [];
            if (document.activeElement === input) paint(err.message);
        }
    }

    const suggest = debounce((q) => {
        if (q.length < 2) { items = []; close(); return; }
        run(q);
    }, 450);

    input.addEventListener("input", () => suggest(input.value.trim()));

    input.addEventListener("keydown", (e) => {
        if (list.hidden || !items.length) {
            if (e.key === "Escape") close();
            return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const dir = e.key === "ArrowDown" ? 1 : -1;
            active = (active + dir + items.length) % items.length;
            paint();
        } else if (e.key === "Escape") {
            close();
        }
    });

    list.addEventListener("mousedown", (e) => {
        const li = e.target.closest("[data-i]");
        if (!li) return;
        e.preventDefault();
        go(items[Number(li.dataset.i)].login);
    });

    input.addEventListener("blur", () => setTimeout(close, 120));

    function go(login) {
        close();
        input.value = "";
        input.blur();
        onGo(login);
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const q = input.value.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "").split("/")[0];
        if (!q) { input.focus(); return; }
        if (active >= 0 && items[active]) return go(items[active].login);
        if (LOGIN_RE.test(q)) return go(q);

        // Parece um nome (tem espaço ou acento): usa o primeiro resultado da busca.
        paint("Procurando…");
        if (q !== lastQuery || !pending) await run(q); else await pending.catch(() => {});
        if (items.length === 1) go(items[0].login);
        else if (items.length) { active = 0; paint(); }
    });

    return { focus: () => input.focus(), setValue: (v) => { input.value = v; } };
}
