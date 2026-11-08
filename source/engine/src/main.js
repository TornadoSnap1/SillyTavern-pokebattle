import { Dex } from '@pkmn/sim';
import { BattleStream, getPlayerStreams } from '../node_modules/@pkmn/sim/build/esm/sim/battle-stream.mjs';
import { Sprites } from '@pkmn/img';
import { Sets } from '@pkmn/sets';
import { BasicPlayerAI } from './basic-ai.mjs';
import { createBattleControls } from './battle-controls.mjs';
import { BattlePlayback } from './battle-playback.mjs';
import { createBattleFeedback } from './battle-feedback.mjs';
import { teraFromDetails } from './battle-public-state.mjs';
import { createBattleInspector } from './battle-inspector.mjs';
import { escapeHtml, speciesName, tr, TYPES, STATS, STATUS } from './i18n.mjs';
let p1Stream = null;
let currentBattleMode = 'singles', currentGen = 'gen9';
let p2TotalPokemon = 0, p2FaintedCount = 0;
let fieldState = { weather: '', terrain: '', pseudo: [], p1side: [], p2side: [] };
let statsState = { p1a: {}, p1b: {}, p2a: {}, p2b: {} };
let statusState = { p1a: '', p1b: '', p2a: '', p2b: '' };
let currentSession = null, returnOrigin = '*';
let playbackSpeed = 1;
const inspector = createBattleInspector(document,window);
const feedback = createBattleFeedback(document, window);
const controls = createBattleControls({ document, write: command => p1Stream?.write(command), log, onSelect:()=>feedback.sound() });
controls.bind(window);
window.toggleBattleSound = feedback.toggleSound;
const htmlName = name => escapeHtml(speciesName(name, Dex));
const TypeIcons = { Fire: '🔥', Water: '💧', Grass: '🌿', Electric: '⚡', Ice: '❄️', Fighting: '🥊', Poison: '☠️', Ground: '🏜️', Flying: '🦅', Psychic: '🔮', Bug: '🪲', Rock: '🪨', Ghost: '👻', Dragon: '🐉', Dark: '🌑', Steel: '⚙️', Fairy: '✨', Normal: '⚪' };
const WeatherIcons = { RainDance: '🌧️', SunnyDay: '☀️', Sandstorm: '🏜️', Hail: '🌨️', Snow: '❄️', HarshSunshine: '🌞', HeavyRain: '⛈️' };
const TerrainIcons = { 'Electric Terrain': '⚡️', 'Grassy Terrain': '🌿', 'Misty Terrain': '🧚', 'Psychic Terrain': '🔮' };

const PRESET_TEAMS = {
    singles_mega: {
        mode: 'singles', gen: 'gen9',
        p1: 'Gardevoir @ Gardevoirite\nAbility: Trace\nLevel: 50\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Hyper Voice\n- Psyshock\n- Moonblast\n- Mystical Fire\n\nPikachu @ Light Ball\nLevel: 50\n- Thunderbolt\n- Quick Attack',
        p2: 'Blastoise @ Blastoisinite\nAbility: Torrent\nLevel: 50\nEVs: 252 SpA / 4 SpD / 252 Spe\nModest Nature\n- Water Pulse\n- Aura Sphere\n- Dark Pulse\n- Ice Beam'
    },
    singles_dynamax: {
        mode: 'singles', gen: 'gen8',
        p1: 'Pikachu @ Light Ball\nAbility: Lightning Rod\nLevel: 50\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Volt Tackle\n- Iron Tail\n- Play Rough\n- Quick Attack\n\nSnorlax\nLevel: 50\n- Body Slam\n- Earthquake',
        p2: 'Charizard @ Life Orb\nAbility: Blaze\nLevel: 50\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Flamethrower\n- Air Slash\n- Solar Beam\n- Dragon Pulse'
    },
    doubles_classic: {
        mode: 'doubles', gen: 'gen9',
        p1: 'Kyogre @ Choice Specs\nAbility: Drizzle\nLevel: 50\n- Water Spout\n- Origin Pulse\n- Ice Beam\n- Thunder\n\nZapdos @ Life Orb\nAbility: Static\nLevel: 50\n- Thunder\n- Hurricane\n- Tailwind\n- Protect',
        p2: 'Groudon @ Clear Amulet\nAbility: Drought\nLevel: 50\n- Precipice Blades\n- Heat Crash\n- Rock Slide\n- Protect\n\nHeatran @ Leftovers\nAbility: Flash Fire\nLevel: 50\n- Heat Wave\n- Earth Power\n- Flash Cannon\n- Protect'
    },
    doubles_dynamax: {
        mode: 'doubles', gen: 'gen8',
        p1: 'Snorlax @ Sitrus Berry\nAbility: Gluttony\nLevel: 50\n- Body Slam\n- Darkest Lariat\n- High Horsepower\n- Belly Drum\n\nTyranitar @ Weakness Policy\nAbility: Sand Stream\nLevel: 50\n- Rock Slide\n- Crunch\n- Iron Head\n- Protect',
        p2: 'Lapras @ Light Clay\nAbility: Water Absorb\nLevel: 50\n- Freeze-Dry\n- Hydro Pump\n- Thunder\n- Protect\n\nDuraludon @ Assault Vest\nAbility: Stalwart\nLevel: 50\n- Flash Cannon\n- Thunderbolt\n- Draco Meteor\n- Body Press'
    }
};

