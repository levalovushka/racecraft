// Interface language: English and Russian. Every string the interface shows
// lives here; components read them through useT(). The engine keeps English
// log text for headless runs, the interface rebuilds events from their fields.
import { createContext, useContext } from 'react'
import type { Driver, LogItem, Race } from '@/engine/race'

export type Lang = 'en' | 'ru'

const PLURAL = { en: new Intl.PluralRules('en'), ru: new Intl.PluralRules('ru') }

/** Rivals' surnames as they are written in Russian */
const NAMES_RU: Record<string, string> = {
  Kuksenko: 'Куксенко', Shik: 'Шик', Zholobov: 'Жолобов', Rebenko: 'Ребенко', Semashko: 'Семашко',
  Shepelev: 'Шепелев', Kalinin: 'Калинин', Ivanov: 'Иванов', Sokolik: 'Соколик',
}

const en = {
  lang: 'en' as Lang,
  laps: (n: number) => `${n} ${PLURAL.en.select(n) === 'one' ? 'lap' : 'laps'}`,
  s: 's',
  you: 'You',

  // setup
  title: 'Pit manager',
  subtitle: 'You decide when the driver pits. After the flag, compare with a bot in the same race',
  rules: ['60\u00a0laps', '2 stops', '25\u00a0s in the box', 'min stint 10\u00a0laps'],
  driver: 'Driver',
  driverExample: 'Petrov',
  start: 'Start',
  drawnStart: 'Drawn start',
  setStart: 'Custom start',
  gridPosition: 'Grid position',
  startingClass: 'Starting kart class',
  classN: (c: string) => `Class ${c}`,
  pace: 'Pace',
  paceAverage: 'same as rivals',
  perLap: 's/lap',
  faster: 'faster',
  slower: 'slower',
  attacksIfFaster: (s: string) => `attacks when ${s} s/lap faster`,
  aggression: 'Aggression',
  sitsBehind: 'stays behind',
  attacksAtOnce: 'attacks at once',
  seed: 'Race number',
  shuffle: 'Random',
  startRace: 'Start race',

  // app bar and race state
  language: 'Language',
  speed: 'Speed',
  key: (k: string) => `Key ${k}`,
  pause: 'Pause',
  resume: 'Resume',
  openDebrief: 'Open debrief',
  race: 'Race',
  track: 'Track',
  lap: 'Lap',
  of: 'of',
  flag: 'Chequered flag',
  startLights: 'Start lights',
  lightsGo: 'Green, go',

  // you
  afterStops: 'after all stops',
  afterStopsHint: 'Your position once every driver, you included, has made their remaining stops. Each stop ≈ 32 s.',
  finalOrder: 'Final order',
  lastLap: 'Last lap',
  best: 'Best',
  aroundYou: 'Around you',
  ahead: 'ahead',
  behind: 'behind',
  finished: 'Finished',
  waitingGreen: 'Waiting for green',
  inPitLane: 'In the pit lane',
  allStopsDone: 'All stops done',
  minStint: (n: string) => `Min stint · ${n} to go`,
  overstaying: 'Overstaying · +10 s a lap',
  burning: (n: string) => `Burning · ${n} left`,
  windowOpen: (n: string) => `Window open · ${n} left`,
  stops: 'stops',

  // box and orders
  forecast: 'Forecast',
  forecastNote: 'Rivals about to pit.',
  decision: 'Decision',
  takes: 'takes',
  yourEntry: (n: number) => `you reach pit entry in ${n} s`,
  goBeforeYou: '↑ these karts go before you',
  maybe: 'maybe',
  maybeHint: 'Only one class better — he may stay out',
  burningHint: 'Must pit within the next laps or break the stint rules',
  deadlineHint: 'Must pit by his last allowed lap',
  whenHint: 'now = already in the pit lane; N s — this lap; +N laps — in N laps',
  nowShort: 'now',
  inLaps: (n: number) => `+${n} ${n === 1 ? 'lap' : 'laps'}`,
  deadline: 'deadline',
  ifStaysOutN: (n: string) => `if ${n} stays out`,
  ifNobodyGoesIn: 'if nobody goes in ahead',
  noStopsLeft: 'Rivals have no stops left',
  forecastAria: 'Stops to come: who hands over which kart and takes which',
  laneBusy: 'pit lane busy, you stay out',
  inHand: (n: string) => `then ${n} left`,
  lastChance: 'last lap to stop is next',
  overstayS: (n: number) => `overstay +${n} s`,
  driverGetsIn: (n: number) => `Driver gets it in ${n} s`,
  driverHasIt: 'Driver has it',
  changesNextLap: 'Change goes next lap',
  box: 'Box',
  pitWait: (n: number) => `Pit: wait ${n} s`,
  pitOpen: 'Pit: open',
  boxLight: 'Box light. Red — someone just swapped karts, the next driver waits. Green — the box is open.',
  orders: { stay: 'Stay out', boxIfClear: 'Box if clear', box: 'Box' },
  ordersLower: { stay: 'stay out', boxIfClear: 'box if clear', box: 'box' },
  orderToDriver: 'Order to the driver',
  inTheBox: 'In the box',
  first: 'first',
  second: 'second',
  noWait: 'no wait',
  waitS: (n: number) => `wait ${n} s`,
  penaltyS: (n: number) => `+${n} s penalty`,
  youTake: 'You take',
  waitingForGreen: (n: number) => `waiting for green · ${n} s`,
  outIn: (n: number) => `out in ${n} s`,
  rejoining: 'Rejoining the track',
  boxClosed: 'Box closed',

  // timing
  liveTiming: 'Live timing',
  cols: { pos: 'Pos', driver: 'Driver', kart: 'Kart', interval: 'Interval', last: 'Last', best: 'Best', avg: 'Average', stint: 'On kart', stops: 'Stops', status: 'Status' },
  kartHint: 'Kart colour is your class rating (A–D), not its true speed. Click a kart to change the rating — the forecast updates.',
  stintHint: 'Laps completed on the current kart. Red — time to pit: the last lap a stop is still possible is close.',
  leader: 'Leader',
  status: { pit: 'In the pit lane', burning: 'Burning', toMin: (n: string) => `${n} to min`, hungry: 'Wants a kart' },
  kartAria: (label: number, c: string) => `Kart ${label}, class ${c}`,
  rerate: 'Change your class rating: A→B→C→D',
  lastStopLap: (n: number) => `Last lap to start a stop: ${n}`,

  // events
  raceEvents: 'Race events',
  event: {
    passedYou: (n: string) => `${n} passed you`,
    youPassed: (n: string) => `You passed ${n}`,
    skip: 'Someone went in ahead — staying out',
    flag: (n: string) => `Chequered flag: ${n}`,
    inLane: 'You are in the pit lane',
    kart: (n: string, a: number, b: number, w: number) => `${n}: kart ${a} → ${b}${w > 0.5 ? `, waited ${w.toFixed(1)} s` : ''}`,
  },

  // debrief
  debrief: 'Debrief',
  raceAgain: 'Race again',
  startNewRace: 'Start new race',
  againstBot: 'Against the bot in the same race',
  level: 'Level with the bot.',
  beat: 'You beat the bot.',
  worse: 'The bot did better.',
  sameKarts: 'Same karts, rivals and noise: the difference is your calls.',
  bot: 'Bot',
  penaltyNote: (p: number) => `+${p} s penalty`,
  whereTime: 'Where the time went',
  loss: { karts: 'Karts', red: 'Under red', traffic: 'Traffic', penalties: 'Penalties' },
  total: 'Total',
  stints: 'Stints',
  trueClasses: 'true classes',
  kartsCost: 'karts',
  youRatedIt: 'you rated it',
  classification: 'Classification',
  resultCols: { pos: 'Pos', driver: 'Driver', laps: 'Laps', time: 'Time', penalty: 'Penalty', karts: 'Karts' },
  calls: 'Calls',
  evaluating: (a: number, b: number) => `Evaluating ${a} of ${b}`,
  evaluatingOne: 'Evaluating',
  callsNote: 'Each call against the other one: 24 race continuations, then the bot drives',
  nothingToReview: 'Nothing to review: the box never had a better kart and you never stopped.',
  callCols: { lap: 'Lap', situation: 'Situation', kart: 'Kart', red: 'Red', margin: 'Margin', call: 'Call', verdict: 'Verdict' },
  kind: { pit: 'Stopped', hungry: 'Upgrade in box', burning: 'Burning' },
  callText: { box: 'Box', stay: 'Stay out', clearIn: 'Box if clear → stopped', clearOut: 'Box if clear → stayed out' },
  noDifference: 'No difference',
  rightCall: (x: string) => `Right call, ${x} s`,
  betterWas: (stay: boolean, x: string) => `${stay ? 'Staying out' : 'Boxing'} was better, ${x} s`,
  to: 'to',
}

