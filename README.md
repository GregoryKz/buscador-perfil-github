# Buscador de perfis do GitHub

Encontre um usuário do GitHub pelo login ou pelo nome, veja o perfil completo e os repositórios dele, leia o código direto no navegador e baixe o projeto em ZIP.

Este é o primeiro módulo de um sistema maior: a **correção automática de listas de lógica de programação** (em qualquer linguagem) a partir do enunciado. Aqui fica a parte de localizar o aluno e chegar até o código que vai ser avaliado.

**Acesse:** https://gregorykz.github.io/buscador-perfil-github/

## O que ele faz

**Busca**
- Por login (`gregorykz`), pelo endereço inteiro (`github.com/gregorykz`) ou pelo nome da pessoa, com sugestões enquanto você digita.
- Se o login não existir, mostra perfis com nome parecido.
- Guarda os perfis vistos recentemente na página inicial.

**Perfil**
- Foto, nome, login, bio, empresa, localização, site, e-mail, X/Twitter e data de entrada no GitHub.
- Repositórios, seguidores, seguindo e total de estrelas recebidas.
- Linguagens mais usadas, organizações e atividade recente (commits, repositórios criados etc.).

**Repositórios**
- Lista completa (até 500), com filtro por texto, por linguagem, ordenação e opção de esconder forks.
- Botão para baixar qualquer repositório em ZIP direto da lista.

**Código**
- Árvore de arquivos navegável, com filtro por nome.
- Código com realce de sintaxe e números de linha. Clique em um número para marcar a linha; Shift + clique marca um trecho. O link fica na barra de endereço (`?line=11-15`), pronto para compartilhar ou usar na correção.
- README e arquivos Markdown renderizados, notebooks Jupyter (`.ipynb`) com células e saídas, imagens.
- Copiar o arquivo, baixar o arquivo, baixar o repositório em ZIP, copiar o comando `git clone`, trocar de branch.

Todas as telas têm endereço próprio, então dá para salvar ou mandar o link de um perfil, repositório ou arquivo:

```
#/gregorykz
#/gregorykz/buscador-perfil-github
#/gregorykz/buscador-perfil-github/assets/js/api.js?line=40-60
#/gregorykz/projeto?ref=dev
```

## Limite de consultas e token

Sem login, a API do GitHub permite **60 consultas por hora** por rede. O número restante aparece no topo da página. Para corrigir uma turma inteira, crie um [token clássico sem nenhuma permissão](https://github.com/settings/tokens/new?description=Buscador%20de%20perfis) e cole em **Token**: o limite sobe para 5.000 por hora. O token fica salvo só no seu navegador.

Ler o conteúdo dos arquivos não gasta consultas (vem de `raw.githubusercontent.com`), e as respostas ficam em cache enquanto a página está aberta.

## Estrutura

```
index.html
assets/
├─ css/style.css          visual da página e tema de cores do código
├─ js/
│  ├─ app.js              rotas (#/login/repo/caminho), barra do topo, token
│  ├─ api.js              toda a comunicação com o GitHub (cache, limite, erros)
│  ├─ search.js           campo de busca com sugestões
│  ├─ ui.js               HTML seguro, formatação, ícones, avisos
│  ├─ langs.js            cores das linguagens e detecção para o realce
│  └─ views/
│     ├─ home.js          página inicial
│     ├─ profile.js       perfil e lista de repositórios
│     └─ repo.js          repositório, árvore de arquivos e visualizador
├─ fonts/                 Schibsted Grotesk e JetBrains Mono
└─ vendor/                highlight.js, marked e DOMPurify (sem CDN)
```

`api.js` não depende da interface. Funções como `getRepos`, `getTree` e `getFileText` podem ser importadas pelo módulo de correção automática para buscar o código dos alunos.

## Como rodar localmente

Os scripts usam módulos JavaScript, então o arquivo precisa ser servido por HTTP (abrir o `index.html` com duplo clique não funciona):

```bash
git clone https://github.com/gregorykz/buscador-perfil-github.git
cd buscador-perfil-github
python -m http.server 8000
```

Depois abra http://localhost:8000. No VS Code, a extensão Live Server também serve.

## Próximos passos

- Cadastrar uma lista de exercícios (enunciados e casos de teste).
- Escolher o repositório e os arquivos de cada aluno para a lista.
- Rodar os testes e gerar a correção comentada, usando as linhas marcadas no código.

## Tecnologias

HTML, CSS e JavaScript puro (módulos ES), API REST do GitHub, highlight.js, marked e DOMPurify.