window.applyPreset = function(presetKey) {
    const data = PRESET_TEAMS[presetKey];
    if (!data) return;
    document.getElementById('p1-team-input').value = data.p1;
    document.getElementById('p2-team-input').value = data.p2;
    if (data.mode === 'doubles') document.getElementById('mode-doubles').checked = true;
    else document.getElementById('mode-singles').checked = true;
    if (data.gen === 'gen8') document.getElementById('gen-gen8').checked = true;
    else document.getElementById('gen-gen9').checked = true;
};

function parseTeam(text, isDebug = false) {
    if (!text || !text.trim()) return null;
    const debugDiv = document.getElementById('debug-output');
    if (isDebug) { debugDiv.classList.remove('hidden'); debugDiv.innerHTML = '正在解析...<br>'; }
    const chunks = text.split(/\n\s*\n/);
    let packedTeam = '';
    for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        try {
            const set = Sets.importSet(chunk);
            if (isDebug) debugDiv.innerHTML += "[OK] " + htmlName(set.species) + "<br>";
            if (packedTeam) packedTeam += ']';
            packedTeam += Sets.pack(set);
        } catch (e) {
            console.error('解析队伍失败:', e);
            if (isDebug) debugDiv.innerHTML += "[ERR] " + escapeHtml(chunk.split("\n")[0]) + "<br>";
            else alert('队伍格式错误，请检查：' + chunk.split('\n')[0]);
            return null;
        }
    }
    if (isDebug) debugDiv.innerHTML += '🎉 解析完成!';
    return packedTeam;
}
window.debugTeamParser = function() {
    const p1Text = document.getElementById('p1-team-input').value;
    parseTeam(p1Text, true);
};
window.initBattle = function() {
    const p1Text = document.getElementById('p1-team-input').value;
    const p2Text = document.getElementById('p2-team-input').value;
    const team1 = parseTeam(p1Text);
    const team2 = parseTeam(p2Text);
    if (!team1 || !team2) {
        alert('❌ 队伍格式错误');
        return;
    }
    const isDoubles = document.getElementById('mode-doubles')?.checked;
    const isGen8 = document.getElementById('gen-gen8')?.checked;
    const mode = isDoubles ? 'doubles' : 'singles';
    const gen = isGen8 ? 'gen8' : 'gen9';
    document.getElementById('setup-modal').classList.add('hidden');
    document.getElementById('menu-layer').classList.remove('hidden');
    startMyBattle(team1, team2, mode, gen).catch(error => failSession(currentSession, error));
};