export type Dict = typeof en

const ru: Dict = {
  lang: 'ru',
  laps: (n) => {
    const f = PLURAL.ru.select(n)
    return `${n} ${f === 'one' ? 'круг' : f === 'few' ? 'круга' : 'кругов'}`
  },
  s: 'с',
  you: 'Вы',

  title: 'Пит-менеджер',
  subtitle: 'Вы решаете, когда пилоту заехать в\u00a0бокс. После финиша\u00a0— сравнение с\u00a0ботом в\u00a0той же гонке',
  rules: ['60\u00a0кругов', '2 пита', '25\u00a0с в\u00a0боксе', 'стинт от 10\u00a0кругов'],
  driver: 'Пилот',
  driverExample: 'Петров',
  start: 'Старт',
  drawnStart: 'Старт по жребию',
  setStart: 'Свой старт',
  gridPosition: 'Позиция на решётке',
  startingClass: 'Класс стартового карта',
  classN: (c) => `Класс ${c}`,
  pace: 'Темп',
  paceAverage: 'как у соперников',
  perLap: 'с/круг',
  faster: 'быстрее',
  slower: 'медленнее',
  attacksIfFaster: (s) => `атакует, если быстрее на ${s} с/круг`,
  aggression: 'Агрессия',
  sitsBehind: 'держится сзади',
  attacksAtOnce: 'атакует сразу',
  seed: 'Номер гонки',
  shuffle: 'Случайный',
  startRace: 'Начать гонку',

  language: 'Язык',
  speed: 'Скорость',
  key: (k) => `Клавиша ${k}`,
  pause: 'Пауза',
  resume: 'Дальше',
  openDebrief: 'К разбору',
  race: 'Гонка',
  track: 'Трасса',
  lap: 'Круг',
  of: 'из',
  flag: 'Финиш',
  startLights: 'Стартовые огни',
  lightsGo: 'Зелёный, старт',

  afterStops: 'после всех питов',
  afterStopsHint: 'Ваше место, когда все гонщики, и вы тоже, сделают оставшиеся питы. Каждый пит ≈ 32 с.',
  finalOrder: 'Итоговый порядок',
  lastLap: 'Последний',
  best: 'Лучший',
  aroundYou: 'Соседи',
  ahead: 'впереди',
  behind: 'сзади',
  finished: 'Финишировали',
  waitingGreen: 'Ждём зелёный',
  inPitLane: 'В пит-лейне',
  allStopsDone: 'Питы сделаны',
  minStint: (n) => `Мин. стинт · ещё ${n}`,
  overstaying: 'Пересид · +10 с за круг',
  burning: (n) => `Горим · осталось ${n}`,
  windowOpen: (n) => `Окно открыто · осталось ${n}`,
  stops: 'питы',

  forecast: 'Прогноз',
  forecastNote: 'Кто из соперников скоро заедет в пит.',
  decision: 'Решение',
  takes: 'заберёт',
  yourEntry: (n) => `вы у въезда в пит через ${n} с`,
  goBeforeYou: '↑ эти карты разберут до вас',
  maybe: 'может',
  maybeHint: 'Выгода всего один класс — может и не заехать',
  burningHint: 'Должен заехать в ближайшие круги, иначе нарушит правила стинта',
  deadlineHint: 'Обязан заехать до своего последнего допустимого круга',
  whenHint: 'сейчас = уже в пит-лейне; N с — в этом круге; +N кр — через N кругов',
  nowShort: 'сейчас',
  inLaps: (n) => `+${n} кр`,
  deadline: 'дедлайн',
  ifStaysOutN: (n) => `если ${n} проедет`,
  ifNobodyGoesIn: 'если никто не заедет',
  noStopsLeft: 'Соперникам питы больше не нужны',
  forecastAria: 'Будущие питы: кто какой карт сдаст и какой заберёт',
  laneBusy: 'пит-лейн занят, проедете',
  inHand: (n) => `останется ${n}`,
  lastChance: 'следующий круг — последний',
  overstayS: (n) => `пересид +${n} с`,
  driverGetsIn: (n) => `Пилот получит через ${n} с`,
  driverHasIt: 'Пилот получил',
  changesNextLap: 'Изменение — со след. круга',
  box: 'Бокс',
  pitWait: (n) => `Пит: ждать ${n} с`,
  pitOpen: 'Пит: свободно',
  boxLight: 'Светофор бокса. Красный — кто-то только что сменил карт, следующий ждёт. Зелёный — можно заезжать.',
  orders: { stay: 'Мимо', boxIfClear: 'Бокс, если чисто', box: 'Бокс' },
  ordersLower: { stay: 'мимо', boxIfClear: 'бокс, если чисто', box: 'бокс' },
  orderToDriver: 'Указание пилоту',
  inTheBox: 'В боксе',
  first: 'первый',
  second: 'второй',
  noWait: 'без ожидания',
  waitS: (n) => `ждать ${n} с`,
  penaltyS: (n) => `+${n} с штрафа`,
  youTake: 'Вы берёте',
  waitingForGreen: (n) => `ждём зелёный · ${n} с`,
  outIn: (n) => `выезд через ${n} с`,
  rejoining: 'Выезжаете на трассу',
  boxClosed: 'Бокс закрыт',

  liveTiming: 'Тайминг',
  cols: { pos: 'Поз.', driver: 'Пилот', kart: 'Карт', interval: 'Интервал', last: 'Последний', best: 'Лучший', avg: 'Средний', stint: 'На карте', stops: 'Питы', status: 'Статус' },
  kartHint: 'Цвет карта — ваша оценка его класса (A–D), не точная скорость. Клик по карту меняет оценку — прогноз пересчитается.',
  stintHint: 'Сколько кругов вы проехали на текущем карте. Красным — пора в пит: скоро последний круг, когда пит ещё можно сделать.',
  leader: 'Лидер',
  status: { pit: 'В пит-лейне', burning: 'Горит', toMin: (n) => `${n} до мин.`, hungry: 'Ищет карт' },
  kartAria: (label, c) => `Карт ${label}, класс ${c}`,
  rerate: 'Сменить вашу оценку класса: A→B→C→D',
  lastStopLap: (n) => `Последний круг для пита: ${n}`,

  raceEvents: 'События гонки',
  event: {
    passedYou: (n) => `${n} обогнал вас`,
    youPassed: (n) => `Вы обогнали: ${n}`,
    skip: 'Перед вами заехали — остаёмся',
    flag: (n) => `Финиш: ${n}`,
    inLane: 'Вы в пит-лейне',
    kart: (n, a, b, w) => `${n}: карт ${a} → ${b}${w > 0.5 ? `, ждал ${w.toFixed(1)} с` : ''}`,
  },

  debrief: 'Разбор',
  raceAgain: 'Проехать ещё раз',
  startNewRace: 'Начать новую гонку',
  againstBot: 'Против бота в\u00a0той же гонке',
  level: 'Вровень с ботом.',
  beat: 'Вы обыграли бота.',
  worse: 'Бот проехал лучше.',
  sameKarts: 'Те же карты, соперники и шум: разница — в ваших решениях.',
  bot: 'Бот',
  penaltyNote: (p) => `+${p} с штрафа`,
  whereTime: 'Куда ушло время',
  loss: { karts: 'Карты', red: 'Под красным', traffic: 'Трафик', penalties: 'Штрафы' },
  total: 'Итого',
  stints: 'Стинты',
  trueClasses: 'истинные классы',
  kartsCost: 'карты',
  youRatedIt: 'вы оценили как',
  classification: 'Протокол',
  resultCols: { pos: 'Поз.', driver: 'Пилот', laps: 'Круги', time: 'Время', penalty: 'Штраф', karts: 'Карты' },
  calls: 'Решения',
  evaluating: (a, b) => `Оценка ${a} из ${b}`,
  evaluatingOne: 'Оценка',
  callsNote: 'Каждое решение против другого: 24 продолжения гонки, дальше за вас едет бот',
  nothingToReview: 'Нечего разбирать: в боксе не было карта лучше вашего, и вы не заезжали.',
  callCols: { lap: 'Круг', situation: 'Ситуация', kart: 'Карт', red: 'Красный', margin: 'Запас', call: 'Решение', verdict: 'Оценка' },
  kind: { pit: 'Заехали', hungry: 'Апгрейд в боксе', burning: 'Горели' },
  callText: { box: 'Бокс', stay: 'Мимо', clearIn: 'Бокс, если чисто → заехали', clearOut: 'Бокс, если чисто → проехали' },
  noDifference: 'Разницы нет',
  rightCall: (x) => `Верно, ${x} с`,
  betterWas: (stay, x) => `Лучше было ${stay ? 'проехать' : 'заехать'}, ${x} с`,
  to: 'на',
}

