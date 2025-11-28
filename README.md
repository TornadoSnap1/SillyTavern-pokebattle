pokemon showdown-SillyTavern 宝可梦对战扩展 (v1.0)

作者：龙卷姜饼云

目前还是实验版，有问题见谅。

1，它能做什么？
负责silly tavern宝可梦卡片的，基于pokemon showdown的战斗系统。ai按格式输出战斗信息时，可以通过此扩展渲染为战斗面板。其实类似于一个正则，但是把ps战斗核心塞进正则不太可能。
由于是基于pokemon showdown，所以可以实现几乎完全还原的战斗逻辑。过程不需要llm参与战斗，因此节省token和时间，并且避免幻觉和计算错误。

2，工作流程：
 （1）通过在世界书中设置prompt，让ai按格式将ps格式输出战斗信息，包裹在[pkbattlestart]和 [pkbattleend]之间，扩展会用于输出战斗面板，下面是prompt示例，请根据自己的宝可梦卡片决定实际提示词。
 （2）战斗全程在面板中实现，目前单打逻辑基本上完全实现，并且设置了简单的宝可梦倒下动画等，方便视觉观察。
 
 （3）结束后，会将战斗胜利方、当前队伍宝可梦血量百分比以及你自己的额外输入发给原对话。可以在原卡片世界书设置提示词，引导ai对战斗结果做出合理的反应（奖励、角色反应等）

3。示例提示词：
### JSON 格式规范 (Strict JSON Schema)
必须严格遵守 JSON 语法，不得出现 JSON 无法解析的字符。

- **包裹标签**：数据必须位于 `[pkbattlestart]` 和 `[pkbattleend]` 之间。
- **team 字段**：
  - 这是一个**单行字符串**。
  - 必须使用 **Pokémon Showdown Export Format**。
  - **关键规则**：字符串内部的所有换行，**必须**显式写为 `\n` 字符。**绝对不要**在 JSON 字符串内部直接回车换行。
  - 多只宝可梦之间，必须使用 **两个** `\n` (`\n\n`) 进行分隔。

### 队伍格式详解 (Showdown Format Explanation)
每一只宝可梦的数据块应遵循以下结构（注意 `\n`）：

1. **首行**: `Pokémon Name @ Item Name` (如果没有道具，只写名字，不要写 `@`)
2. **特性**: `Ability: Ability Name`
3. **等级**: `Level: XX` 
4. **努力值**: `EVs: 252 Atk / 4 Def / 252 Spe` (可选，用 `/` 分隔)
5. **性格**: `Nature Name Nature` (例如 `Jolly Nature`)
6. **招式**: `- Move Name` (每行一个，最多4个)

### 完整输出示例 (Full Example)

[pkbattlestart]
{
  "p1": {
    "name": "{{user}}",
    "team": "Pikachu @ Light Ball\nAbility: Lightning Rod\nLevel: 50\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Thunderbolt\n- Surf\n- Play Rough\n- Nasty Plot\n\nCharizard @ Charizardite X\nAbility: Blaze\nLevel: 52\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Flare Blitz\n- Dragon Claw\n- Roost\n- Dragon Dance\n\nGreninja @ Life Orb\nAbility: Protean\nLevel: 50\nEVs: 252 SpA / 4 Atk / 252 Spe\nNaive Nature\n- Hydro Pump\n- Ice Beam\n- Gunk Shot\n- Spikes\n\nLucario\nAbility: Inner Focus\nLevel: 48\nEVs: 252 Atk / 252 Spe\nAdamant Nature\n- Close Combat\n- Bullet Punch\n- Swords Dance\n- Extreme Speed\n\nSylveon @ Leftovers\nAbility: Pixilate\nLevel: 49\nEVs: 252 HP / 252 SpA / 4 SpD\nModest Nature\n- Hyper Voice\n- Wish\n- Protect\n- Calm Mind"
  },
  "p2": {
    "name": "Ace Trainer Cool Guy",
    "team": "Garchomp @ Rocky Helmet\nAbility: Rough Skin\nLevel: 55\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- Dragon Claw\n- Stealth Rock\n- Swords Dance\n\nTyranitar @ Assault Vest\nAbility: Sand Stream\nLevel: 54\nEVs: 252 HP / 252 Atk / 4 SpD\nAdamant Nature\n- Stone Edge\n- Crunch\n- Pursuit\n- Earthquake\n\nExcadrill\nAbility: Sand Rush\nLevel: 53\nEVs: 252 Atk / 4 SpD / 252 Spe\nAdamant Nature\n- Earthquake\n- Iron Head\n- Rock Slide\n- Rapid Spin"
  }
}
[pkbattleend]


补充：
目前没有做双打、极巨化等。
