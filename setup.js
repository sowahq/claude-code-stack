const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const REPO = "sowahq/claude-code-stack";
const BRANCH = "main";
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const API_URL = `https://api.github.com/repos/${REPO}/contents`;

const GLOBAL_DIR = path.join(os.homedir(), ".claude");
const MANIFEST_NAME = ".claude-code-stack-manifest.json";
const STACK_MD_NAME = "claude-code-stack.md";
const BLOCK_BEGIN = "<!-- BEGIN claude-code-stack (managed, do not edit) -->";
const BLOCK_END = "<!-- END claude-code-stack -->";

const MCP_SERVERS = [
    { name: "svelte", label: "Svelte — SvelteKit docs & autofixer", transport: "stdio", cmd: "npx -y @sveltejs/mcp", match: "@sveltejs/mcp" },
    { name: "ark-ui", label: "Ark UI — component API & examples", transport: "stdio", cmd: "npx -y @ark-ui/mcp", match: "@ark-ui/mcp" },
    { name: "figma-mcp-go", label: "Figma (figma-mcp-go) — design data via Figma Desktop bridge", transport: "stdio", cmd: "npx -y @vkhanhqui/figma-mcp-go@latest", match: "@vkhanhqui/figma-mcp-go" },
    { name: "todoist", label: "Todoist — tasks & projects (HTTP, needs auth)", transport: "http", url: "https://ai.todoist.net/mcp", match: "ai.todoist.net/mcp" },
];

