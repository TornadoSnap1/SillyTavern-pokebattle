# 中文名称来源

名称数据取自 PokeAPI 项目公开 CSV，下载日期 2026-11-03：
https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv

`local_language_id=12` 为简体中文，`9` 为英文。原始 CSV 保留于本目录，
执行 `node scripts/build-translations.mjs` 可离线重建名称字典。
字典只用于显示，战斗内部仍使用 Showdown ID。未覆盖名称保留原文，
部分形态以中文物种名加形态标识显示。

PokeAPI 项目：https://github.com/PokeAPI/pokeapi
许可：https://github.com/PokeAPI/pokeapi/blob/master/LICENSE.md
