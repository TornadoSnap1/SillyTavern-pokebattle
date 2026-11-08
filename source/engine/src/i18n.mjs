import names from './data/zh-cn.mjs';
export const toId = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const TYPES = { Normal:'一般', Fire:'火', Water:'水', Grass:'草', Electric:'电', Ice:'冰', Fighting:'格斗', Poison:'毒', Ground:'地面', Flying:'飞行', Psychic:'超能力', Bug:'虫', Rock:'岩石', Ghost:'幽灵', Dragon:'龙', Dark:'恶', Steel:'钢', Fairy:'妖精', Stellar:'星晶' };
export const STATUS = { par:'麻痹', slp:'睡眠', psn:'中毒', tox:'剧毒', brn:'灼伤', frz:'冰冻', fnt:'倒下' };
export const STATS = { atk:'攻击', def:'防御', spa:'特攻', spd:'特防', spe:'速度', accuracy:'命中', evasion:'闪避' };
export const tr = (kind, name) => names[kind]?.[toId(name)] || name;
export function speciesName(name, dex) {
  const species = dex.species.get(name);
  const translated = names.pokemon_species[species.num];
  if (!translated) return name;
  const form = species.forme;
  if (!form) return translated;
  const forms = { Mega:'超级', 'Mega-X':'超级·X', 'Mega-Y':'超级·Y', Alola:'阿罗拉', Galar:'伽勒尔', Hisui:'洗翠', Paldea:'帕底亚', Gmax:'超极巨', Primal:'原始回归' };
  return `${translated}（${forms[form] || form}）`;
}