const C = { rst: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
const log = {
    info: (m) => console.log(`${C.cyan}ℹ${C.rst} ${m}`),
    success: (m) => console.log(`${C.green}✔${C.rst} ${m}`),
    warn: (m) => console.log(`${C.yellow}⚠${C.rst} ${m}`),
    error: (m) => console.log(`${C.red}✖${C.rst} ${m}`),
    step: (m) => console.log(`\n${C.bold}${C.cyan}◆ ${m}${C.rst}`),
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(`\n${C.cyan}?${C.rst} ${C.bold}${q}${C.rst} `, res));

function isInstalled(cmd) {
    try { execSync(cmd, { stdio: 'ignore' }); return true; } catch (e) { return false; }
}

async function select(msg, opts, multi = false) {
    let cursor = 0; let selected = new Set();
    process.stdout.write('\u001b[?25l');
    const render = () => {
        process.stdout.write(`\n${C.cyan}?${C.rst} ${C.bold}${msg}${C.rst} ${C.dim}${multi ? '(Space to toggle, Enter to confirm)' : '(Arrows to move, Enter to select)'}${C.rst}\n`);
        opts.forEach((o, i) => {
            const isCur = i === cursor; const isSel = selected.has(i);
            const prefix = isCur ? `${C.cyan}❯${C.rst}` : ' ';
            const box = multi ? (isSel ? `${C.green}◉${C.rst}` : `${C.dim}◯${C.rst}`) : '';
            const color = isCur ? C.cyan : (isSel && multi ? C.green : C.rst);
            process.stdout.write(`  ${prefix} ${box} ${color}${o}${C.rst}\n`);
        });
    };
    render();
    return new Promise(resolve => {
        const onKey = (_, key) => {
            if (key.name === 'up') cursor = (cursor - 1 + opts.length) % opts.length;
            else if (key.name === 'down') cursor = (cursor + 1) % opts.length;
            else if (key.name === 'space' && multi) selected.has(cursor) ? selected.delete(cursor) : selected.add(cursor);
            else if (key.name === 'return') {
                process.stdin.removeListener('keypress', onKey); process.stdin.setRawMode(false); process.stdout.write('\u001b[?25h');
                const res = multi ? Array.from(selected).map(i => opts[i]) : opts[cursor];
                for (let i = 0; i <= opts.length + 1; i++) process.stdout.write('\u001b[1A\u001b[2K');
                log.info(`${msg} ${C.green}${multi ? res.join(', ') || 'None' : res}${C.rst}`);
                return resolve(res);
            } else if (key.ctrl && key.name === 'c') process.exit(0);
            for (let i = 0; i <= opts.length + 1; i++) process.stdout.write('\u001b[1A\u001b[2K');
            render();
        };
        readline.emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.on('keypress', onKey);
    });
}

function manifestPath(dir) { return path.join(dir, MANIFEST_NAME); }

function readManifest(dir) {
    try {
        const p = manifestPath(dir);
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) { log.warn(`Could not read manifest: ${e.message}`); }
    return null;
}

function writeManifest(dir, data) {
    fs.writeFileSync(manifestPath(dir), JSON.stringify(data, null, 2));
}

function injectClaudeImport(target, importPath) {
    const claudeMd = path.join(target, "CLAUDE.md");
    const block = `${BLOCK_BEGIN}\n@${importPath}\n${BLOCK_END}\n`;
    if (!fs.existsSync(claudeMd)) {
        fs.writeFileSync(claudeMd, block);
        return true;
    }
    let content = fs.readFileSync(claudeMd, 'utf8');
    const re = new RegExp(`${escapeRe(BLOCK_BEGIN)}[\\s\\S]*?${escapeRe(BLOCK_END)}\\n?`);
    if (re.test(content)) content = content.replace(re, block);
    else content = content.replace(/\s*$/, '\n') + "\n" + block;
    fs.writeFileSync(claudeMd, content);
    return false;
}

function removeClaudeImport(target, createdByUs) {
    const claudeMd = path.join(target, "CLAUDE.md");
    if (!fs.existsSync(claudeMd)) return;
    let content = fs.readFileSync(claudeMd, 'utf8');
    const re = new RegExp(`\\n?${escapeRe(BLOCK_BEGIN)}[\\s\\S]*?${escapeRe(BLOCK_END)}\\n?`);
    content = content.replace(re, '\n');
    if (createdByUs && content.trim() === '') fs.rmSync(claudeMd, { force: true });
    else fs.writeFileSync(claudeMd, content.replace(/\n{3,}/g, '\n\n'));
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function claudeMdHasStackBlock(target) {
    const claudeMd = path.join(target, "CLAUDE.md");
    if (!fs.existsSync(claudeMd)) return false;
    try { return fs.readFileSync(claudeMd, 'utf8').includes(BLOCK_BEGIN); } catch (e) { return false; }
}

function stackInstalled(target, claudeBase) {
    return fs.existsSync(manifestPath(claudeBase)) || claudeMdHasStackBlock(target);
}

function deepMergeSettings(base, add) {
    const out = { ...base };
    for (const k of Object.keys(add)) {
        const av = add[k], bv = out[k];
        if (Array.isArray(av)) {
            out[k] = Array.from(new Set([...(Array.isArray(bv) ? bv : []), ...av]));
        } else if (av && typeof av === 'object') {
            out[k] = deepMergeSettings(bv && typeof bv === 'object' && !Array.isArray(bv) ? bv : {}, av);
        } else if (bv === undefined) {
            out[k] = av;
        }
    }
    return out;
}

function detectConfiguredMcp(cwd) {
    const present = new Set();
    if (!isInstalled('claude -v')) return present;
    let out = "";
    try { out = execSync('claude mcp list', { encoding: 'utf8', cwd, stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { return present; }
    for (const def of MCP_SERVERS) {
        if (out.includes(def.match)) present.add(def.name);
    }
    return present;
}

function mcpAddCommand(def, scope) {
    if (def.transport === "http") {
        return `claude mcp add --transport http ${def.name} ${def.url} --scope ${scope}`;
    }
    return `claude mcp add ${def.name} --scope ${scope} -- ${def.cmd}`;
}

function addMcpServers(names, scope, cwd) {
    const added = [];
    if (!isInstalled('claude -v')) {
        log.warn("Claude Code CLI not found; skipping MCP setup.");
        return added;
    }
    for (const name of names) {
        const def = MCP_SERVERS.find(s => s.name === name);
        if (!def) continue;
        try { execSync(`claude mcp remove ${name} --scope ${scope}`, { stdio: 'ignore', cwd }); } catch (e) {}
        try {
            execSync(mcpAddCommand(def, scope), { stdio: 'ignore', cwd });
            log.success(`MCP: ${name} (${scope} scope${def.transport === 'http' ? ', authenticate with /mcp in Claude Code' : ''})`);
            added.push(name);
        } catch (e) {
            log.error(`Failed to add MCP server ${name}`);
        }
    }
    return added;
}

function removeMcpServers(names, scope, cwd) {
    if (!names || !names.length || !isInstalled('claude -v')) return;
    for (const name of names) {
        try {
            execSync(`claude mcp remove ${name} --scope ${scope}`, { stdio: 'ignore', cwd });
            log.success(`Removed MCP: ${name}`);
        } catch (e) {}
    }
}

async function uninstallStack(target, claudeBase, mcpScope) {
    log.step("Uninstalling...");
    const manifest = readManifest(claudeBase);
    if (!manifest) {
        log.warn("No stack manifest found. Nothing tracked to remove safely.");
        return;
    }
    for (const rel of (manifest.files || [])) {
        const p = path.join(target, rel);
        if (fs.existsSync(p)) {
            fs.rmSync(p, { recursive: true, force: true });
            log.success(`Removed ${rel}`);
        }
    }
    for (const dir of (manifest.dirs || [])) {
        const p = path.join(target, dir);
        try { if (fs.existsSync(p) && fs.readdirSync(p).length === 0) fs.rmdirSync(p); } catch (e) {}
    }
    if (manifest.claudeImport) {
        removeClaudeImport(target, manifest.createdClaudeMd);
        log.success("Removed stack block from CLAUDE.md");
    }
    if (manifest.settings) {
        const settingsPath = path.join(target, manifest.settings.rel || "settings.json");
        const cur = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : null;
        if (cur !== null && cur === manifest.settings.wrote) {
            if (manifest.settings.existed) {
                fs.writeFileSync(settingsPath, manifest.settings.prior);
                log.success("Restored settings.json to pre-install state");
            } else {
                fs.rmSync(settingsPath, { force: true });
                log.success("Removed settings.json (stack-created)");
            }
        } else {
            log.warn("settings.json changed since install; left as-is (remove stack keys manually if desired).");
        }
    }
    removeMcpServers(manifest.mcp || [], manifest.mcpScope || mcpScope);
    fs.rmSync(manifestPath(claudeBase), { force: true });
    log.info("Critical base config (your CLAUDE.md, settings.json, unmanaged files) left untouched.");
    log.info("Global tools (rtk, caveman, etc.) are not removed.");
    log.success("Uninstall complete!");
}

async function setup() {
    console.log(`\n${C.bold}${C.cyan}⚡ Claude Code Stack Installer${C.rst}\n${C.dim}============================${C.rst}`);

    const scope = await select("Where do you want to install the stack?", [
        "Project (current/target directory)",
        "Global (~/.claude — applies to all projects)",
    ]);
    const isGlobal = scope.startsWith("Global");

    let target;
    if (isGlobal) {
        target = GLOBAL_DIR;
        log.info(`Global target: ${C.dim}${target}${C.rst}`);
    } else {
        target = path.resolve((await ask("Target directory path (default: .)")) || ".");
    }

    const mcpScope = isGlobal ? "user" : "project";
    const claudeBase = isGlobal ? target : path.join(target, ".claude");
    const importPath = isGlobal ? STACK_MD_NAME : `.claude/${STACK_MD_NAME}`;

    if (stackInstalled(target, claudeBase)) {
        const action = await select("Stack already installed here. What would you like to do?", ["Reapply/Update", "Uninstall", "Cancel"]);
        if (action === "Cancel") process.exit(0);
        if (action === "Uninstall") {
            if (fs.existsSync(manifestPath(claudeBase))) {
                await uninstallStack(target, claudeBase, mcpScope);
            } else {
                log.step("Uninstalling (no manifest, using CLAUDE.md marker)...");
                removeClaudeImport(target, false);
                const smd = path.join(claudeBase, STACK_MD_NAME);
                if (fs.existsSync(smd)) { fs.rmSync(smd, { force: true }); log.success(`Removed ${STACK_MD_NAME}`); }
                removeMcpServers(MCP_SERVERS.map(s => s.name), mcpScope, target);
                log.warn("No manifest: removed stack block + import only. Rules/skills not tracked — remove manually if needed.");
                log.success("Uninstall complete!");
            }
            process.exit(0);
        }
    }

    let manager = "npm";
    log.step("Checking Environment");
    if (isInstalled('claude -v')) log.success("Claude Code is installed");
    else {
        log.warn("Claude Code is not installed");
        if ((await ask("Install Claude Code now? (y/n)")).toLowerCase() === 'y') {
            manager = await select("Choose your package manager:", ["npm", "pnpm", "yarn"]);
            execSync(`${manager} ${manager === 'yarn' ? 'global add' : 'install -g'} @anthropic-ai/claude-code`, { stdio: 'inherit' });
        }
    }

    log.step("Checking Skills & Plugins");
    const skills = [
        { name: 'caveman', check: 'claude plugin list', installed: false },
        { name: 'cavemem', check: 'cavemem -v', installed: false },
        { name: 'ui-ux-pro-max', check: 'uipro --version', installed: false }
    ];

    if (isInstalled('cargo --version')) {
        skills.push({ name: 'rtk', check: 'rtk --version', installed: false });
    }

    for (let s of skills) {
        s.installed = isInstalled(s.check);
        if (s.installed) log.success(`${s.name} is already installed`);
        else log.warn(`${s.name} is missing`);
    }

    const missingSkills = skills.filter(s => !s.installed).map(s => s.name);
    if (missingSkills.length > 0) {
        if ((await ask(`Install missing tools (${missingSkills.join(', ')})? (y/n)`)).toLowerCase() === 'y') {
            if (manager === 'npm' && !isInstalled('npm -v')) {
                 manager = await select("Choose your package manager:", ["npm", "pnpm", "yarn"]);
            }
            const cmd = manager === 'yarn' ? 'global add' : 'install -g';

            const caveman = skills.find(s => s.name === 'caveman');
            if (caveman && !caveman.installed) {
                log.info("Installing caveman...");
                try {
                    execSync('claude plugin marketplace add JuliusBrussee/caveman', { stdio: 'ignore' });
                    execSync('claude plugin install caveman@caveman', { stdio: 'ignore' });
                    log.success("caveman installed");
                } catch (e) {
                    if (process.platform === 'win32') execSync('powershell -Command "irm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/hooks/install.ps1 | iex"', { stdio: 'ignore' });
                    else execSync('curl -s https://raw.githubusercontent.com/JuliusBrussee/caveman/main/hooks/install.sh | bash', { stdio: 'ignore' });
                }
            }

            const cavemem = skills.find(s => s.name === 'cavemem');
            if (cavemem && !cavemem.installed) {
                log.info("Installing cavemem...");
                execSync(`${manager} ${cmd} cavemem`, { stdio: 'ignore' });
                try { execSync('cavemem install', { stdio: 'ignore' }); } catch(e) {}
                log.success("cavemem installed");
            }

            const uipro = skills.find(s => s.name === 'ui-ux-pro-max');
            if (uipro && !uipro.installed) {
                log.info("Installing ui-ux-pro-max...");
                execSync(`${manager} ${cmd} uipro-cli`, { stdio: 'ignore' });
                try { execSync('uipro init --ai claude --global', { stdio: 'ignore' }); } catch(e) {}
                log.success("ui-ux-pro-max installed");
            }

            const rtk = skills.find(s => s.name === 'rtk');
            if (rtk && !rtk.installed) {
                log.info("Installing rtk...");
                try {
                    execSync('cargo install --git https://github.com/rtk-ai/rtk', { stdio: 'inherit' });
                    execSync('rtk init -g', { stdio: 'inherit' });
                    log.success("rtk installed");
                } catch (e) {
                    log.error("Failed to install rtk");
                }
            }
        }
    }

    log.step("Project Configuration");
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });

    const fetchItems = async (dir) => {
        try {
            const r = await fetch(`${API_URL}/${dir}?ref=${BRANCH}`, { headers: { 'User-Agent': 'NodeJS' } });
            return r.ok ? await r.json() : [];
        } catch (e) {
            log.error(`Failed to fetch ${dir}: ${e.message}`);
            return [];
        }
    };

    const listFilesRecursive = async (dir) => {
        const items = await fetchItems(dir);
        const files = [];
        for (const it of items) {
            if (it.type === 'dir') files.push(...await listFilesRecursive(it.path));
            else if (it.type === 'file') files.push(it.path);
        }
        return files;
    };

    log.info("Fetching rules, skills, agents & hooks from GitHub...");
    const rulesData = await fetchItems(".claude/rules");
    const skillsData = await fetchItems(".claude/skills");
    const agentsData = await fetchItems(".claude/agents");
    const hooksData = await fetchItems(".claude/hooks");

    const rules = rulesData.filter(f => f.name.endsWith('.md')).map(f => f.name.replace('.md', ''));
    const customSkills = skillsData.filter(f => f.type === 'dir').map(f => f.name);
    const agents = agentsData.filter(f => f.name.endsWith('.md')).map(f => f.name.replace('.md', ''));
    const hookScripts = hooksData.filter(f => f.type === 'file').map(f => f.name);

    const selectedRules = rules.length ? await select("Select rules to install:", rules, true) : [];
    const selectedSkills = customSkills.length ? await select("Select custom skills to install:", customSkills, true) : [];
    const selectedAgents = agents.length ? await select("Select agents to install:", agents, true) : [];
    const selectedHooks = hookScripts.length ? await select("Select hooks to install:", hookScripts, true) : [];

    const configuredMcp = detectConfiguredMcp(target);
    for (const s of MCP_SERVERS) {
        if (configuredMcp.has(s.name)) log.success(`MCP already configured: ${s.name} (skipping)`);
    }
    const availableMcp = MCP_SERVERS.filter(s => !configuredMcp.has(s.name));
    let selectedMcp = [];
    if (availableMcp.length > 0) {
        const selectedMcpLabels = await select("Select MCP servers to add:", availableMcp.map(s => s.label), true);
        selectedMcp = availableMcp.filter(s => selectedMcpLabels.includes(s.label)).map(s => s.name);
    } else {
        log.info("All known MCP servers are already configured.");
    }

    const installSettings = (await ask("Apply recommended settings.json (deep-merged, never overwrites your existing values)? (y/n)")).toLowerCase() === 'y';

    log.step("Applying Files");
    const get = async (src, dest) => {
        try {
            const r = await fetch(src);
            if (r.ok) {
                const parent = path.dirname(dest);
                if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
                fs.writeFileSync(dest, await r.text());
                return true;
            }
        } catch (e) {
            log.error(`Failed to download ${src}`);
        }
        return false;
    };

    const prevManifest = readManifest(claudeBase);
    const owned = new Set(prevManifest && prevManifest.files ? prevManifest.files : []);
    const installedFiles = [];
    let claudeImport = prevManifest ? !!prevManifest.claudeImport : false;
    let createdClaudeMd = prevManifest ? !!prevManifest.createdClaudeMd : false;

    const relTo = (dest) => path.relative(target, dest).split(path.sep).join('/');
    const safeGet = async (src, dest) => {
        const rel = relTo(dest);
        if (fs.existsSync(dest) && !owned.has(rel)) {
            log.warn(`Skipped ${rel} (already exists, not managed by stack)`);
            return false;
        }
        const ok = await get(src, dest);
        if (ok && !installedFiles.includes(rel)) installedFiles.push(rel);
        return ok;
    };

    const stackMdDest = path.join(claudeBase, STACK_MD_NAME);
    if (await get(`${RAW_URL}/CLAUDE.md`, stackMdDest)) {
        const stackMdRel = relTo(stackMdDest);
        if (!installedFiles.includes(stackMdRel)) installedFiles.push(stackMdRel);
        createdClaudeMd = injectClaudeImport(target, importPath);
        claudeImport = true;
        log.success(`CLAUDE.md (imported via @${importPath}, your CLAUDE.md preserved)`);
    }

    for (const r of selectedRules) {
        if (await safeGet(`${RAW_URL}/.claude/rules/${r}.md`, path.join(claudeBase, "rules", `${r}.md`))) {
            log.success(`Rule: ${r}`);
        }
    }

    for (const a of selectedAgents) {
        if (await safeGet(`${RAW_URL}/.claude/agents/${a}.md`, path.join(claudeBase, "agents", `${a}.md`))) {
            log.success(`Agent: ${a}`);
        }
    }

    for (const h of selectedHooks) {
        const dest = path.join(claudeBase, "hooks", h);
        if (await safeGet(`${RAW_URL}/.claude/hooks/${h}`, dest)) {
            try { fs.chmodSync(dest, 0o755); } catch (e) { log.warn(`Could not chmod ${h}: ${e.message}`); }
            log.success(`Hook: ${h}`);
        }
    }
    if (isGlobal && selectedHooks.length && installSettings) {
        log.warn("Global install: settings.json hook commands reference ${CLAUDE_PROJECT_DIR}/.claude/hooks — update them to ~/.claude/hooks manually.");
    }

    for (const s of selectedSkills) {
        const skillFiles = await listFilesRecursive(`.claude/skills/${s}`);
        let count = 0;
        for (const repoPath of skillFiles) {
            const sub = repoPath.replace(/^\.claude\//, "");
            const dest = path.join(claudeBase, ...sub.split('/'));
            if (await safeGet(`${RAW_URL}/${repoPath}`, dest)) count++;
        }
        if (count > 0) log.success(`Skill: ${s} (${count} file${count === 1 ? '' : 's'})`);
    }

    let settingsRecord = prevManifest ? prevManifest.settings : null;
    if (installSettings) {
        try {
            const r = await fetch(`${RAW_URL}/.claude/settings.json`);
            if (r.ok) {
                const template = JSON.parse(await r.text());
                const settingsPath = path.join(claudeBase, "settings.json");
                let prior = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : null;
                let baseObj = {};
                let skip = false;
                if (prior !== null) {
                    try { baseObj = JSON.parse(prior); }
                    catch (e) { log.warn("Existing settings.json is not valid JSON; leaving it untouched."); skip = true; }
                }
                if (!skip) {
                    const wrote = JSON.stringify(deepMergeSettings(baseObj, template), null, 2) + "\n";
                    const parent = path.dirname(settingsPath);
                    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
                    fs.writeFileSync(settingsPath, wrote);
                    const basePrior = settingsRecord ? settingsRecord.prior : prior;
                    const baseExisted = settingsRecord ? settingsRecord.existed : (prior !== null);
                    settingsRecord = { existed: baseExisted, prior: basePrior, wrote, rel: relTo(settingsPath) };
                    log.success(prior === null ? "settings.json (created)" : "settings.json (merged, your values preserved)");
                }
            }
        } catch (e) { log.error(`Failed to apply settings.json: ${e.message}`); }
    }

    let addedMcp = [];
    if (selectedMcp.length > 0) {
        log.step("Configuring MCP Servers");
        addedMcp = addMcpServers(selectedMcp, mcpScope, target);
    }

    const mergedFiles = Array.from(new Set([...(prevManifest && prevManifest.files || []), ...installedFiles]));
    const dirSet = new Set();
    for (const f of mergedFiles) {
        const parts = f.split('/');
        for (let i = parts.length - 1; i >= 1; i--) dirSet.add(parts.slice(0, i).join('/'));
    }
    const mergedDirs = Array.from(dirSet).sort((a, b) => b.split('/').length - a.split('/').length);
    const mergedMcp = Array.from(new Set([...(prevManifest && prevManifest.mcp || []), ...addedMcp]));
    writeManifest(claudeBase, { scope: isGlobal ? "global" : "project", version: 1, files: mergedFiles, dirs: mergedDirs, mcp: mergedMcp, mcpScope, settings: settingsRecord, claudeImport, createdClaudeMd });
    log.success(`Wrote manifest (${relTo(manifestPath(claudeBase))}) for clean uninstall`);

    console.log(`\n${C.bold}${C.green}✨ Setup complete!${C.rst}\n`);
    process.exit(0);
}

setup().catch(e => { console.error(`\n${C.red}Error:${C.rst}`, e.message); process.exit(1); });
