--- src/game.ts (原始)


+++ src/game.ts (修改后)
// ============================================================
// Типы и константы
// ============================================================
export type Rank = "9" | "J" | "Q" | "K" | "10" | "A";
export type Suit = "♠" | "♣" | "♦" | "♥";
export type Card = [Rank, Suit];

export const RANKS: Rank[] = ["9", "J", "Q", "K", "10", "A"];
export const SUITS: Suit[] = ["♠", "♣", "♦", "♥"];

export const VALUE: Record<Rank, number> = { "9": 0, "J": 2, "Q": 3, "K": 4, "10": 10, "A": 11 };
export const RANK_VALUE: Record<Rank, number> = { "9": 0, "J": 1, "Q": 2, "K": 3, "10": 4, "A": 5 };
export const MARRIAGE_VALUE: Record<Suit, number> = { "♠": 40, "♣": 60, "♦": 80, "♥": 100 };
export const SUIT_COLOR: Record<Suit, string> = { "♥": "#e53e3e", "♦": "#e53e3e", "♣": "#1a202c", "♠": "#1a202c" };

export const BASE_BID_LIMIT = 120;
export const DROP_PENALTY_TO_OPPONENTS = 40;

export type Phase =
  | "BIDDING"
  | "SHOW_KITTY"
  | "PLAYER_DISCARD_1"
  | "PLAYER_DISCARD_2"
  | "COMPUTER_DISCARD"
  | "FINAL_CONTRACT"
  | "PLAYING"
  | "ROUND_END"
  | "GAME_OVER";

export type LogType = "info" | "action" | "result" | "system";
export interface LogEntry {
  text: string;
  type: LogType;
}

export interface GameState {
  phase: Phase;
  hands: [Card[], Card[], Card[]];
  kitty: Card[];
  kittyRevealed: boolean;
  scores: [number, number, number];
  dealer: number;
  bidder: number | null;
  obligated: number;
  highestBid: number;
  contract: number | null;
  finalContract: number | null;
  trump: Suit | null;
  passed: [boolean, boolean, boolean];
  currentBidPlayer: number;
  roundPoints: [number, number, number];
  marriagePoints: [number, number, number];
  announcedMarriages: [Set<Suit>, Set<Suit>, Set<Suit>];
  trick: [number, Card][];
  leadSuit: Suit | null;
  lastTrickWinner: number | null;
  currentPlayPlayer: number;
  playedCards: Card[];
  log: LogEntry[];
  gameOver: boolean;
  winner: number | null;
  // Для сброса карт игроком
  discardForComp1: Card | null;
  discardForComp2: Card | null;
  // Для финального контракта компьютера
  computerFinalContractPending: number | null;
}

// ============================================================
// Утилиты
// ============================================================
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push([rank, suit]);
    }
  }
  return deck;
}

export function cardText(card: Card): string {
  return card[0] + card[1];
}

export function roundedTo5(x: number): number {
  return Math.round(x / 5) * 5;
}

export function playerName(player: number): string {
  return player === 0 ? "Вы" : `Компьютер ${player}`;
}

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    const suitDiff = SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]);
    if (suitDiff !== 0) return suitDiff;
    return RANK_VALUE[a[0]] - RANK_VALUE[b[0]];
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// Создание начального состояния
// ============================================================
export function createInitialState(): GameState {
  return {
    phase: "BIDDING",
    hands: [[], [], []],
    kitty: [],
    kittyRevealed: false,
    scores: [0, 0, 0],
    dealer: Math.floor(Math.random() * 3),
    bidder: null,
    obligated: 0,
    highestBid: 100,
    contract: null,
    finalContract: null,
    trump: null,
    passed: [false, false, false],
    currentBidPlayer: 0,
    roundPoints: [0, 0, 0],
    marriagePoints: [0, 0, 0],
    announcedMarriages: [new Set(), new Set(), new Set()],
    trick: [],
    leadSuit: null,
    lastTrickWinner: null,
    currentPlayPlayer: 0,
    playedCards: [],
    log: [],
    gameOver: false,
    winner: null,
    discardForComp1: null,
    discardForComp2: null,
    computerFinalContractPending: null,
  };
}

