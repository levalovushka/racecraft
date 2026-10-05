# racecraft

Инструменты для менеджмента пит-стопов в прокатных гонках с обязательной сменой карта (формат «Гонщик года», сеть Пит-Стоп).

## Документы
- [docs/MECHANICS.md](docs/MECHANICS.md) — механика гонки: регламент, бокс, фазы, поведение поля, цифры из данных.
- [docs/BOARD.md](docs/BOARD.md) — концепция доски менеджера.
- [docs/EDGES.md](docs/EDGES.md) — где искать время относительно поля.
- [docs/CONSTRAINTS.md](docs/CONSTRAINTS.md) — технические ограничения: связь, задержка тайминга, номера транспондера и шасси.
- [docs/GLOSSARY.md](docs/GLOSSARY.md) — словарь.

## Источник данных: timing.batyrshin.name
- `/tracks/<track>/heats/<id>` — заезд: круги по пилотам (класс `pitstop-cell` = круг пита), стинты (S1..S3: карт, круги, best/avg, warm-up loss) и **Pit stops history**: круг, время гонки, пилот, карт `из → в`, карты в питлейне после пита (правый = следующий к выдаче).
- `/heats?t=16|14` — списки заездов чемпионата (ГГ2026 / ГГ2025).
- `/tracks/<track>/karts` — лучшие времена по картам за 1/7/14 дней.
- Live: SPA `/tracks/<track>/live`, WebSocket `wss://timing.batyrshin.name/ws`, после открытия отправить `listen track:<track>`. Сообщения JSON: `id, name, mode, elapsed, drivers[{driver{id,name}, laps[{number,time,stintNum}], stint{number,length,avgTime,bestTime,kart}}], pitlaneKarts, pitstopTimeThreshold`.
- На Drive в старых заездах время пита в истории = 0 (невалидно).

## Скрипты
```
scripts/fetch_season.sh 16 14     # скачать заезды в data/heats
python3 racecraft/timing_parse.py # → data/races.json
python3 scripts/season_stats.py   # разброс картов, питы, конвейер бокса
```
