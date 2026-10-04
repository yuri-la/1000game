--- src/App.tsx (原始)
export default function App() {
  return (
    <div/>
  );
}


+++ src/App.tsx (修改后)
import { useState, useCallback, useEffect, useRef } from "react";
import {
  GameState, Card, Suit, LogEntry,
  SUITS, VALUE, RANK_VALUE, MARRIAGE_VALUE, SUIT_COLOR,
  DROP_PENALTY_TO_OPPONENTS,
  createInitialState, startRound, cardText, roundedTo5, playerName,
  sortHand, bidLimitFor, evaluateHand, computerBid,
  computerDiscard, computerFinalContract, legalCards, cardBeats,
  computerChooseCard, canAnnounceMarriage,
} from "./game";

function log(text: string, type: LogEntry["type"]): LogEntry {
  return { text, type };
}

// ============================================================
// Компонент карты
// ============================================================
function CardComponent({
  card, onClick, disabled, selected, small, faceDown,
}: {
  card?: Card; onClick?: () => void; disabled?: boolean;
  selected?: boolean; small?: boolean; faceDown?: boolean;
}) {
  if (faceDown || !card) {
    return (
      <div className={`${small ? "w-10 h-14 text-xs" : "w-14 h-20 text-sm"} rounded-lg border-2 border-gray-600 bg-gradient-to-br from-blue-800 to-blue-950 flex items-center justify-center shadow-md`}>
        <span className="text-blue-300 font-bold">?</span>
      </div>
    );
  }
  const [rank, suit] = card;
  const color = SUIT_COLOR[suit];
  const bg = (suit === "♥" || suit === "♦") ? "bg-red-50" : "bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${small ? "w-10 h-14 text-xs" : "w-14 h-20 text-sm"}
        rounded-lg border-2 ${bg} flex flex-col items-center justify-center shadow-md
        transition-all duration-150 select-none
        ${selected ? "border-yellow-400 ring-2 ring-yellow-400 -translate-y-2" : "border-gray-300"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "hover:-translate-y-1 hover:shadow-lg cursor-pointer active:scale-95"}
      `}
    >
      <span className={`font-bold ${small ? "text-sm" : "text-lg"}`} style={{ color }}>{rank}</span>
      <span className={`${small ? "text-sm" : "text-xl"}`} style={{ color }}>{suit}</span>
    </button>
  );
}

// ============================================================
// Разрешение взятки
// ============================================================
function resolveTrick(s: GameState): GameState {
  let winner = s.trick[0][0];
  let wcard = s.trick[0][1];
  for (let i = 1; i < s.trick.length; i++) {
    if (cardBeats(s.trick[i][1], wcard, s.leadSuit, s.trump)) {
      winner = s.trick[i][0];
      wcard = s.trick[i][1];
    }
  }
  const pts = s.trick.reduce((sum, [, c]) => sum + VALUE[c[0]], 0);
  const newRoundPoints: [number, number, number] = [...s.roundPoints];
  newRoundPoints[winner] += pts;

  const newLog = [...s.log, log(`${playerName(winner)} взял взятку: ${pts} очков.`, "result")];

  const allEmpty = s.hands.every(h => h.length === 0);
  if (allEmpty) {
    return finishRound({
      ...s,
      roundPoints: newRoundPoints,
      lastTrickWinner: winner,
      currentPlayPlayer: winner,
      trick: [],
      leadSuit: null,
      log: newLog,
    });
  }

  return {
    ...s,
    roundPoints: newRoundPoints,
    lastTrickWinner: winner,
    currentPlayPlayer: winner,
    trick: [],
    leadSuit: null,
    log: newLog,
  };
}

// ============================================================
// Завершение раунда
// ============================================================
function finishRound(s: GameState): GameState {
  const newScores: [number, number, number] = [...s.scores];
  const newLog: LogEntry[] = [...s.log];

  for (let p = 0; p < 3; p++) {
    const total = s.roundPoints[p] + s.marriagePoints[p];
    if (p === s.bidder) {
      const rounded = roundedTo5(total);
      const contract = s.finalContract || s.highestBid;
      if (rounded >= contract) {
        newScores[p] += contract;
        newLog.push(log(`${playerName(p)} выполнил контракт (${rounded} ≥ ${contract}): +${contract}.`, "result"));
      } else {
        newScores[p] -= contract;
        newLog.push(log(`${playerName(p)} не выполнил контракт (${rounded} < ${contract}): −${contract}.`, "result"));
      }
    } else {
      newScores[p] += total;
      newLog.push(log(`${playerName(p)}: +${total}.`, "result"));
    }
  }

  for (let p = 0; p < 3; p++) {
    if (newScores[p] >= 1000) {
      return {
        ...s,
        scores: newScores,
        phase: "GAME_OVER",
        gameOver: true,
        winner: p,
        log: [...newLog, log(`🏆 ${playerName(p)} победил со счётом ${newScores[p]}!`, "system")],
      };
    }
  }

  return {
    ...s,
    scores: newScores,
    phase: "ROUND_END",
    log: newLog,
  };
}

// ============================================================
// Основной компонент
// ============================================================
export default function App() {
  const [state, setState] = useState<GameState>(() => {
    const s = createInitialState();
    return startRound(s);
  });
  const [marriageDialog, setMarriageDialog] = useState<{ card: Card; suit: Suit } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state.log]);

  // Обработка показа прикупа для компьютера
  useEffect(() => {
    if (state.phase !== "SHOW_KITTY") return;
    if (state.bidder === null || state.bidder === 0) return;

    const timer = setTimeout(() => {
      setState(prev => {
        const bidder = prev.bidder!;
        const hand = [...prev.hands[bidder], ...prev.kitty];
        const strength = evaluateHand(hand);
        const newLog: LogEntry[] = [...prev.log];
        const newScores: [number, number, number] = [...prev.scores];

        if (strength < prev.highestBid - 10) {
          const penalty = prev.highestBid;
          newScores[bidder] -= penalty;
          for (let p = 0; p < 3; p++) {
            if (p !== bidder) newScores[p] += DROP_PENALTY_TO_OPPONENTS;
          }
          newLog.push(log(`${playerName(bidder)} увидел прикуп и решил сбросить карты.`, "action"));
          newLog.push(log(`${playerName(bidder)}: −${penalty}, соперникам +${DROP_PENALTY_TO_OPPONENTS}.`, "result"));
          return { ...prev, scores: newScores, kittyRevealed: true, log: newLog, phase: "ROUND_END" as const };
        }

        newLog.push(log(`${playerName(bidder)} решил играть.`, "action"));
        const fullHand = sortHand([...prev.hands[bidder], ...prev.kitty]);
        const [c1, c2] = computerDiscard(fullHand);
        const remaining = fullHand.filter(c => c !== c1 && c !== c2);
        const newHands: [Card[], Card[], Card[]] = [
          [...prev.hands[0]], [...prev.hands[1]], [...prev.hands[2]]
        ];
        newHands[bidder] = sortHand(remaining);
        const other1 = bidder === 1 ? 2 : (bidder === 2 ? 1 : 0);
        const other2 = bidder === 1 ? 0 : (bidder === 2 ? 0 : 1);
        newHands[other1] = sortHand([...prev.hands[other1], c1]);
        newHands[other2] = sortHand([...prev.hands[other2], c2]);
        newLog.push(log(`${playerName(bidder)} отдал по карте соперникам.`, "action"));

        const fc = computerFinalContract(newHands[bidder], prev.highestBid);
        newLog.push(log(`${playerName(bidder)} объявил контракт: ${fc}.`, "action"));

        return {
          ...prev,
          hands: newHands,
          kitty: [],
          kittyRevealed: true,
          finalContract: fc,
          contract: fc,
          phase: "PLAYING" as const,
          currentPlayPlayer: bidder,
          trick: [],
          leadSuit: null,
          log: newLog,
        };
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [state.phase, state.bidder]);

  // Автоход компьютера в розыгрыше
  useEffect(() => {
    if (state.phase !== "PLAYING") return;
    if (state.currentPlayPlayer === 0) return;
    if (state.trick.length >= 3) return;

    const timer = setTimeout(() => {
      setState(prev => {
        const player = prev.currentPlayPlayer;
        const hand = prev.hands[player];
        const legal = legalCards(hand, prev.trick, prev.leadSuit, prev.trump);

        // Проверяем марьяж для компьютера
        if (prev.trick.length === 0 && prev.lastTrickWinner === player) {
          for (const s of SUITS) {
            if (prev.announcedMarriages[player].has(s)) continue;
            if (hand.some(c => c[0] === "Q" && c[1] === s) && hand.some(c => c[0] === "K" && c[1] === s)) {
              const marriageCard = legal.find(c => (c[0] === "Q" || c[0] === "K") && c[1] === s);
              if (marriageCard) {
                const makeTrump = prev.trump === null || MARRIAGE_VALUE[s] >= 60;
                const newTrump: Suit | null = makeTrump ? s : prev.trump;
                const newAnnounced: [Set<Suit>, Set<Suit>, Set<Suit>] = [
                  new Set(prev.announcedMarriages[0]),
                  new Set(prev.announcedMarriages[1]),
                  new Set(prev.announcedMarriages[2]),
                ];
                newAnnounced[player].add(s);
                const newMarriagePoints: [number, number, number] = [...prev.marriagePoints];
                newMarriagePoints[player] += MARRIAGE_VALUE[s];

                const newHands: [Card[], Card[], Card[]] = [
                  [...prev.hands[0]], [...prev.hands[1]], [...prev.hands[2]]
                ];
                newHands[player] = hand.filter(c => c !== marriageCard);
                const newTrick: [number, Card][] = [...prev.trick, [player, marriageCard]];
                const newLeadSuit: Suit | null = prev.trick.length === 0 ? marriageCard[1] : prev.leadSuit;
                const newPlayedCards = [...prev.playedCards, marriageCard];

                const newLog: LogEntry[] = [...prev.log,
                  log(`${playerName(player)} объявил марьяж ${s} (+${MARRIAGE_VALUE[s]}).${makeTrump ? ` ${s} — козырь.` : ` Козырь остаётся ${prev.trump}.`}`, "action"),
                  log(`${playerName(player)} сыграл ${cardText(marriageCard)}.`, "action"),
                ];

                if (newTrick.length >= 3) {
                  return resolveTrick({
                    ...prev,
                    hands: newHands,
                    trump: newTrump,
                    announcedMarriages: newAnnounced,
                    marriagePoints: newMarriagePoints,
                    trick: newTrick,
                    leadSuit: newLeadSuit,
                    playedCards: newPlayedCards,
                    log: newLog,
                  });
                }

                return {
                  ...prev,
                  hands: newHands,
                  trump: newTrump,
                  announcedMarriages: newAnnounced,
                  marriagePoints: newMarriagePoints,
                  trick: newTrick,
                  leadSuit: newLeadSuit,
                  playedCards: newPlayedCards,
                  currentPlayPlayer: (player + 1) % 3,
                  log: newLog,
                };
              }
            }
          }
        }

        const card = computerChooseCard(
          hand, prev.trick, prev.leadSuit, prev.trump,
          prev.bidder!, player, prev.announcedMarriages[player],
          prev.lastTrickWinner
        );

        const newHands: [Card[], Card[], Card[]] = [
          [...prev.hands[0]], [...prev.hands[1]], [...prev.hands[2]]
        ];
        newHands[player] = hand.filter(c => c !== card);
        const newTrick: [number, Card][] = [...prev.trick, [player, card]];
        const newLeadSuit: Suit | null = prev.trick.length === 0 ? card[1] : prev.leadSuit;
        const newPlayedCards = [...prev.playedCards, card];
        const newLog: LogEntry[] = [...prev.log, log(`${playerName(player)} сыграл ${cardText(card)}.`, "action")];

        if (newTrick.length >= 3) {
          return resolveTrick({
            ...prev,
            hands: newHands,
            trick: newTrick,
            leadSuit: newLeadSuit,
            playedCards: newPlayedCards,
            log: newLog,
          });
        }

        return {
          ...prev,
          hands: newHands,
          trick: newTrick,
          leadSuit: newLeadSuit,
          playedCards: newPlayedCards,
          currentPlayPlayer: (player + 1) % 3,
          log: newLog,
        };
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [state.phase, state.currentPlayPlayer, state.trick.length]);

  // ============================================================
  // Обработчики действий игрока
  // ============================================================
  const handlePlayerBid = useCallback((bid: number | null) => {
    setState(prev => {
      const newPassed: [boolean, boolean, boolean] = [...prev.passed];
      const newLog: LogEntry[] = [...prev.log];
      let newHighestBid = prev.highestBid;
      let newBidder = prev.bidder;

      if (bid === null) {
        newPassed[0] = true;
        newLog.push(log("Вы: пас.", "action"));
      } else {
        newHighestBid = bid;
        newBidder = 0;
        newLog.push(log(`Вы: ставка ${bid}.`, "action"));
      }

      const passCount = newPassed.filter(Boolean).length;
      if (passCount >= 2) {
        newLog.push(log(`Победитель торгов: ${playerName(newBidder!)}. Ставка: ${newHighestBid}.`, "result"));
        return {
          ...prev,
          passed: newPassed,
          highestBid: newHighestBid,
          bidder: newBidder,
          log: newLog,
          phase: "SHOW_KITTY" as const,
          kittyRevealed: false,
        };
      }

      let nextPlayer = (prev.currentBidPlayer + 1) % 3;
      while (newPassed[nextPlayer]) {
        nextPlayer = (nextPlayer + 1) % 3;
      }

      return {
        ...prev,
        passed: newPassed,
        highestBid: newHighestBid,
        bidder: newBidder,
        currentBidPlayer: nextPlayer,
        log: newLog,
      };
    });
  }, []);

  // Ход компьютера в торговле
  useEffect(() => {
    if (state.phase !== "BIDDING") return;
    if (state.currentBidPlayer === 0) return;
    if (state.passed[state.currentBidPlayer]) return;

    const timer = setTimeout(() => {
      setState(prev => {
        const player = prev.currentBidPlayer;
        const bid = computerBid(prev.hands[player], prev.highestBid);
        const newPassed: [boolean, boolean, boolean] = [...prev.passed];
        const newLog: LogEntry[] = [...prev.log];
        let newHighestBid = prev.highestBid;
        let newBidder = prev.bidder;

        if (bid === null) {
          newPassed[player] = true;
          newLog.push(log(`${playerName(player)}: пас.`, "action"));
        } else {
          newHighestBid = bid;
          newBidder = player;
          newLog.push(log(`${playerName(player)}: ставка ${bid}.`, "action"));
        }

        const passCount = newPassed.filter(Boolean).length;
        if (passCount >= 2) {
          newLog.push(log(`Победитель торгов: ${playerName(newBidder!)}. Ставка: ${newHighestBid}.`, "result"));
          return {
            ...prev,
            passed: newPassed,
            highestBid: newHighestBid,
            bidder: newBidder,
            log: newLog,
            phase: "SHOW_KITTY" as const,
            kittyRevealed: false,
          };
        }

        if (newPassed.every(Boolean)) {
          newLog.push(log("Все спасовали. Пересдача.", "system"));
          const newDealer = (prev.dealer + 1) % 3;
          return startRound({ ...prev, dealer: newDealer, scores: prev.scores });
        }

        let nextPlayer = (player + 1) % 3;
        while (newPassed[nextPlayer]) {
          nextPlayer = (nextPlayer + 1) % 3;
        }

        return {
          ...prev,
          passed: newPassed,
          highestBid: newHighestBid,
          bidder: newBidder,
          currentBidPlayer: nextPlayer,
          log: newLog,
        };
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [state.phase, state.currentBidPlayer, state.passed]);

  // Подтверждение показа прикупа
  const handleKittyContinue = useCallback(() => {
    setState(prev => {
      const bidder = prev.bidder!;
      const newLog: LogEntry[] = [...prev.log];

      if (bidder === 0) {
        const newHand = sortHand([...prev.hands[0], ...prev.kitty]);
        newLog.push(log("Прикуп добавлен к вашим картам.", "info"));
        newLog.push(log("Выберите карту для Компьютера 1.", "info"));
        return {
          ...prev,
          hands: [newHand, prev.hands[1], prev.hands[2]] as [Card[], Card[], Card[]],
          kitty: [],
          kittyRevealed: true,
          phase: "PLAYER_DISCARD_1" as const,
          discardForComp1: null,
          discardForComp2: null,
          log: newLog,
        };
      }
      return { ...prev, kittyRevealed: true };
    });
  }, []);

  // Выбор карты для отдачи Компьютеру 1
  const handleDiscardForComp1 = useCallback((card: Card) => {
    setState(prev => ({
      ...prev,
      discardForComp1: card,
      phase: "PLAYER_DISCARD_2" as const,
      log: [...prev.log,
        log(`Вы выбрали ${cardText(card)} для Компьютера 1.`, "action"),
        log("Теперь выберите карту для Компьютера 2.", "info"),
      ],
    }));
  }, []);

  // Выбор карты для отдачи Компьютеру 2
  const handleDiscardForComp2 = useCallback((card: Card) => {
    setState(prev => {
      const c1 = prev.discardForComp1!;
      const c2 = card;
      const newHand = prev.hands[0].filter(c => c !== c1 && c !== c2);
      const newHands: [Card[], Card[], Card[]] = [
        sortHand(newHand),
        sortHand([...prev.hands[1], c1]),
        sortHand([...prev.hands[2], c2]),
      ];
      return {
        ...prev,
        hands: newHands,
        discardForComp2: c2,
        phase: "FINAL_CONTRACT" as const,
        log: [...prev.log,
          log(`Вы выбрали ${cardText(c2)} для Компьютера 2.`, "action"),
          log("Карты розданы. Установите финальный контракт.", "info"),
        ],
      };
    });
  }, []);

  // Установка финального контракта игроком
  const handleFinalContract = useCallback((value: number) => {
    setState(prev => ({
      ...prev,
      finalContract: value,
      contract: value,
      phase: "PLAYING" as const,
      currentPlayPlayer: 0,
      trick: [],
      leadSuit: null,
      log: [...prev.log,
        log(`Вы объявили контракт: ${value}.`, "action"),
        log("Начинается розыгрыш!", "system"),
      ],
    }));
  }, []);

  // Игровая функция розыгрыша карты игроком
  const playCardFromPlayer = useCallback((prev: GameState, card: Card, marriageSuit: Suit | null, makeTrump: boolean): GameState => {
    const newTrump: Suit | null = marriageSuit && makeTrump ? marriageSuit : prev.trump;
    const newAnnounced: [Set<Suit>, Set<Suit>, Set<Suit>] = [
      new Set(prev.announcedMarriages[0]),
      new Set(prev.announcedMarriages[1]),
      new Set(prev.announcedMarriages[2]),
    ];
    const newMarriagePoints: [number, number, number] = [...prev.marriagePoints];
    if (marriageSuit) {
      newAnnounced[0].add(marriageSuit);
      newMarriagePoints[0] += MARRIAGE_VALUE[marriageSuit];
    }

    const newHands: [Card[], Card[], Card[]] = [
      prev.hands[0].filter(c => c !== card),
      [...prev.hands[1]],
      [...prev.hands[2]],
    ];
    const newTrick: [number, Card][] = [...prev.trick, [0, card]];
    const newLeadSuit: Suit | null = prev.trick.length === 0 ? card[1] : prev.leadSuit;
    const newPlayedCards = [...prev.playedCards, card];

    const newLog: LogEntry[] = [...prev.log];
    if (marriageSuit) {
      newLog.push(log(
        `Вы объявили марьяж ${marriageSuit} (+${MARRIAGE_VALUE[marriageSuit]}).${makeTrump ? ` ${marriageSuit} — козырь.` : ` Козырь остаётся ${prev.trump}.`}`,
        "action"
      ));
    }
    newLog.push(log(`Вы сыграли ${cardText(card)}.`, "action"));

    if (newTrick.length >= 3) {
      return resolveTrick({
        ...prev,
        hands: newHands,
        trump: newTrump,
        announcedMarriages: newAnnounced,
        marriagePoints: newMarriagePoints,
        trick: newTrick,
        leadSuit: newLeadSuit,
        playedCards: newPlayedCards,
        log: newLog,
      });
    }

    return {
      ...prev,
      hands: newHands,
      trump: newTrump,
      announcedMarriages: newAnnounced,
      marriagePoints: newMarriagePoints,
      trick: newTrick,
      leadSuit: newLeadSuit,
      playedCards: newPlayedCards,
      currentPlayPlayer: 1,
      log: newLog,
    };
  }, []);

  // Выбор карты для розыгрыша
  const handlePlayCard = useCallback((card: Card) => {
    setState(prev => {
      if (prev.trick.length === 0 && prev.lastTrickWinner === 0) {
        if (canAnnounceMarriage(prev.hands[0], card, prev.trump, prev.announcedMarriages[0])) {
          setMarriageDialog({ card, suit: card[1] });
          return prev;
        }
      }
      return playCardFromPlayer(prev, card, null, false);
    });
  }, [playCardFromPlayer]);

  // Обработка марьяжа
  const handleMarriage = useCallback((makeTrump: boolean) => {
    if (!marriageDialog) return;
    const { card, suit } = marriageDialog;
    setMarriageDialog(null);
    setState(prev => playCardFromPlayer(prev, card, suit, makeTrump));
  }, [marriageDialog, playCardFromPlayer]);

  const handleNoMarriage = useCallback(() => {
    if (!marriageDialog) return;
    const { card } = marriageDialog;
    setMarriageDialog(null);
    setState(prev => playCardFromPlayer(prev, card, null, false));
  }, [marriageDialog, playCardFromPlayer]);

  // Следующий раунд
  const handleNextRound = useCallback(() => {
    setState(prev => {
      const newDealer = (prev.dealer + 1) % 3;
      return startRound({ ...prev, dealer: newDealer });
    });
  }, []);

  // Новая игра
  const handleNewGame = useCallback(() => {
    const s = createInitialState();
    setState(startRound(s));
  }, []);

  // ============================================================
  // Рендер
  // ============================================================
  const renderBidding = () => {
    const nextBid = state.highestBid + 5;
    const limit = bidLimitFor(state.hands[0]);
    const canRaise = nextBid <= limit;
    const isMyTurn = state.currentBidPlayer === 0 && !state.passed[0];

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-lg font-bold text-yellow-300">
          Торговля. Текущая ставка: {state.highestBid}
        </div>
        <div className="text-sm text-gray-300">
          Ваш лимит: {limit} (основа 120 + марьяжи)
        </div>
        <div className="flex gap-3">
          {isMyTurn && (
            <>
              <button
                onClick={() => handlePlayerBid(nextBid)}
                disabled={!canRaise}
                className="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
              >
                Повысить до {nextBid}
              </button>
              <button
                onClick={() => handlePlayerBid(null)}
                className="px-6 py-3 bg-gray-500 hover:bg-gray-400 text-white font-bold rounded-lg transition-colors"
              >
                Пас
              </button>
            </>
          )}
          {!isMyTurn && (
            <div className="text-gray-400 italic animate-pulse">
              {playerName(state.currentBidPlayer)} думает...
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-wrap justify-center mt-4">
          {state.hands[0].map((card, i) => (
            <CardComponent key={i} card={card} disabled />
          ))}
        </div>
      </div>
    );
  };

  const renderShowKitty = () => {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-lg font-bold text-yellow-300">
          Прикуп (победитель: {playerName(state.bidder!)})
        </div>
        <div className="flex gap-3 p-4 bg-green-900/50 rounded-xl border-2 border-yellow-600">
          {state.kitty.map((card, i) => (
            <CardComponent key={i} card={card} />
          ))}
        </div>
        {state.bidder === 0 && (
          <button
            onClick={handleKittyContinue}
            className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-colors text-lg"
          >
            Продолжить
          </button>
        )}
        {state.bidder !== 0 && (
          <div className="text-gray-400 italic animate-pulse">
            {playerName(state.bidder!)} изучает прикуп...
          </div>
        )}
        <div className="flex gap-1 flex-wrap justify-center mt-4">
          {state.hands[0].map((card, i) => (
            <CardComponent key={i} card={card} disabled />
          ))}
        </div>
      </div>
    );
  };

  const renderDiscard1 = () => {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-lg font-bold text-yellow-300">
          Этап 1: Выберите карту для Компьютера 1
        </div>
        <div className="text-sm text-gray-300">
          Нажмите на карту, которую хотите отдать Компьютеру 1
        </div>
        <div className="flex gap-1 flex-wrap justify-center">
          {state.hands[0].map((card, i) => (
            <CardComponent
              key={i}
              card={card}
              onClick={() => handleDiscardForComp1(card)}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderDiscard2 = () => {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-lg font-bold text-yellow-300">
          Этап 2: Выберите карту для Компьютера 2
        </div>
        <div className="text-sm text-gray-300">
          Карта для Компьютера 1: {state.discardForComp1 ? cardText(state.discardForComp1) : "?"}
        </div>
        <div className="flex gap-1 flex-wrap justify-center">
          {state.hands[0].map((card, i) => {
            const isUsed = state.discardForComp1 !== null && card[0] === state.discardForComp1[0] && card[1] === state.discardForComp1[1];
            return (
              <CardComponent
                key={i}
                card={card}
                disabled={isUsed}
                selected={isUsed}
                onClick={() => !isUsed && handleDiscardForComp2(card)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderFinalContract = () => {
    const limit = bidLimitFor(state.hands[0]);
    const minContract = state.highestBid;
    const bids: number[] = [];
    for (let b = minContract; b <= limit; b += 5) {
      bids.push(b);
    }

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-lg font-bold text-yellow-300">
          Установка финального контракта
        </div>
        <div className="text-sm text-gray-300">
          Минимум: {minContract} | Ваш лимит: {limit}
        </div>
        <div className="flex gap-2 flex-wrap justify-center max-w-lg">
          {bids.map(b => (
            <button
              key={b}
              onClick={() => handleFinalContract(b)}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-colors"
            >
              {b}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap justify-center mt-4">
          {state.hands[0].map((card, i) => (
            <CardComponent key={i} card={card} disabled />
          ))}
        </div>
      </div>
    );
  };

  const renderPlaying = () => {
    const legal = state.currentPlayPlayer === 0
      ? legalCards(state.hands[0], state.trick, state.leadSuit, state.trump)
      : [];
    const isMyTurn = state.currentPlayPlayer === 0;

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-3 p-3 bg-green-900/30 rounded-lg min-h-[90px] items-center">
          {state.trick.length === 0 ? (
            <span className="text-gray-500 italic text-sm">Взятка пуста</span>
          ) : (
            state.trick.map(([player, card], i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-xs text-gray-400 mb-1">{playerName(player)}</span>
                <CardComponent card={card} disabled small />
              </div>
            ))
          )}
        </div>

        <div className="text-sm text-gray-300">
          {isMyTurn ? "Ваш ход. Выберите карту." : `${playerName(state.currentPlayPlayer)} думает...`}
        </div>

        <div className="flex gap-1 flex-wrap justify-center">
          {state.hands[0].map((card, i) => {
            const isLegal = legal.some(c => c[0] === card[0] && c[1] === card[1]);
            return (
              <CardComponent
                key={i}
                card={card}
                disabled={!isMyTurn || !isLegal}
                onClick={() => isMyTurn && isLegal && handlePlayCard(card)}
              />
            );
          })}
        </div>

        <div className="flex gap-8 mt-2">
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">{playerName(1)} ({state.hands[1].length})</div>
            <div className="flex gap-0.5">
              {state.hands[1].map((_, i) => (
                <CardComponent key={i} faceDown small />
              ))}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 mb-1">{playerName(2)} ({state.hands[2].length})</div>
            <div className="flex gap-0.5">
              {state.hands[2].map((_, i) => (
                <CardComponent key={i} faceDown small />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRoundEnd = () => {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-lg font-bold text-yellow-300">Раунд завершён</div>
        <div className="text-sm text-gray-300">Очки за раунд:</div>
        <div className="flex gap-4">
          {[0, 1, 2].map(p => (
            <div key={p} className="text-center bg-green-900/50 px-4 py-2 rounded-lg">
              <div className="text-xs text-gray-400">{playerName(p)}</div>
              <div className="text-lg font-bold text-white">
                +{state.roundPoints[p] + state.marriagePoints[p]}
              </div>
              {state.marriagePoints[p] > 0 && (
                <div className="text-xs text-yellow-400">марьяж: +{state.marriagePoints[p]}</div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={handleNextRound}
          className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-colors text-lg"
        >
          Следующий раунд
        </button>
      </div>
    );
  };

  const renderGameOver = () => {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-2xl font-bold text-yellow-300">🏆 Игра окончена!</div>
        <div className="text-xl text-white">
          {playerName(state.winner!)} победил со счётом {state.scores[state.winner!]}!
        </div>
        <button
          onClick={handleNewGame}
          className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-colors text-lg"
        >
          Новая игра
        </button>
      </div>
    );
  };

  const renderPhase = () => {
    switch (state.phase) {
      case "BIDDING": return renderBidding();
      case "SHOW_KITTY": return renderShowKitty();
      case "PLAYER_DISCARD_1": return renderDiscard1();
      case "PLAYER_DISCARD_2": return renderDiscard2();
      case "FINAL_CONTRACT": return renderFinalContract();
      case "PLAYING": return renderPlaying();
      case "ROUND_END": return renderRoundEnd();
      case "GAME_OVER": return renderGameOver();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-950 text-white flex flex-col">
      <header className="text-center py-3 bg-green-950/50 border-b border-green-700">
        <h1 className="text-3xl font-bold text-yellow-400">Тысяча</h1>
      </header>

      <div className="flex justify-center gap-4 py-3 bg-green-950/30">
        {[0, 1, 2].map(p => (
          <div
            key={p}
            className={`px-4 py-2 rounded-lg text-center ${state.bidder === p ? "bg-yellow-700/40 ring-1 ring-yellow-500" : "bg-green-800/40"}`}
          >
            <div className="text-xs text-gray-400">{playerName(p)}</div>
            <div className="text-xl font-bold text-yellow-300">{state.scores[p]}</div>
            {state.bidder === p && <div className="text-xs text-yellow-400">бидер</div>}
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-6 py-2 text-sm">
        {(state.contract || state.finalContract) && (
          <span className="text-gray-300">Контракт: <b className="text-white">{state.finalContract || state.contract}</b></span>
        )}
        <span className="text-gray-300">Ставка: <b className="text-white">{state.highestBid}</b></span>
        <span className="text-gray-300">Козырь: <b className="text-white">{state.trump || "нет"}</b></span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4">
        {renderPhase()}
      </div>

      {marriageDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-green-800 border-2 border-yellow-500 rounded-xl p-6 max-w-md">
            <h3 className="text-xl font-bold text-yellow-300 mb-4 text-center">
              Марьяж {marriageDialog.suit}!
            </h3>
            <p className="text-gray-300 text-center mb-4">
              Объявить марьяж (+{MARRIAGE_VALUE[marriageDialog.suit]})?
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => handleMarriage(true)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg"
              >
                {marriageDialog.suit} = козырь
              </button>
              {state.trump && state.trump !== marriageDialog.suit && (
                <button
                  onClick={() => handleMarriage(false)}
                  className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 text-white font-bold rounded-lg"
                >
                  Козырь {state.trump}
                </button>
              )}
              <button
                onClick={handleNoMarriage}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg"
              >
                Без объявления
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-green-950/70 border-t border-green-700 p-3">
        <div className="text-xs text-gray-400 mb-1 font-bold">Журнал:</div>
        <div
          ref={logRef}
          className="h-32 overflow-y-auto text-xs font-mono space-y-0.5 pr-2"
        >
          {state.log.map((entry, i) => (
            <div
              key={i}
              className={`${entry.type === "system" ? "text-yellow-400 font-bold" :
                  entry.type === "result" ? "text-green-300" :
                    entry.type === "action" ? "text-blue-300" :
                      "text-gray-300"
                }`}
            >
              {entry.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