// ============================================================
// Начало раунда
// ============================================================
export function startRound(state: GameState): GameState {
  const deck = shuffle(makeDeck());
  const hands: [Card[], Card[], Card[]] = [[], [], []];
  let idx = 0;
  for (let i = 0; i < 7; i++) {
    for (let p = 0; p < 3; p++) {
      hands[p].push(deck[idx++]);
    }
  }
  const kitty: Card[] = [deck[idx], deck[idx + 1], deck[idx + 2]];

  for (let p = 0; p < 3; p++) {
    hands[p] = sortHand(hands[p]);
  }

  const obligated = (state.dealer + 1) % 3;
  const currentBidPlayer = (obligated + 1) % 3;

  const log: LogEntry[] = [
    { text: `=== Новый раунд === Сдающий: ${playerName(state.dealer)}. ${playerName(obligated)} сидит на сотне.`, type: "system" },
    { text: "Начинается торговля.", type: "system" },
  ];

  return {
    ...state,
    phase: "BIDDING",
    hands,
    kitty,
    kittyRevealed: false,
    bidder: obligated,
    obligated,
    highestBid: 100,
    contract: null,
    finalContract: null,
    trump: null,
    passed: [false, false, false],
    currentBidPlayer,
    roundPoints: [0, 0, 0],
    marriagePoints: [0, 0, 0],
    announcedMarriages: [new Set(), new Set(), new Set()],
    trick: [],
    leadSuit: null,
    lastTrickWinner: null,
    currentPlayPlayer: obligated,
    playedCards: [],
    log,
    gameOver: false,
    winner: null,
    discardForComp1: null,
    discardForComp2: null,
    computerFinalContractPending: null,
  };
}

// ============================================================
// Оценка руки для торгов
// ============================================================
export function marriageBonusFor(hand: Card[]): number {
  let best = 0;
  for (const s of SUITS) {
    if (hand.some(c => c[0] === "Q" && c[1] === s) && hand.some(c => c[0] === "K" && c[1] === s)) {
      best = Math.max(best, MARRIAGE_VALUE[s]);
    }
  }
  return best;
}

export function bidLimitFor(hand: Card[]): number {
  return BASE_BID_LIMIT + marriageBonusFor(hand);
}

export function evaluateHand(hand: Card[]): number {
  let expected = 0;
  const bySuit: Record<Suit, Rank[]> = { "♠": [], "♣": [], "♦": [], "♥": [] };
  for (const [r, s] of hand) {
    bySuit[s].push(r);
  }
  for (const s of SUITS) {
    const ranks = bySuit[s];
    const n = ranks.length;
    if (ranks.includes("A")) expected += 11;
    if (ranks.includes("10")) expected += n >= 3 ? 9 : 6;
    if (ranks.includes("K") && n >= 3) expected += 4;
    if (ranks.includes("Q") && ranks.includes("K")) expected += MARRIAGE_VALUE[s] / 2;
  }
  return expected;
}

// ============================================================
// ИИ: Торговля
// ============================================================
export function computerBid(hand: Card[], highestBid: number): number | null {
  const strength = evaluateHand(hand);
  const limit = bidLimitFor(hand);

  let target: number;
  if (strength >= 80) target = limit;
  else if (strength >= 65) target = Math.min(limit, 150);
  else if (strength >= 50) target = Math.min(limit, 130);
  else if (strength >= 40) target = Math.min(limit, 120);
  else target = 0;

  const nextBid = highestBid + 5;
  if (nextBid <= target && nextBid <= limit) {
    return nextBid;
  }
  return null;
}

// ============================================================
// ИИ: Сброс карт компьютером
// ============================================================
export function computerDiscard(hand: Card[]): [Card, Card] {
  const sorted = [...hand].sort((a, b) => {
    const scoreA = cardUsefulness(a, hand);
    const scoreB = cardUsefulness(b, hand);
    return scoreA - scoreB;
  });
  return [sorted[0], sorted[1]];
}

function cardUsefulness(card: Card, hand: Card[]): number {
  const [rank, suit] = card;
  let score = VALUE[rank] * 10;
  const other = rank === "Q" ? "K" : (rank === "K" ? "Q" : null);
  if (other && hand.some(c => c[0] === other && c[1] === suit)) {
    score += MARRIAGE_VALUE[suit];
  }
  if (rank === "A") score += 60;
  else if (rank === "10") score += 40;
  const n = hand.filter(c => c[1] === suit).length;
  if (n <= 2) score -= 20;
  return score;
}

// ============================================================
// ИИ: Финальный контракт компьютера
// ============================================================
export function computerFinalContract(hand: Card[], highestBid: number): number {
  const limit = bidLimitFor(hand);
  const strength = evaluateHand(hand);
  let target = Math.max(highestBid, Math.min(limit, strength));
  target = Math.ceil(target / 5) * 5;
  if (target < highestBid) target = highestBid;
  if (target > limit) target = limit;
  return target;
}

// ============================================================
// ИИ: Выбор карты
// ============================================================
export function legalCards(hand: Card[], trick: [number, Card][], leadSuit: Suit | null, trump: Suit | null): Card[] {
  if (trick.length === 0) return [...hand];
  const led = hand.filter(c => c[1] === leadSuit);
  if (led.length > 0) return led;
  if (trump !== null) {
    const tr = hand.filter(c => c[1] === trump);
    if (tr.length > 0) return tr;
  }
  return [...hand];
}

