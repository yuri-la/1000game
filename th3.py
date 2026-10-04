import random
import tkinter as tk
from tkinter import messagebox


RANKS = ["9", "J", "Q", "K", "10", "A"]
SUITS = ["♠", "♣", "♦", "♥"]

VALUE = {"9": 0, "J": 2, "Q": 3, "K": 4, "10": 10, "A": 11}
RANK_VALUE = {"9": 0, "J": 1, "Q": 2, "K": 3, "10": 4, "A": 5}
MARRIAGE_VALUE = {"♠": 40, "♣": 60, "♦": 80, "♥": 100}
SUIT_COLOR = {"♥": "red", "♦": "red", "♣": "black", "♠": "black"}
SUIT_BG = {"♥": "#ffe0e0", "♦": "#ffe0e0", "♣": "#e0e0e0", "♠": "#e0e0e0"}

BASE_BID_LIMIT = 120
DROP_PENALTY_TO_OPPONENTS = 40


def make_deck():
    return [(rank, suit) for suit in SUITS for rank in RANKS]


def card_text(card):
    return card[0] + card[1]


def rounded_to_5(x):
    return int(round(x / 5.0) * 5)


class ThousandApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Тысяча")
        self.root.geometry("1040x800")
        self.root.configure(bg="#1e5b3a")

        self.status = tk.StringVar()
        self.info_var = tk.StringVar()

        header = tk.Frame(root, bg="#1e5b3a")
        header.pack(pady=4)
        tk.Label(header, text="Тысяча", font=("Arial", 26, "bold"),
                 fg="gold", bg="#1e5b3a").pack()

        # Панель счёта
        self.score_frame = tk.Frame(root, bg="#0f2e1d",
                                    relief="sunken", borderwidth=2)
        self.score_frame.pack(pady=4, fill="x", padx=20)
        self.score_labels = []
        for i in range(3):
            lbl = tk.Label(self.score_frame, text="", font=("Arial", 14, "bold"),
                           fg="#ffe680", bg="#0f2e1d", padx=18, pady=4)
            lbl.pack(side="left", expand=True)
            self.score_labels.append(lbl)

        tk.Label(root, textvariable=self.info_var, font=("Arial", 12, "bold"),
                 fg="#ffd700", bg="#1e5b3a").pack(pady=2)
        tk.Label(root, textvariable=self.status, font=("Arial", 13),
                 fg="white", bg="#1e5b3a", wraplength=1000).pack(pady=3)

        log_frame = tk.Frame(root, bg="#1e5b3a")
        log_frame.pack(pady=5)
        self.log_box = tk.Text(log_frame, width=120, height=10,
                               state="disabled", font=("Consolas", 10),
                               bg="#0f2e1d", fg="#d4ffd4",
                               relief="sunken", borderwidth=2)
        self.log_box.pack()

        self.cards_frame = tk.Frame(root, bg="#1e5b3a")
        self.cards_frame.pack(pady=8)

        self.buttons_frame = tk.Frame(root, bg="#1e5b3a")
        self.buttons_frame.pack(pady=8)

        self.buttons_frame2 = tk.Frame(root, bg="#1e5b3a")
        self.buttons_frame2.pack(pady=4)

        self.scores = [0, 0, 0]
        self.dealer = random.randint(0, 2)
        self.game_over = False
        self.bidder = None
        self.obligated = None
        self.highest_bid = None
        self.contract = None
        self.trump = None

        self.new_game()
        


    # ==================================================
    # Утилиты
    # ==================================================
    def player_name(self, player):
        return "Вы" if player == 0 else f"Компьютер {player}"

    def write_log(self, text):
        self.log_box.config(state="normal")
        self.log_box.insert("end", text + "\n")
        self.log_box.see("end")
        self.log_box.config(state="disabled")

    def clear_log(self):
        self.log_box.config(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.config(state="disabled")

    def clear_cards(self):
        for w in self.cards_frame.winfo_children():
            w.destroy()

    def clear_buttons(self):
        for w in self.buttons_frame.winfo_children():
            w.destroy()
        for w in self.buttons_frame2.winfo_children():
            w.destroy()

    def make_card_button(self, parent, card, command=None,
                         state="normal", width=6, height=2,
                         font_size=14, bg=None):
        rank, suit = card
        color = SUIT_COLOR[suit]
        if bg is None:
            bg = SUIT_BG[suit]
        return tk.Button(parent, text=f"{rank}\n{suit}",
                         font=("Arial", font_size, "bold"),
                         fg=color, bg=bg, activebackground="#fff7b0",
                         width=width, height=height, relief="raised",
                         borderwidth=2, state=state, command=command)

    def update_score(self):
        for i, lbl in enumerate(self.score_labels):
            role = " [бидер]" if self.bidder == i else ""
            lbl.config(text=f"{self.player_name(i)}: {self.scores[i]}{role}")

    def update_info(self):
        parts = []
        if self.contract:
            parts.append(f"Контракт: {self.contract}")
        if self.highest_bid:
            parts.append(f"Ставка: {self.highest_bid}")
        parts.append(f"Козырь: {self.trump if self.trump else 'нет'}")
        if self.bidder is not None:
            parts.append(f"Бидер: {self.player_name(self.bidder)}")
        self.info_var.set("     ".join(parts))

    def sort_hand(self, hand):
        hand.sort(key=lambda c: (SUITS.index(c[1]), RANK_VALUE[c[0]]))

    def reset_trick_state(self):
        self.trick = []
        self.lead_suit = None
        self.last_trick_winner = None

    # ==================================================
    # Новая игра / раунд
    # ==================================================
    def new_game(self):
        self.scores = [0, 0, 0]
        self.dealer = random.randint(0, 2)
        self.game_over = False
        self.update_score()
        self.start_round()

    def start_round(self):
        self.clear_log()
        self.clear_cards()
        self.clear_buttons()

        deck = make_deck()
        random.shuffle(deck)

        self.hands = [[], [], []]
        for _ in range(7):
            for p in range(3):
                self.hands[p].append(deck.pop())

        self.kitty = [deck.pop() for _ in range(3)]

        for h in self.hands:
            self.sort_hand(h)

        # FIX: обязанный = (сдающий + 1) % 3; он уже "сказал 100"
        self.obligated = (self.dealer + 1) % 3

        self.highest_bid = 100
        self.bidder = self.obligated
        self.contract = None
        self.passed = [False, False, False]

        # торговля начинается со следующего за обязанным
        self.current_player = (self.obligated + 1) % 3

        self.trump = None
        self.reset_trick_state()

        self.round_points = [0, 0, 0]
        self.marriage_points = [0, 0, 0]
        self.announced_marriages = [set(), set(), set()]

        self.played_cards = []
        self.remaining_in_suit = {s: 6 for s in SUITS}
        self.remaining_trumps = 0

        self.update_score()
        self.update_info()
        self.write_log(
            f"=== Новый раунд === Сдающий: {self.player_name(self.dealer)}. "
            f"{self.player_name(self.obligated)} сидит на сотне."
        )
        self.write_log("Начинается торговля.")
        self.bid_turn()

    # ==================================================
    # Торговля
    # ==================================================
    def marriage_bonus_for(self, player):
        best = 0
        for s in SUITS:
            if ("Q", s) in self.hands[player] and ("K", s) in self.hands[player]:
                best = max(best, MARRIAGE_VALUE[s])
        return best

    def bid_limit_for(self, player):
        return BASE_BID_LIMIT + self.marriage_bonus_for(player)

    def show_bidding_hand(self):
        self.clear_cards()
        for card in self.hands[0]:
            btn = self.make_card_button(self.cards_frame, card)
            btn.pack(side="left", padx=3)

    def bid_turn(self):
        if self.game_over:
            return

        # все три спасовали — пересдача
        if all(self.passed):
            self.write_log("Все спасовали. Пересдача.")
            self.dealer = (self.dealer + 1) % 3
            self.root.after(800, self.start_round)
            return

        # торги завершены: есть бидер и двое спасовали
        if sum(self.passed) >= 2:
            self.finish_bidding()
            return

        player = self.current_player

        if self.passed[player]:
            self.next_bid_turn()
            return

        if player == 0:
            self.status.set(
                f"Ваша очередь торговаться. Текущая ставка: {self.highest_bid}."
            )
            self.show_bidding_hand()
            self.show_bid_buttons()
        else:
            bid = self.computer_bid(player)
            if bid is None:
                self.passed[player] = True
                self.write_log(f"Компьютер {player}: пас.")
            else:
                self.highest_bid = bid
                self.bidder = player
                self.write_log(f"Компьютер {player}: ставка {bid}.")
            self.update_info()
            self.update_score()
            self.next_bid_turn()

    def show_bid_buttons(self):
        self.clear_buttons()

        next_bid = self.highest_bid + 5
        limit = self.bid_limit_for(0)
        raise_state = "normal" if next_bid <= limit else "disabled"

        tk.Button(self.buttons_frame, text=f"Повысить до {next_bid}",
                  width=22, font=("Arial", 11, "bold"), bg="#c9a227",
                  state=raise_state,
                  command=lambda: self.player_bid(next_bid)
                  ).pack(side="left", padx=5)

        # FIX: пас активен всегда
        tk.Button(self.buttons_frame, text="Пас", width=12,
                  font=("Arial", 11, "bold"), bg="#cccccc",
                  command=lambda: self.player_bid(None)
                  ).pack(side="left", padx=5)

    def player_bid(self, bid):
        self.clear_buttons()
        if bid is None:
            self.passed[0] = True
            self.write_log("Вы: пас.")
        else:
            self.highest_bid = bid
            self.bidder = 0
            self.write_log(f"Вы: ставка {bid}.")
        self.update_info()
        self.update_score()
        self.next_bid_turn()

    def next_bid_turn(self):
        self.current_player = (self.current_player + 1) % 3
        self.root.after(400, self.bid_turn)

    def evaluate_hand(self, player):
        hand = self.hands[player]
        expected = 0
        by_suit = {s: [] for s in SUITS}
        for r, s in hand:
            by_suit[s].append(r)
        for s, ranks in by_suit.items():
            n = len(ranks)
            if "A" in ranks:
                expected += 11
            if "10" in ranks:
                expected += 9 if n >= 3 else 6
            if "K" in ranks and n >= 3:
                expected += 4
            if "Q" in ranks and "K" in ranks:
                expected += MARRIAGE_VALUE[s] // 2
        return expected

    def computer_bid(self, player):
        strength = self.evaluate_hand(player)
        limit = self.bid_limit_for(player)

        if strength >= 80:
            target = limit
        elif strength >= 65:
            target = min(limit, 150)
        elif strength >= 50:
            target = min(limit, 130)
        elif strength >= 40:
            target = min(limit, 120)
        else:
            target = 0

        next_bid = self.highest_bid + 5
        if next_bid <= target and next_bid <= limit:
            return next_bid
        return None

    # ==================================================
    # Прикуп и снос
    # ==================================================
    def finish_bidding(self):
        self.contract = self.highest_bid
        self.write_log(
            f"Победитель торгов: {self.player_name(self.bidder)}. "
            f"Ставка: {self.highest_bid}."
        )
        self.update_info()
        self.update_score()

        if self.bidder == 0:
            self.show_kitty_player()
        else:
            self.hands[self.bidder].extend(self.kitty)
            self.kitty.clear()
            self.sort_hand(self.hands[self.bidder])
            self.computer_after_kitty(self.bidder)

    def show_kitty_player(self):
        self.hands[0].extend(self.kitty)
        self.kitty.clear()
        self.sort_hand(self.hands[0])
        self.update_score()

        self.status.set("Вы получили прикуп. Играть или сбросить карты?")
        self.clear_buttons()
        self.show_play_or_drop_buttons()

    def show_play_or_drop_buttons(self):
        self.clear_buttons()
        tk.Button(self.buttons_frame,
                  text="Играть (продолжить)",
                  width=22, font=("Arial", 11, "bold"), bg="#c9a227",
                  command=self.player_choose_play
                  ).pack(side="left", padx=5)
        tk.Button(self.buttons_frame,
                  text=f"Сбросить карты (−{self.highest_bid}, "
                       f"соперникам +{DROP_PENALTY_TO_OPPONENTS})",
                  width=40, font=("Arial", 11, "bold"), bg="#c0392b",
                  fg="white",
                  command=self.player_choose_drop
                  ).pack(side="left", padx=5)

    def player_choose_play(self):
        self.write_log("Вы решили играть.")
        self.show_snose_cards()

    def player_choose_drop(self):
        self.drop_cards(0)

    def show_snose_cards(self):
        self.clear_cards()
        self.clear_buttons()
        self.snose_selected = []
        self.status.set(
            "Выберите 2 карты для отдачи соперникам "
            "(первая — Компьютеру 1, вторая — Компьютеру 2)."
        )
        for i, card in enumerate(self.hands[0]):
            btn = self.make_card_button(
                self.cards_frame, card,
                command=lambda idx=i: self.select_snose(idx)
            )
            btn.pack(side="left", padx=3)
        self.update_snose_button()

    def update_snose_button(self):
        for w in self.buttons_frame.winfo_children():
            w.destroy()
        if len(self.snose_selected) == 2:
            tk.Button(self.buttons_frame,
                      text="Отдать выбранные карты",
                      width=30, font=("Arial", 11, "bold"), bg="#c9a227",
                      command=self.confirm_snose).pack()

    def select_snose(self, index):
        if index in self.snose_selected:
            self.snose_selected.remove(index)
        elif len(self.snose_selected) < 2:
            self.snose_selected.append(index)
        for i, w in enumerate(self.cards_frame.winfo_children()):
            if i in self.snose_selected:
                w.config(bg="#fff7b0", relief="sunken")
            else:
                card = self.hands[0][i]
                w.config(bg=SUIT_BG[card[1]], relief="raised")
        self.update_snose_button()

    def confirm_snose(self):
        if len(self.snose_selected) != 2:
            return
        idx1, idx2 = self.snose_selected
        card1 = self.hands[0][idx1]
        card2 = self.hands[0][idx2]
        for idx in sorted([idx1, idx2], reverse=True):
            del self.hands[0][idx]
        self.hands[1].append(card1)
        self.hands[2].append(card2)
        self.sort_hand(self.hands[1])
        self.sort_hand(self.hands[2])
        self.write_log("Вы отдали по одной карте соперникам.")
        self.snose_selected = []
        self.ask_final_contract_player()

    def ask_final_contract_player(self):
        self.clear_cards()
        self.clear_buttons()
        limit = self.bid_limit_for(0)
        self.status.set(
            f"Объявите окончательный контракт "
            f"(от {self.highest_bid} до {limit}, шаг 5)."
        )
        for value in range(self.highest_bid, limit + 1, 5):
            tk.Button(self.buttons_frame, text=str(value), width=6,
                      font=("Arial", 11, "bold"), bg="#c9a227",
                      command=lambda v=value: self.set_final_contract(0, v)
                      ).pack(side="left", padx=2)

    def set_final_contract(self, player, value):
        self.contract = value
        self.write_log(f"{self.player_name(player)} объявил контракт: {value}.")
        self.update_info()
        self.clear_buttons()
        self.start_play()

    def computer_after_kitty(self, player):
        expected = self.evaluate_hand(player)
        if expected < self.highest_bid - 10:
            self.write_log(f"Компьютер {player} решил сбросить карты.")
            self.drop_cards(player)
            return
        self.write_log(f"Компьютер {player} решил играть.")
        self.computer_snose(player)
        self.ask_final_contract_computer(player)

    def computer_snose(self, player):
        hand = self.hands[player]

        def usefulness(card):
            rank, suit = card
            score = VALUE[rank] * 10
            other = "K" if rank == "Q" else ("Q" if rank == "K" else None)
            if other and (other, suit) in hand:
                score += MARRIAGE_VALUE[suit]
            if rank == "A":
                score += 60
            elif rank == "10":
                score += 40
            n = sum(1 for _, s in hand if s == suit)
            if n <= 2:
                score -= 20
            return score

        ordered = sorted(hand, key=usefulness)
        to_give = ordered[:2]
        for c in to_give:
            hand.remove(c)
        self.hands[1].append(to_give[0])
        self.hands[2].append(to_give[1])
        self.sort_hand(self.hands[1])
        self.sort_hand(self.hands[2])
        self.write_log(f"Компьютер {player} отдал по карте соперникам.")

    def ask_final_contract_computer(self, player):
        limit = self.bid_limit_for(player)
        strength = self.evaluate_hand(player)
        target = max(self.highest_bid, min(limit, strength))
        target = ((target + 4) // 5) * 5
        if target < self.highest_bid:
            target = self.highest_bid
        if target > limit:
            target = limit
        self.set_final_contract(player, target)

    def drop_cards(self, player):
        penalty = self.highest_bid
        self.scores[player] -= penalty
        for p in range(3):
            if p != player:
                self.scores[p] += DROP_PENALTY_TO_OPPONENTS
        self.write_log(
            f"{self.player_name(player)} сбросил карты. "
            f"−{penalty}, соперникам +{DROP_PENALTY_TO_OPPONENTS}."
        )
        self.update_score()
        self.end_round_and_next()

    # ==================================================
    # Розыгрыш
    # ==================================================
    def start_play(self):
        self.clear_cards()
        self.clear_buttons()
        self.trump = None
        self.reset_trick_state()
        self.current_player = self.bidder
        self.update_info()
        self.status.set(f"Первый ход: {self.player_name(self.bidder)}")
        self.start_trick()

    def start_trick(self):
        if all(len(h) == 0 for h in self.hands):
            self.finish_round()
            return
        self.trick = []
        self.lead_suit = None
        self.play_turn()

    def legal_cards(self, player):
        hand = self.hands[player]
        if not self.trick:
            return hand[:]
        led = [c for c in hand if c[1] == self.lead_suit]
        if led:
            return led
        if self.trump is not None:
            tr = [c for c in hand if c[1] == self.trump]
            if tr:
                return tr
        return hand[:]

    def play_turn(self):
        player = self.current_player
        if player == 0:
            self.show_player_hand()
            self.status.set("Ваш ход. Выберите карту.")
        else:
            card = self.computer_choose_card(player)
            self.play_card(player, card)

    def show_player_hand(self):
        self.clear_cards()
        self.clear_buttons()
        legal = self.legal_cards(0)
        for card in self.hands[0]:
            is_legal = card in legal
            btn = self.make_card_button(
                self.cards_frame, card,
                state="normal" if is_legal else "disabled",
                command=lambda c=card: self.prepare_player_card(c)
            )
            btn.pack(side="left", padx=3)

    def prepare_player_card(self, card):
        if card not in self.legal_cards(0):
            return
        if not self.trick and self.last_trick_winner == 0:
            rank, suit = card
            other = "K" if rank == "Q" else ("Q" if rank == "K" else None)
            if (rank in ("Q", "K") and other and (other, suit) in self.hands[0]
                    and suit not in self.announced_marriages[0]):
                self.show_marriage_choice(card, suit)
                return
        self.play_card(0, card)

    def show_marriage_choice(self, card, suit):
        self.clear_buttons()
        amount = MARRIAGE_VALUE[suit]
        self.status.set(f"У вас марьяж {suit}. Объявить?")
        tk.Button(self.buttons_frame,
                  text=f"Сделать {suit} козырем (+{amount})",
                  width=32, font=("Arial", 11, "bold"), bg="#c9a227",
                  command=lambda: self.announce_marriage(card, suit, True)
                  ).pack(side="left", padx=4)
        if self.trump is not None and self.trump != suit:
            tk.Button(self.buttons_frame,
                      text=f"Оставить прежний козырь {self.trump} (+{amount})",
                      width=36, font=("Arial", 11, "bold"), bg="#c9a227",
                      command=lambda: self.announce_marriage(card, suit, False)
                      ).pack(side="left", padx=4)
        tk.Button(self.buttons_frame, text="Без объявления",
                  width=18, font=("Arial", 11, "bold"), bg="#cccccc",
                  command=lambda: self.play_card(0, card)
                  ).pack(side="left", padx=4)

    def announce_marriage(self, card, suit, make_trump):
        amount = MARRIAGE_VALUE[suit]
        if make_trump:
            self.trump = suit
        self.marriage_points[0] += amount
        self.announced_marriages[0].add(suit)
        self.write_log(
            f"Вы объявили марьяж {suit} (+{amount})."
            + (f" {suit} — козырь." if make_trump
               else f" Козырь остаётся {self.trump}.")
        )
        self.update_info()
        self.play_card(0, card)

    # ==================================================
    # ИИ: выбор карты
    # ==================================================
    def computer_choose_card(self, player):
        legal = self.legal_cards(player)
        hand = self.hands[player]

        if not self.trick and self.last_trick_winner == player:
            best, best_val = None, -1
            for s in SUITS:
                if s in self.announced_marriages[player]:
                    continue
                if ("Q", s) in hand and ("K", s) in hand:
                    if MARRIAGE_VALUE[s] > best_val:
                        best_val = MARRIAGE_VALUE[s]
                        best = s
            if best is not None:
                for c in legal:
                    if c[0] in ("Q", "K") and c[1] == best:
                        make_trump = (self.trump is None) or \
                            (MARRIAGE_VALUE[best] >= 60)
                        self.announce_marriage_computer(
                            player, c, best, make_trump)
                        return c

        if not self.trick:
            def lead_priority(card):
                rank, suit = card
                is_trump = (self.trump is not None and suit == self.trump)
                if rank == "A" and not is_trump and self.remaining_trumps == 0:
                    return -200
                if rank == "A" and not is_trump:
                    return -100
                if rank == "10" and not is_trump:
                    return -60
                if is_trump:
                    return 100 + RANK_VALUE[rank]
                return RANK_VALUE[rank]
            return min(legal, key=lead_priority)

        current_winner, current_card = self.trick[0]
        for p, c in self.trick[1:]:
            if self.card_beats(c, current_card):
                current_winner, current_card = p, c

        i_am_bidder = (player == self.bidder)
        # партнёр — второй защитник; для бидера партнёров нет
        is_partner = (not i_am_bidder
                      and current_winner != player
                      and current_winner != self.bidder)

        trick_points = sum(VALUE[r] for _, (r, _) in self.trick) \
            + VALUE[current_card[0]]
        beating = [c for c in legal if self.card_beats(c, current_card)]

        if is_partner:
            return min(legal, key=lambda c: VALUE[c[0]] * 10 + RANK_VALUE[c[0]])

        if i_am_bidder:
            want = (trick_points >= 5) or \
                   (self.round_points[player] < self.contract)
        else:
            want = trick_points >= 10

        if beating and want:
            def beat_cost(card):
                rank, suit = card
                cost = RANK_VALUE[rank] * 10
                if self.trump is not None and suit == self.trump:
                    cost += 150
                return cost
            return min(beating, key=beat_cost)

        def discard_priority(card):
            rank, suit = card
            is_trump = (self.trump is not None and suit == self.trump)
            score = VALUE[rank] * 10 + RANK_VALUE[rank]
            if is_trump:
                score += 500
            return score
        return min(legal, key=discard_priority)

    def announce_marriage_computer(self, player, card, suit, make_trump):
        amount = MARRIAGE_VALUE[suit]
        if make_trump:
            self.trump = suit
        self.marriage_points[player] += amount
        self.announced_marriages[player].add(suit)
        self.write_log(
            f"Компьютер {player} объявил марьяж {suit} (+{amount})."
            + (f" {suit} — козырь." if make_trump
               else f" Козырь остаётся {self.trump}.")
        )
        self.update_info()

    # ==================================================
    # Розыгрыш взятки
    # ==================================================
    def play_card(self, player, card):
        if card not in self.legal_cards(player):
            return
        self.clear_buttons()
        self.hands[player].remove(card)

        if not self.trick:
            self.lead_suit = card[1]

        self.trick.append((player, card))
        self.played_cards.append(card)
        self.remaining_in_suit[card[1]] -= 1
        if self.trump is not None and card[1] == self.trump:
            self.remaining_trumps = max(0, self.remaining_trumps - 1)

        self.write_log(f"{self.player_name(player)} сыграл {card_text(card)}.")

        if len(self.trick) < 3:
            self.current_player = (player + 1) % 3
            self.root.after(450, self.play_turn)
        else:
            self.resolve_trick()

    def card_beats(self, candidate, current):
        cs, cu = candidate[1], current[1]
        if self.trump is not None:
            if cs == self.trump:
                if cu != self.trump:
                    return True
                return RANK_VALUE[candidate[0]] > RANK_VALUE[current[0]]
            if cu == self.trump:
                return False
        if cs != self.lead_suit:
            return False
        if cu != self.lead_suit:
            return True
        return RANK_VALUE[candidate[0]] > RANK_VALUE[current[0]]

    def resolve_trick(self):
        winner, wcard = self.trick[0]
        for p, c in self.trick[1:]:
            if self.card_beats(c, wcard):
                winner, wcard = p, c
        pts = sum(VALUE[c[0]] for _, c in self.trick)
        self.round_points[winner] += pts
        self.write_log(
            f"{self.player_name(winner)} взял взятку: {pts} очков."
        )
        self.last_trick_winner = winner
        self.current_player = winner
        self.root.after(900, self.start_trick)

    # ==================================================
    # Подсчёт и завершение раунда
    # ==================================================
    def finish_round(self):
        self.clear_cards()
        self.clear_buttons()

        for p in range(3):
            total = self.round_points[p] + self.marriage_points[p]
            if p == self.bidder:
                rounded = rounded_to_5(total)
                if rounded >= self.contract:
                    self.scores[p] += self.contract
                    self.write_log(
                        f"{self.player_name(p)} выполнил контракт "
                        f"({rounded} ≥ {self.contract}): +{self.contract}."
                    )
                else:
                    self.scores[p] -= self.contract
                    self.write_log(
                        f"{self.player_name(p)} не выполнил контракт "
                        f"({rounded} < {self.contract}): −{self.contract}."
                    )
            else:
                self.scores[p] += total
                self.write_log(f"{self.player_name(p)}: +{total}.")

        self.update_score()
        self.end_round_and_next()

    def end_round_and_next(self):
        self.clear_buttons()
        # проверка победителя
        for p in range(3):
            if self.scores[p] >= 1000:
                self.game_over = True
                self.status.set(
                    f"{self.player_name(p)} победил со счётом "
                    f"{self.scores[p]}!"
                )
                messagebox.showinfo(
                    "Игра окончена",
                    f"{self.player_name(p)} победил со счётом "
                    f"{self.scores[p]}!"
                )
                tk.Button(self.buttons_frame, text="Новая игра",
                          width=20, font=("Arial", 11, "bold"), bg="#c9a227",
                          command=self.new_game).pack()
                return
        self.status.set("Раунд завершён. Нажмите «Следующий раунд».")
        tk.Button(self.buttons_frame, text="Следующий раунд",
                  width=20, font=("Arial", 11, "bold"), bg="#c9a227",
                  command=self.next_round).pack()

    def next_round(self):
        self.dealer = (self.dealer + 1) % 3
        self.start_round()


if __name__ == "__main__":
    root = tk.Tk()
    app = ThousandApp(root)
    root.mainloop()