export const DICTS: Record<Lang, Dict> = { en, ru }

// the choice is a per-viewer convenience: storage may be unavailable, the app works without it
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('racecraft.lang')
    if (saved === 'en' || saved === 'ru') return saved
  } catch {
    // ignore
  }
  return typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en'
}

export const LangContext = createContext<{ t: Dict; setLang: (l: Lang) => void }>({ t: en, setLang: () => {} })

export const useT = () => useContext(LangContext).t
export const useSetLang = () => useContext(LangContext).setLang

/** A driver's name in the interface language; our driver without a surname is "You" */
export function driverName(t: Dict, d: Driver): string {
  if (d.isUs) return d.name === 'You' ? t.you : d.name
  return t.lang === 'ru' ? NAMES_RU[d.name] ?? d.name : d.name
}

/** A race event in the interface language, rebuilt from its fields */
export function eventText(t: Dict, r: Race, it: LogItem): string {
  const who = it.driver !== undefined ? driverName(t, r.drivers[it.driver]) : ''
  switch (it.kind) {
    case 'overtake': return it.ourGain ? t.event.youPassed(who) : t.event.passedYou(who)
    case 'skip': return t.event.skip
    case 'flag': return t.event.flag(who)
    case 'pit': return t.event.inLane
    case 'kart': return t.event.kart(who, r.karts[it.from!].label, r.karts[it.to!].label, it.wait ?? 0)
    default: return it.text
  }
}