function log(text, type = 'normal') {
    const container = document.getElementById('log-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'pl-2 border-l-2 mb-1 text-xs leading-relaxed animate-fade-in select-text';

    if (type === 'turn') {
        div.className += ' border-blue-500 font-bold bg-blue-50 p-1';
        div.innerHTML = text;
    } else if (type === 'damage') {
        div.className += ' border-red-500 text-red-700';
        div.innerHTML = text;
    } else if (type === 'heal') {
        div.className += ' border-green-500 text-green-700';
        div.innerHTML = text;
    } else if (type === 'win') {
        div.className += ' border-yellow-500 bg-yellow-100 text-yellow-800 font-bold p-2 text-center text-sm';
        div.innerHTML = text;

    } else if (type === 'dynamax') {
        div.className += ' border-red-600 bg-red-50 text-red-800 font-bold p-1';
        div.innerHTML = text;
    } else {
        div.className += ' border-gray-300';
        div.innerHTML = text;
    }
    container.appendChild(div);
    while (container.children.length > 400) container.firstElementChild.remove();
    container.scrollTop = container.scrollHeight;
}

function normalizeTargetId(rawId) {
    if (!rawId) return 'p1a';
    if (rawId.includes('p1b')) return 'p1b';
    if (rawId.includes('p1')) return 'p1a';
    if (rawId.includes('p2b')) return 'p2b';
    if (rawId.includes('p2')) return 'p2a';
    return rawId;
}

function updatePokeballs(side, total, alive) {
    const container = document.getElementById(`${side}-balls`);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const ball = document.createElement('div');
        ball.className = `ball-icon ${i >= alive ? 'fainted' : ''}`;
        container.appendChild(ball);
    }
}

function updateLevelUI(target, details) {
    const key = normalizeTargetId(target);
    const match = details.match(/L(\d+)/);
    const level = match ? match[1] : '100';
    const el = document.getElementById(`${key}-level`);
    if (el) el.innerText = `Lv.${level}`;
}

function updateTypes(target, speciesName) {
    const key = normalizeTargetId(target);
    const typesDiv = document.getElementById(`${key}-types`);
    if (!typesDiv) return;
    typesDiv.innerHTML = '';
    const species = Dex.species.get(speciesName);
    if (!species || !species.types) return;
    species.types.forEach(t => {
        const span = document.createElement('span');
        span.className = `status-badge bg-type-${t} shadow-sm`;
        span.innerText = `${TypeIcons[t] || ''} ${TYPES[t] || t}`;
        typesDiv.appendChild(span);
    });
}

function updateStatusUI(target) {
    const key = normalizeTargetId(target);
    const statsDiv = document.getElementById(`${key}-stats`);
    if (!statsDiv) return;
    statsDiv.innerHTML = '';
    const currentStats = statsState[key] || {};
    for (const [stat, val] of Object.entries(currentStats)) {
        if (val !== 0) {
            const span = document.createElement('span');
            span.className = `px-1 rounded text-[8px] font-bold ${val > 0 ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}`;
            span.innerText = `${STATS[stat] || stat} ${val > 0 ? '+' : ''}${val}`;
            inspector.boost(span,stat,val);
            statsDiv.appendChild(span);
        }
    }
    const st = statusState[key];
    if (st) {
        const badge = document.createElement('span');
        badge.className = `status-badge status-${st}`;
        badge.innerText = STATUS[st] || st;
        inspector.status(badge,st);
        statsDiv.appendChild(badge);
    }
}

function updateHPUI(target, hpData) {
    const key = normalizeTargetId(target);
    let current, max;
    if (hpData.includes('fnt') || hpData === '0') {
        current = 0;
        max = 100;
        statusState[key] = 'fnt';
        updateStatusUI(key);
    } else {
        const split = hpData.split(' ')[0].split('/');
        current = parseInt(split[0]);
        max = parseInt(split[1]);
        const parts = hpData.split(' ');
        statusState[key] = parts.length > 1 ? parts[1] : '';
        updateStatusUI(key);
    }

    if (!isNaN(current) && !isNaN(max)) {
        const percent = (current / max) * 100;
        const bar = document.getElementById(`${key}-hp-bar`);
        if (bar) {
            bar.style.width = `${percent}%`;
            if (percent < 20) bar.className = 'h-full bg-red-500 transition-all duration-500';
            else if (percent < 50) bar.className = 'h-full bg-yellow-500 transition-all duration-500';
            else bar.className = 'h-full bg-green-500 transition-all duration-500';
        }
        const textEl = document.getElementById(`${key}-hp-text`);
        if (textEl) textEl.innerText = current === 0 ? '濒死' : `${current}/${max}`;
    }
}

