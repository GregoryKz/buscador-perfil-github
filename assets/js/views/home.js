import { createSearch } from "../search.js";
import { html, mount, getRecent, clearRecent } from "../ui.js";

export function renderHome(main, { navigate }) {
    const recent = getRecent();

    mount(main, html`
        <section class="home">
            <h1 class="home__title">Buscador de perfis do GitHub</h1>
            <p class="home__lede">Encontre um aluno pelo login ou pelo nome, veja todos os repositórios dele e leia o código sem sair daqui.</p>
            <div class="home__search" id="home-search"></div>
            <p class="home__hint">Também aceita o endereço inteiro, como github.com/gregorykz.</p>

            ${recent.length ? html`
            <section class="recent" aria-labelledby="recent-title">
                <div class="recent__head">
                    <h2 id="recent-title">Vistos recentemente</h2>
                    <button class="btn-link" type="button" id="clear-recent">Limpar lista</button>
                </div>
                <ul class="recent__list">
                    ${recent.map((u) => html`
                    <li><a class="recent__item" href="#/${u.login}">
                        <img src="${u.avatar}" alt="" width="40" height="40" loading="lazy">
                        <span><strong>${u.name || u.login}</strong>${u.name ? html`<small>${u.login}</small>` : ""}</span>
                    </a></li>`)}
                </ul>
            </section>` : ""}
        </section>`);

    createSearch(main.querySelector("#home-search"), {
        size: "large",
        autofocus: true,
        onGo: (login) => navigate(`/${login}`),
    });

    main.querySelector("#clear-recent")?.addEventListener("click", () => {
        clearRecent();
        main.querySelector(".recent")?.remove();
    });
}