export function cardBeats(candidate: Card, current: Card, leadSuit: Suit | null, trump: Suit | null): boolean {
  const [cs] = [candidate[1]];
  const cu = current[1];
  if (trump !== null) {
    if (cs === trump) {
      if (cu !== trump) return true;
      return RANK_VALUE[candidate[0]] > RANK_VALUE[current[0]];
    }
    if (cu === trump) return false;
  }
  if (cs !== leadSuit) return false;
  if (cu !== leadSuit) return true;
  return RANK_VALUE[candidate[0]] > RANK_VALUE[current[0]];
}

export function computerChooseCard(
  hand: Card[],
  trick: [number, Card][],
  leadSuit: Suit | null,
  trump: Suit | null,
  bidder: number,
  player: number,
  announcedMarriages: Set<Suit>,
  lastTrickWinner: number | null,
): Card {
  const legal = legalCards(hand, trick, leadSuit, trump);

  // Марьяж при своём ходе
  if (trick.length === 0 && lastTrickWinner === player) {
    let bestSuit: Suit | null = null;
    let bestVal = -1;
    for (const s of SUITS) {
      if (announcedMarriages.has(s)) continue;
      if (hand.some(c => c[0] === "Q" && c[1] === s) && hand.some(c => c[0] === "K" && c[1] === s)) {
        if (MARRIAGE_VALUE[s] > bestVal) {
          bestVal = MARRIAGE_VALUE[s];
          bestSuit = s;
        }
      }
    }
    if (bestSuit !== null) {
      const card = legal.find(c => (c[0] === "Q" || c[0] === "K") && c[1] === bestSuit);
      if (card) return card;
    }
  }

  // Свой ход - выбираем что играть
  if (trick.length === 0) {
    const leadPriority = (card: Card) => {
      const [rank, suit] = card;
      const isTrump = trump !== null && suit === trump;
      if (rank === "A" && !isTrump) return -200;
      if (rank === "10" && !isTrump) return -60;
      if (isTrump) return 100 + RANK_VALUE[rank];
      return RANK_VALUE[rank];
    };
    return legal.reduce((a, b) => leadPriority(a) < leadPriority(b) ? a : b);
  }

  // Определяем текущего победителя взятки
  let currentWinner = trick[0][0];
  let currentCard = trick[0][1];
  for (let i = 1; i < trick.length; i++) {
    if (cardBeats(trick[i][1], currentCard, leadSuit, trump)) {
      currentWinner = trick[i][0];
      currentCard = trick[i][1];
    }
  }

  const iAmBidder = player === bidder;
  const isPartner = !iAmBidder && currentWinner !== player && currentWinner !== bidder;

  const trickPoints = trick.reduce((sum, [, c]) => sum + VALUE[c[0]], 0) + VALUE[currentCard[0]];
  const beating = legal.filter(c => cardBeats(c, currentCard, leadSuit, trump));

  if (isPartner) {
    return legal.reduce((a, b) => (VALUE[a[0]] * 10 + RANK_VALUE[a[0]]) < (VALUE[b[0]] * 10 + RANK_VALUE[b[0]]) ? a : b);
  }

  const want = iAmBidder
    ? (trickPoints >= 5)
    : (trickPoints >= 10);

  if (beating.length > 0 && want) {
    const beatCost = (card: Card) => {
      const [rank, suit] = card;
      let cost = RANK_VALUE[rank] * 10;
      if (trump !== null && suit === trump) cost += 150;
      return cost;
    };
    return beating.reduce((a, b) => beatCost(a) < beatCost(b) ? a : b);
  }

  // Сброс - минимальная ценность
  const discardPriority = (card: Card) => {
    const [rank, suit] = card;
    const isTrump = trump !== null && suit === trump;
    let score = VALUE[rank] * 10 + RANK_VALUE[rank];
    if (isTrump) score += 500;
    return score;
  };
  return legal.reduce((a, b) => discardPriority(a) < discardPriority(b) ? a : b);
}

// ============================================================
// Проверка марьяжа
// ============================================================
export function canAnnounceMarriage(hand: Card[], card: Card, trump: Suit | null, announcedMarriages: Set<Suit>): boolean {
  const [rank, suit] = card;
  if (rank !== "Q" && rank !== "K") return false;
  if (announcedMarriages.has(suit)) return false;
  const other: Rank = rank === "Q" ? "K" : "Q";
  return hand.some(c => c[0] === other && c[1] === suit);
}

export function hasAnyMarriage(hand: Card[], announcedMarriages: Set<Suit>): boolean {
  for (const s of SUITS) {
    if (announcedMarriages.has(s)) continue;
    if (hand.some(c => c[0] === "Q" && c[1] === s) && hand.some(c => c[0] === "K" && c[1] === s)) {
      return true;
    }
  }
  return false;
}