function forceUpdateImage(target, speciesEnglish) {
    const key = normalizeTargetId(target);
    const sprite = Sprites.getPokemon(speciesEnglish, { gen: 'ani' });
    const url = sprite ? sprite.url : `https://play.pokemonshowdown.com/sprites/gen5/${speciesEnglish.toLowerCase().replace(/[^a-z0-9-]+/g, '')}.png`;
    const img = document.getElementById(`${key}-img`);
    if (img) {
        img.onerror = () => {
            img.onerror = null;
            img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="40" fill="#e7edf5" stroke="#20334a" stroke-width="5"/><path d="M21 60h78" stroke="#20334a" stroke-width="5"/><circle cx="60" cy="60" r="12" fill="white" stroke="#20334a" stroke-width="5"/></svg>');
        };
        img.alt = speciesName(speciesEnglish, Dex);
        img.src = url;
        img.classList.remove('opacity-0');
    }
}

function updateAbilityUI(target, abilityName) {
    const key = normalizeTargetId(target);
    const el = document.getElementById(`${key}-ability`);
    if (el) el.innerText = tr('ability', abilityName);
}

function updateSideConditions() { inspector.renderField(fieldState); }

function handleSwitch(parts) {
    const rawTarget = parts[2];
    const key = normalizeTargetId(rawTarget);
    const details = parts[3];
    const species = details.split(',')[0];
    inspector.clearSlot(key);
    const hpData = parts[4];

    log(`🔄 ${key.startsWith('p1') ? '我方' : '敌方'} 派出了 <b>${htmlName(species)}</b>!`, 'normal');
    const nameEl = document.getElementById(`${key}-name`);
    if (nameEl) nameEl.innerText = speciesName(species, Dex);
    updateLevelUI(key, details);
    updateTypes(key, species);
    forceUpdateImage(key, species);
    updateHPUI(key, hpData);

    statsState[key] = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    updateStatusUI(key);

    const img = document.getElementById(`${key}-img`);
    if (img) img.classList.remove('dynamax-anim', 'tera-anim', 'faint-anim', 'opacity-0');
    const tera = teraFromDetails(details);
    const badge = document.getElementById(`${key}-gimmick-badge`); if (badge) badge.innerText = tera ? `[太晶:${TYPES[tera] || tera}]` : '';
    if (img && tera) img.classList.add('tera-anim');
    updateAbilityUI(key, '—');
}


