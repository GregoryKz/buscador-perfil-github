// Roteador e partes fixas da página (barra do topo, token, limite da API).
//
// Rotas (no hash, para funcionar no GitHub Pages):
//   #/                         busca
//   #/login                    perfil
//   #/login/repo               repositório
//   #/login/repo/caminho       arquivo ou pasta   (?ref=branch&line=10-20)

import { onRateChange, getToken, setToken } from "./api.js";
import { createSearch } from "./search.js";
import { toast } from "./ui.js";
import { renderHome } from "./views/home.js";
import { renderProfile } from "./views/profile.js";
import { renderRepo, updateRepo, isSameRepo } from "./views/repo.js";

const main = document.getElementById("main");
const topSearch = document.getElementById("top-search");

function parseRoute() {
    const hash = location.hash.replace(/^#\/?/, "");
    const [pathPart, query = ""] = hash.split("?");
    const segs = pathPart.split("/").filter(Boolean).map((s) => {
        try { return decodeURIComponent(s); } catch { return s; }
    });
    const q = new URLSearchParams(query);
    return {
        owner: segs[0] || "",
        repo: segs[1] || "",
        path: segs.slice(2).join("/"),
        ref: q.get("ref") || null,
        line: q.get("line") || null,
    };
}

export function navigate(path) {
    location.hash = path;
}

let lastKey = "";

async function route() {
    const params = parseRoute();
    document.body.dataset.view = !params.owner ? "home" : params.repo ? "repo" : "profile";

    if (params.repo && isSameRepo(params)) {
        updateRepo(params);
        return;
    }

    const key = `${params.owner}/${params.repo}`;
    const changedPage = key !== lastKey;
    lastKey = key;

    if (!params.owner) {
        document.title = "Buscador de perfis do GitHub";
        renderHome(main, { navigate });
    } else if (!params.repo) {
        renderProfile(main, { login: params.owner });
    } else {
        renderRepo(main, params);
    }
    if (changedPage) {
        window.scrollTo(0, 0);
        if (params.owner) main.focus({ preventScroll: true });
    }
}

// ---------- Barra do topo ----------

createSearch(topSearch, { size: "small", onGo: (login) => navigate(`/${login}`) });

const rateEl = document.getElementById("rate");
onRateChange((r) => {
    if (r.remaining === null) return;
    rateEl.hidden = false;
    rateEl.textContent = `${r.remaining} de ${r.limit} consultas`;
    rateEl.classList.toggle("is-low", r.remaining < Math.max(5, r.limit * 0.1));
    rateEl.title = r.reset ? `O limite renova às ${r.reset.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "";
});

// ---------- Token ----------

const dialog = document.getElementById("token-dialog");
const tokenInput = document.getElementById("token-input");
const tokenBtn = document.getElementById("token-btn");

function paintTokenButton() {
    const has = !!getToken();
    tokenBtn.classList.toggle("is-on", has);
    tokenBtn.querySelector("span").textContent = has ? "Token ativo" : "Token";
}

tokenBtn.addEventListener("click", () => {
    tokenInput.value = getToken();
    dialog.returnValue = "";
    dialog.showModal();
});

dialog.addEventListener("close", () => {
    if (dialog.returnValue === "save") {
        setToken(tokenInput.value.trim());
        toast(tokenInput.value.trim() ? "Token salvo neste navegador" : "Token removido");
    } else if (dialog.returnValue === "remove") {
        setToken("");
        toast("Token removido");
    } else {
        return;
    }
    paintTokenButton();
    lastKey = "";
    route();
});

paintTokenButton();
window.addEventListener("hashchange", route);
route();
