// Cores das linguagens (as mesmas do GitHub/Linguist) e detecção para o realce de sintaxe.

const COLORS = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", PHP: "#4F5D95",
    Java: "#b07219", C: "#555555", "C++": "#f34b7d", "C#": "#178600", HTML: "#e34c26",
    CSS: "#563d7c", SCSS: "#c6538c", Shell: "#89e051", Go: "#00ADD8", Rust: "#dea584",
    Ruby: "#701516", Kotlin: "#A97BFF", Swift: "#F05138", Dart: "#00B4AB", Vue: "#41b883",
    "Jupyter Notebook": "#DA5B0B", TSQL: "#e38c00", PLpgSQL: "#336790", PLSQL: "#dad8d8",
    Lua: "#000080", R: "#198CE7", Dockerfile: "#384d54", Blade: "#f7523f", Hack: "#878787",
    Svelte: "#ff3e00", Elixir: "#6e4a7e", Scala: "#c22d40", "Objective-C": "#438eff",
    PowerShell: "#012456", Batchfile: "#C1F12E", Makefile: "#427819", Assembly: "#6E4C13",
    Haskell: "#5e5086", Perl: "#0298c3", Pascal: "#E3F171", "Visual Basic .NET": "#945db7",
    Astro: "#ff5a03", Twig: "#c1d026", Less: "#1d365d", Sass: "#a53b70", MDX: "#fcb32c",
};

export function langColor(name) {
    return COLORS[name] || "#9aa4ae";
}

const BY_EXT = {
    html: "xml", htm: "xml", vue: "xml", svg: "xml", xml: "xml", svelte: "xml",
    js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript", py: "python", php: "php", sql: "sql",
    java: "java", c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", cs: "csharp",
    css: "css", scss: "scss", less: "less", json: "json", md: "markdown",
    sh: "bash", bash: "bash", zsh: "bash", yml: "yaml", yaml: "yaml", go: "go",
    rs: "rust", rb: "ruby", kt: "kotlin", swift: "swift", lua: "lua", r: "r",
    pl: "perl", ini: "ini", toml: "ini", env: "ini", bat: "dos", ps1: "powershell",
    dart: "dart", scala: "scala", gradle: "gradle", txt: "plaintext",
};

const BY_NAME = { dockerfile: "dockerfile", makefile: "makefile", ".htaccess": "apache", ".gitignore": "bash" };

export function hljsLanguage(path) {
    const name = path.split("/").pop().toLowerCase();
    if (BY_NAME[name]) return BY_NAME[name];
    const ext = name.includes(".") ? name.split(".").pop() : "";
    const lang = BY_EXT[ext] || ext;
    return window.hljs && lang && window.hljs.getLanguage(lang) ? lang : null;
}

const IMAGE = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp", "avif"];
const BINARY = [
    "pdf", "zip", "rar", "7z", "gz", "tar", "exe", "dll", "so", "jar", "class", "o",
    "mp3", "mp4", "wav", "ogg", "mov", "avi", "woff", "woff2", "ttf", "otf", "eot",
    "psd", "ai", "fig", "sqlite", "db", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "pyc",
];

export function fileKind(path) {
    const ext = path.split(".").pop().toLowerCase();
    if (IMAGE.includes(ext)) return "image";
    if (BINARY.includes(ext)) return "binary";
    if (ext === "md" || ext === "markdown") return "markdown";
    if (ext === "ipynb") return "notebook";
    return "text";
}