function handleBattleLine(line, session) {
    controls.observe(line);
    feedback.observe(line);
    // 敌方队伍总数：旧版 p2TotalPokemon 从未赋值，FOE 球数一直空白
    if (line.startsWith('|teamsize|p2|')) {
        p2TotalPokemon = parseInt(line.split('|')[3], 10) || 0;
        updatePokeballs('p2', p2TotalPokemon, Math.max(0, p2TotalPokemon - p2FaintedCount));
    }
    if (line.startsWith('|-mega|')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        const megaUserSpecies = parts[3];
        const baseSpecies = Dex.species.get(megaUserSpecies);
        let megaForme = Dex.items.get(parts[4]).megaStone || megaUserSpecies;
        if (megaForme === megaUserSpecies && baseSpecies?.otherFormes) {
            const found = baseSpecies.otherFormes.find(f => f.includes('-Mega'));
            if (found) megaForme = Dex.species.get(found).name;
        }
        log(`✨ ${key.startsWith('p1') ? '我方' : '敌方'} <b>${htmlName(megaUserSpecies)}</b> MEGA 进化为了 <b>${htmlName(megaForme)}</b>!`, 'effect');
        const nameEl = document.getElementById(`${key}-name`);
        if (nameEl) nameEl.innerText = speciesName(megaForme, Dex);
        updateTypes(key, megaForme);
        forceUpdateImage(key, megaForme);
    }
    if (line.startsWith('|-terastallize|')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        const teraType = parts[3];
        const img = document.getElementById(`${key}-img`);
        if (img) img.classList.add('tera-anim');
        log(`💎 ${key.startsWith('p1') ? '我方' : '敌方'} 太晶化为 <b>${escapeHtml(TYPES[teraType] || teraType)}</b>!`, 'effect');
        const badge = document.getElementById(`${key}-gimmick-badge`);
        if (badge) badge.innerText = `[太晶:${TYPES[teraType] || teraType}]`;
    }
    if (line.startsWith('|-start|') && line.includes('|Dynamax')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        const isGmax = line.includes('Gmax');
        const img = document.getElementById(`${key}-img`);
        if (img) img.classList.add('dynamax-anim');
        const badge = document.getElementById(`${key}-gimmick-badge`);
        if (badge) badge.innerText = isGmax ? '[超极巨]' : '[极巨化]';
        log(`🔴 ${key.startsWith('p1') ? '我方' : '敌方'} 触发了 <b>${isGmax ? '超极巨化 (Gigantamax)' : '极巨化 (Dynamax)'}</b>！体型变得巨大！`, 'dynamax');
    }
    if (line.startsWith('|-end|') && line.includes('|Dynamax')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        const img = document.getElementById(`${key}-img`);
        if (img) img.classList.remove('dynamax-anim');
        const badge = document.getElementById(`${key}-gimmick-badge`);
        if (badge) badge.innerText = '';
        log(`💨 ${key.startsWith('p1') ? '我方' : '敌方'} 极巨化状态已恢复正常。`, 'normal');
    }
    if (line.startsWith('|-ability|')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        const abilityName = parts[3];
        log(`✨ ${key.startsWith('p1') ? '我方' : '敌方'} 特性 <b>${escapeHtml(tr('ability', abilityName))}</b> 发动!`, 'effect');
        updateAbilityUI(key, abilityName);
    }
    if (line.startsWith('|-fieldstart|')) {
        const terrain = line.split('|')[2].replace('move: ', '');
        if (['Electric Terrain','Grassy Terrain','Misty Terrain','Psychic Terrain'].includes(terrain)) fieldState.terrain = terrain;
        else fieldState.pseudo=[...(fieldState.pseudo||[]).filter(value=>value!==terrain),terrain];
        updateSideConditions();
        log(`🌍 场地变成了 <b>${escapeHtml(terrain)}</b>!`, 'effect');
    }
    if (line.startsWith('|-fieldend|')) {
        const ended=line.split('|')[2]?.replace('move: ','');
        if(fieldState.terrain===ended)fieldState.terrain='';
        fieldState.pseudo=(fieldState.pseudo||[]).filter(value=>value!==ended);
        updateSideConditions();
        log('🌍 场地效果消失了。', 'normal');
    }
    if (line.startsWith('|-weather|')) {
        const weather = line.split('|')[2];
        fieldState.weather = (weather === 'none' || !weather) ? '' : weather;
        updateSideConditions();
    }
    if (line.startsWith('|switch|') || line.startsWith('|drag|')) {
        handleSwitch(line.split('|'));
    }
    if (line.startsWith('|faint|')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        updateHPUI(key,'0 fnt');
        log(`💀 ${key.startsWith('p1') ? '我方' : '敌方'} <b>${htmlName(parts[2].split(": ")[1] || parts[2])}</b> 倒下了!`, 'damage');
        const img = document.getElementById(`${key}-img`);
        if (img) {
            img.classList.add('faint-anim');
            // CSS holds the fainted pose. A timer here could hide a newly
            // switched-in Pokemon in instant/fast playback mode.
        }
        if (key.startsWith('p2')) {
            p2FaintedCount++;
            updatePokeballs('p2', p2TotalPokemon, Math.max(0, p2TotalPokemon - p2FaintedCount));
        }
    }
    if (line.startsWith('|turn|')) {
        log(`=== 回合 ${line.split('|')[2]} ===`, 'turn');
    }
    if (line.startsWith('|move|')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        const moveName = parts[3];
        log(`${key.startsWith('p1') ? '我方' : '敌方'} 使用了 <b>${escapeHtml(tr('move', moveName))}</b>!`);
        const img = document.getElementById(`${key}-img`);
        if (img) {
            img.classList.add('shake-anim');
            session.delay(() => img.classList.remove('shake-anim'), 300);
        }
    }
    if (line.startsWith('|-damage|') || line.startsWith('|-heal|')) {
        const parts = line.split('|');
        // Bench identities are p1: Name, not p1a: Name. Do not write their HP
        // into the currently active position (notably Revival Blessing).
        if (!/^p[12][ab](?::|$)/.test(parts[2])) {
            const healed = line.startsWith('|-heal|');
            if (healed && parts[2]?.startsWith('p2:') && line.includes('move: Revival Blessing')) {
                p2FaintedCount=Math.max(0,p2FaintedCount-1);
                updatePokeballs('p2',p2TotalPokemon,Math.max(0,p2TotalPokemon-p2FaintedCount));
            }
            log(`${parts[2]?.startsWith('p1') ? '我方' : '敌方'}后备 ${htmlName(parts[2]?.split(': ')[1] || '')}${healed ? '恢复了体力' : '受到伤害'}`,healed ? 'heal' : 'damage');
            return;
        }
        const key = normalizeTargetId(parts[2]);
        const hpData = parts[3];
        updateHPUI(key, hpData);
        const isHeal = line.startsWith('|-heal|');
        const image = document.getElementById(`${key}-img`);
        if (!isHeal && image) { image.classList.add('flash-anim'); session.delay(() => image.classList.remove('flash-anim'), 300); }
        log(`${key.startsWith('p1') ? '我方' : '敌方'} ${isHeal ? '恢复了体力' : '受到伤害'}`, isHeal ? 'heal' : 'damage');
    }
    if (line.startsWith('|-boost|') || line.startsWith('|-unboost|')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        const stat = parts[3];
        const amount = parseInt(parts[4]);
        const isBoost = line.startsWith('|-boost|');
        if (!statsState[key]) statsState[key] = {};
        statsState[key][stat] = Math.max(-6, Math.min(6, (statsState[key][stat] || 0) + (isBoost ? amount : -amount)));
        updateStatusUI(key);
    }
    if (line.startsWith('|-status|')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        statusState[key] = parts[3];
        updateStatusUI(key);
    }
    if (line.startsWith('|-curestatus|')) {
        const parts = line.split('|');
        const key = normalizeTargetId(parts[2]);
        statusState[key] = '';
        updateStatusUI(key);
    }

    const parts = line.split('|');
    if (['-supereffective', '-resisted', '-crit', '-immune', '-miss', 'cant', '-fail'].includes(parts[1])) {
        const messages = { '-supereffective':'效果绝佳！', '-resisted':'效果不太好…', '-crit':'击中要害！', '-immune':'没有效果！', '-miss':'招式没有命中！', cant:'本次无法行动', '-fail':'招式未能生效' };
        log(messages[parts[1]], 'effect');
    }
    if (parts[1] === '-sidestart' || parts[1] === '-sideend') {
        const side = parts[2]?.startsWith('p1') ? 'p1side' : 'p2side';
        const condition = parts[3]?.replace(/^move: /, '');
        if (condition) {
            fieldState[side] = fieldState[side].filter(c => c !== condition);
            if (parts[1] === '-sidestart') fieldState[side].push(condition);
            updateSideConditions();
        }
    }
    if (['-clearallboost', '-clearboost', '-clearnegativeboost', '-setboost'].includes(parts[1])) {
        const keys = parts[1] === '-clearallboost' ? Object.keys(statsState) : [normalizeTargetId(parts[2])];
        for (const key of keys) {
            if (parts[1] === '-setboost') statsState[key][parts[3]] = Number(parts[4]);
            else if (parts[1] === '-clearnegativeboost') { for (const stat of Object.keys(statsState[key])) if (statsState[key][stat] < 0) statsState[key][stat] = 0; }
            else statsState[key] = {};
            updateStatusUI(key);
        }
    }
    if (parts[1] === '-formechange' || parts[1] === 'detailschange') {
        const key = normalizeTargetId(parts[2]), species = parts[3]?.split(',')[0];
        if (species) { const name = document.getElementById(`${key}-name`); if (name) name.innerText = speciesName(species, Dex); updateTypes(key, species); forceUpdateImage(key, species); }
    }
    if (line.startsWith('|win|') || line === '|tie') finishBattle(session, line === '|tie' ? null : parts[2]);

}

function finishBattle(session, winner) {
    if (session !== currentSession || session.finished) return;
    session.finished = true;
    const outcome = winner === null ? 'draw' : winner === 'Player' ? 'victory' : 'defeat';
    const message = { draw:'平局', victory:'获得胜利', defeat:'战败' }[outcome];
    log(`🏁 对战结束：${message}`, 'win');
    controls.finish(`对战结束 · ${message}`);
    const report = { battleId: session.id, outcome, winner, isVictory: outcome === 'victory', mode: session.mode, gen: session.gen,
        p1Status: message, p2Status: outcome === 'draw' ? '平局' : outcome === 'victory' ? '全员战败' : '获得胜利',
        userNote: outcome === 'draw' ? '本次对战双方平局' : `玩家在战斗中${message}` };
    session.delay(() => {
        if (session.reported) return;
        session.reported = true;
        window.parent.postMessage({ type:'BATTLE_RESULT', payload:report }, returnOrigin);
    }, playbackSpeed === Infinity ? 0 : 1000 / playbackSpeed);
}
function eventDelay(line) {
    if (line.startsWith('|move|')) return 450;
    if (/^\|-(damage|heal)\|/.test(line)) return 380;
    if (/^\|(switch|drag|faint)\|/.test(line)) return 500;
    if (/^\|-(mega|terastallize|start)\|/.test(line)) return 450;
    return 0;
}
function scheduleRequest(session) {
    const version = ++session.requestVersion;
    session.delay(async () => {
        await session.playback.whenIdle();
        if (currentSession !== session || session.stopped || session.finished || version !== session.requestVersion) return;
        if (session.request) { inspector.ownRequest(session.request); controls.setRequest(session.request); }
        if (session.error) { controls.recover(session.error); session.error = null; }
    }, 0);
}
function stopBattle() {
    inspector.reset();
    feedback.reset();
    const session = currentSession;
    if (!session) return;
    session.stopped = true;
    session.playback.cancel();
    for (const timer of session.timers) clearTimeout(timer);
    session.timers.clear();
    // Stream.destroy can throw after an already finished stream; all old consumers
    // are also guarded by their session identity.
    try { session.stream.destroy(); } catch (_) {}
    currentSession = null;
    p1Stream = null;
}
async function startMyBattle(team1Packed, team2Packed, mode = 'singles', gen = 'gen9') {
    stopBattle();
    controls.reset();
    document.getElementById('log-container').innerHTML = '';
    currentBattleMode = mode === 'doubles' ? 'doubles' : 'singles';
    currentGen = gen === 'gen8' ? 'gen8' : 'gen9';
    for (const id of ['p1b-card','p2b-card','p1b-wrapper','p2b-wrapper']) document.getElementById(id)?.classList.toggle('hidden', currentBattleMode !== 'doubles');
    p2FaintedCount = 0; p2TotalPokemon = 0;
    statsState = { p1a:{}, p1b:{}, p2a:{}, p2b:{} };
    statusState = { p1a:'', p1b:'', p2a:'', p2b:'' };
    fieldState = { weather:'', terrain:'', pseudo:[], p1side:[], p2side:[] };
    updateSideConditions();
    for (const key of Object.keys(statsState)) {
        const img = document.getElementById(`${key}-img`);
        if (img) { img.className = img.className.replace(/(?:dynamax|tera|faint|shake|flash)-anim/g, ''); img.classList.remove('opacity-0'); }
        const badge = document.getElementById(`${key}-gimmick-badge`); if (badge) badge.innerText = '';
    }
    const stream = new BattleStream();
    const streams = getPlayerStreams(stream);
    const session = { id:`${Date.now()}-${Math.random().toString(36).slice(2)}`, stream, playback:new BattlePlayback(error => failSession(session, error)),
        stopped:false, finished:false, reported:false, timers:new Set(), requestVersion:0, request:null,
        mode:currentBattleMode, gen:currentGen,
        delay(callback, ms) {
            const timer = setTimeout(() => {
                this.timers.delete(timer);
                if (currentSession === this && !this.stopped) Promise.resolve().then(callback).catch(error => failSession(this, error));
            }, ms);
            this.timers.add(timer); return timer;
        } };
    currentSession = session;
    session.playback.setSpeed(playbackSpeed);
    p1Stream = streams.p1;
    const consume = task => task.catch(error => failSession(session, error));
    consume(new BasicPlayerAI(streams.p2).start());
    consume((async () => {
        for await (const chunk of streams.p1) {
            if (session !== currentSession || session.stopped) break;
            for (const line of chunk.split('\n')) {
                if (line.startsWith('|request|')) { session.request = JSON.parse(line.slice(9)); scheduleRequest(session); }
                if (line.startsWith('|') && !line.startsWith('|request|') && !line.startsWith('|error|')) {
                    session.playback.enqueue(() => { if (session===currentSession && !session.stopped) inspector.observe(line); },0);
                }
                if (line.startsWith('|error|')) {
                    session.error = line.slice(7);
                    log(`⚠️ 引擎拒绝了行动：${escapeHtml(session.error)}`, 'turn'); scheduleRequest(session);
                }
            }
        }
    })());
    consume((async () => {
        for await (const chunk of streams.omniscient) {
            if (session !== currentSession || session.stopped) break;
            controls.lock();
            for (const line of chunk.split('\n')) session.playback.enqueue(() => {
                if (session !== currentSession || session.stopped) return;
                handleBattleLine(line, session);
            }, eventDelay(line));
        }
    })());
    log(`⚔️ 对战启动 · ${currentBattleMode === 'doubles' ? '双打' : '单打'} · ${currentGen.toUpperCase()}`, 'turn');
    const formatid = currentGen + (currentBattleMode === 'doubles' ? 'doubles' : '') + 'customgame';
    await streams.omniscient.write(`>start ${JSON.stringify({ formatid })}`);
    await streams.omniscient.write(`>player p1 ${JSON.stringify({ name:'Player', team:team1Packed })}`);
    await streams.omniscient.write(`>player p2 ${JSON.stringify({ name:'Rival', team:team2Packed })}`);
}
function failSession(session, error) {
    if (session !== currentSession || session.stopped) return;
    console.error('战斗异常', error);
    session.playback.cancel();
    controls.finish('战斗发生异常，请打开“调试与预设”重新开始');
    log(`⚠️ 战斗异常：${escapeHtml(error.message || error)}`, 'turn');
}
window.setBattleSpeed = value => {
    playbackSpeed = value === 'instant' ? Infinity : Number(value) || 1;
    currentSession?.playback.setSpeed(playbackSpeed);
};
window.skipBattleAnimation = () => {
    const session = currentSession;
    if (!session) return;
    session.playback.skip();
    void session.playback.whenIdle().then(() => { if (session === currentSession) session.playback.setSpeed(playbackSpeed); });
};
window.addEventListener('pagehide', stopBattle);
window.addEventListener('message', event => {
    if (event.source !== window.parent || !event.data || event.data.type !== 'START_BATTLE') return;
    const data = event.data.payload;
    if (!data || typeof data.p1?.team !== 'string' || typeof data.p2?.team !== 'string') {
        alert('战斗数据不完整：需要双方的队伍文本'); return;
    }
    const p1Packed = parseTeam(data.p1.team), p2Packed = parseTeam(data.p2.team);
    if (!p1Packed || !p2Packed) { alert('传入队伍格式解析失败'); return; }
    returnOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
    document.getElementById('setup-modal')?.classList.add('hidden');
    document.getElementById('menu-layer')?.classList.remove('hidden');
    startMyBattle(p1Packed, p2Packed, data.mode || data.gameType, data.gen).catch(error => failSession(currentSession, error));
});
