/*:
 * @target MZ
 * @plugindesc Explore server-authoritative casino scenes.
 * @author AvianJay
 *
 * @command OpenCasinoGame
 * @text 開啟賭場遊戲
 * @desc 開啟指定的賭場遊戲。
 *
 * @arg game
 * @text 遊戲
 * @type select
 * @option 輪盤
 * @value roulette
 * @option 骰子
 * @value dice
 * @option 猜硬幣
 * @value coinflip
 * @option 刮刮樂
 * @value scratchcard
 * @option 彩票
 * @value lottery
 * @option 爬塔
 * @value tower
 * @option 拉霸
 * @value slots
 * @option 比大小
 * @value highlow
 * @option 21 點
 * @value blackjack
 * @default slots
 *
 * @help
 * The production client never generates casino outcomes. All wagers and
 * results are resolved by /api/explore/casino/*.
 */

(() => {
    "use strict";

    const PLUGIN_NAME = "ExploreCasino";
    const BET_MIN = 50;
    const BET_MAX = 2000;
    const GAME_NAMES = {
        roulette: "輪盤",
        dice: "骰子",
        coinflip: "猜硬幣",
        scratchcard: "刮刮樂",
        lottery: "彩票",
        tower: "爬塔",
        slots: "拉霸",
        highlow: "比大小",
        blackjack: "21 點",
    };

    let devBalance = 10000;
    let devRoundCounter = 0;
    const devRounds = new Map();

    function nextLotteryDrawAt() {
        const drawAt = new Date();
        drawAt.setUTCMinutes(0, 0, 0);
        drawAt.setUTCHours(drawAt.getUTCHours() + 1);
        return drawAt.toISOString();
    }

    function requestId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function bridge() {
        return window.DiscordExploreBridge;
    }

    function isDevMode() {
        const api = bridge();
        return Boolean(api && api.isDevMode && api.isDevMode());
    }

    function jsonRequest(path, method = "GET", body = null) {
        const api = bridge();
        if (!api || typeof api.request !== "function") {
            return Promise.reject(new Error("DiscordExplore 尚未初始化。"));
        }
        return api.request(path, {
            method,
            body: body == null ? undefined : JSON.stringify(body),
        });
    }

    const CasinoApi = {
        state() {
            return isDevMode() ? devState() : jsonRequest("/api/explore/casino/state");
        },
        play(game, bet, options, operationId = requestId()) {
            const payload = { request_id: operationId, game, bet, ...options };
            return isDevMode() ? devPlay(payload) : jsonRequest("/api/explore/casino/play", "POST", payload);
        },
        buyLottery(bet, number, operationId = requestId()) {
            const payload = { request_id: operationId, bet, number };
            return isDevMode() ? devLottery(payload) : jsonRequest("/api/explore/casino/lottery/tickets", "POST", payload);
        },
        startRound(game, bet, operationId = requestId()) {
            const payload = { request_id: operationId, game, bet };
            return isDevMode() ? devStartRound(payload) : jsonRequest("/api/explore/casino/rounds", "POST", payload);
        },
        actRound(roundId, action, options = {}, operationId = requestId()) {
            const payload = { request_id: operationId, action, ...options };
            return isDevMode()
                ? devActRound(roundId, payload)
                : jsonRequest(`/api/explore/casino/rounds/${encodeURIComponent(roundId)}/actions`, "POST", payload);
        },
    };

    function devState() {
        return Promise.resolve({
            success: true,
            balance: devBalance,
            currency_name: "測試全域幣",
            bet_min: BET_MIN,
            bet_max: BET_MAX,
            active_rounds: [...devRounds.values()].filter(round => round.status === "active"),
            lottery: { jackpot: 3200, draw_at: nextLotteryDrawAt(), my_tickets: {} },
        });
    }

    function devSettle(game, bet, result, multiplier) {
        const payout = Math.round(bet * multiplier * 100) / 100;
        devBalance = Math.max(0, devBalance - bet + payout);
        return Promise.resolve({
            success: true,
            game,
            bet,
            payout,
            profit: payout - bet,
            balance: devBalance,
            currency_name: "測試全域幣",
            result,
        });
    }

    function devPlay(payload) {
        if (devBalance < payload.bet) return Promise.reject(new Error("測試餘額不足。"));
        switch (payload.game) {
            case "roulette": {
                const won = payload.bet_type === "black"
                    || payload.bet_type === "odd"
                    || payload.bet_type === "low"
                    || (payload.bet_type === "number" && Number(payload.number) === 17);
                const multiplier = payload.bet_type === "number" ? 36 : 2;
                return devSettle("roulette", payload.bet, { result: 17, color: "black", won, multiplier }, won ? multiplier : 0);
            }
            case "dice":
                return devSettle("dice", payload.bet, { guess: payload.guess, result: 4, won: Number(payload.guess) === 4, multiplier: 5.7 }, Number(payload.guess) === 4 ? 5.7 : 0);
            case "coinflip":
                return devSettle("coinflip", payload.bet, { side: payload.side, result: "heads", won: payload.side === "heads", multiplier: 1.9 }, payload.side === "heads" ? 1.9 : 0);
            case "scratchcard":
                return devSettle("scratchcard", payload.bet, { prize_name: "小獎", grid: ["🍒", "🍋", "🔔", "🍒", "⭐", "💎", "7️⃣", "🍒", "🍋"], won: true, multiplier: 1.5 }, 1.5);
            default:
                return devSettle("slots", payload.bet, { reels: ["🍒", "🍒", "🔔"], prize_name: "一對", won: true, multiplier: 1.2 }, 1.2);
        }
    }

    function devLottery(payload) {
        if (devBalance < payload.bet) return Promise.reject(new Error("測試餘額不足。"));
        devBalance -= payload.bet;
        return Promise.resolve({
            success: true,
            game: "lottery",
            number: String(payload.number).padStart(2, "0"),
            bet: payload.bet,
            result: { number: String(payload.number).padStart(2, "0") },
            payout: 0,
            balance: devBalance,
            currency_name: "測試全域幣",
            lottery: { jackpot: 3200 + payload.bet, draw_at: nextLotteryDrawAt(), my_tickets: { [String(payload.number).padStart(2, "0")]: payload.bet } },
        });
    }

    function devStartRound(payload) {
        if (devBalance < payload.bet) return Promise.reject(new Error("測試餘額不足。"));
        devBalance -= payload.bet;
        const id = `dev-${++devRoundCounter}`;
        let round;
        if (payload.game === "tower") {
            round = { round_id: id, game: "tower", bet: payload.bet, status: "active", current_level: 1, safe_level: 0, picked: {}, multipliers: [1, 1.4, 1.8, 2.2, 2.6, 3] };
        } else if (payload.game === "highlow") {
            round = { round_id: id, game: "highlow", bet: payload.bet, status: "active", card: { rank: 7, rank_name: "7", suit: "♠" }, streak: 0, pot: payload.bet, probabilities: { high: 0.5, low: 0.5 } };
        } else {
            round = { round_id: id, game: "blackjack", bet: payload.bet, status: "active", player_hand: [["10", "♠"], ["7", "♥"]], player_total: 17, dealer_hand: [["9", "♣"]], dealer_hidden: 1, can_double: true };
        }
        devRounds.set(id, round);
        return Promise.resolve({ success: true, game: payload.game, bet: payload.bet, payout: 0, balance: devBalance, currency_name: "測試全域幣", result: null, round });
    }

    function devActRound(roundId, payload) {
        const round = devRounds.get(roundId);
        if (!round) return Promise.reject(new Error("找不到測試回合。"));
        if (round.game === "tower") {
            if (payload.action === "cashout") {
                const payout = round.bet * round.multipliers[round.safe_level];
                devBalance += payout;
                round.status = "settled";
                round.payout = payout;
                round.result = { outcome: "cashout", safe_level: round.safe_level, payout };
            } else if (Number(payload.tile) === 2) {
                round.status = "settled";
                round.result = { outcome: "cactus", level: round.current_level, tile: 2 };
            } else {
                round.safe_level = round.current_level;
                round.picked[String(round.current_level)] = Number(payload.tile);
                if (round.current_level >= 5) {
                    const payout = round.bet * round.multipliers[5];
                    devBalance += payout;
                    round.status = "settled";
                    round.payout = payout;
                    round.result = { outcome: "top", level: 5, tile: Number(payload.tile), payout };
                } else {
                    round.result = { outcome: "safe", level: round.current_level, tile: Number(payload.tile) };
                    round.current_level += 1;
                }
            }
        } else if (round.game === "highlow") {
            if (payload.action === "cashout") {
                devBalance += round.pot;
                round.status = "settled";
                round.payout = round.pot;
                round.result = { outcome: "cashout", payout: round.pot };
            } else {
                round.streak += 1;
                round.pot = Math.round(round.pot * 1.9);
                round.card = { rank: 10, rank_name: "10", suit: "♦" };
                round.result = { outcome: "win", guess: payload.guess, pot: round.pot };
            }
        } else {
            if (payload.action === "double") {
                if (devBalance < round.bet) return Promise.reject(new Error("測試全域幣不足。"));
                devBalance -= round.bet;
                round.bet *= 2;
                round.player_hand.push(["4", "♣"]);
                round.player_total = 21;
                round.status = "settled";
                round.payout = round.bet * 2;
                devBalance += round.payout;
                round.dealer_hand = [["9", "♠"], ["8", "♦"]];
                round.dealer_hidden = 0;
                round.result = { outcome: "win", payout: round.payout, player_total: 21, dealer_total: 17 };
            } else
            if (payload.action === "hit") {
                round.player_hand.push(["4", "♦"]);
                round.player_total = 21;
                round.status = "settled";
                round.payout = round.bet * 2;
                devBalance += round.payout;
                round.dealer_hand = [["9", "♣"], ["8", "♠"]];
                round.dealer_hidden = 0;
                round.result = { outcome: "win", payout: round.payout, player_total: 21, dealer_total: 17 };
            } else {
                round.status = "settled";
                round.dealer_hand = [["9", "♣"], ["9", "♠"]];
                round.dealer_hidden = 0;
                round.result = { outcome: "lose", payout: 0, player_total: 17, dealer_total: 18 };
            }
        }
        devRounds.set(roundId, round);
        return Promise.resolve({ success: true, game: round.game, bet: round.bet, payout: round.payout || 0, balance: devBalance, currency_name: "測試全域幣", result: round.result, round });
    }

    const CASINO_COLORS = {
        ink: "#17130f",
        night: "#211b16",
        wood: "#4b2718",
        woodLight: "#7a4324",
        brass: "#d6a84b",
        brassLight: "#f3d58b",
        felt: "#145c3f",
        feltDark: "#0b3928",
        red: "#a92d32",
        black: "#242326",
        ivory: "#f6edda",
        muted: "#c8bda7",
        win: "#7fd18b",
        lose: "#ef7777",
        blue: "#4e88bf",
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function easeOutCubic(value) {
        return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
    }

    function money(value) {
        return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    function playCasinoSe(name, volume = 85, pitch = 100) {
        AudioManager.playSe({ name, volume, pitch, pan: 0 });
    }

    function roundedPath(context, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        context.beginPath();
        context.moveTo(x + r, y);
        context.lineTo(x + width - r, y);
        context.quadraticCurveTo(x + width, y, x + width, y + r);
        context.lineTo(x + width, y + height - r);
        context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        context.lineTo(x + r, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - r);
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);
        context.closePath();
    }

    function fillRound(context, x, y, width, height, radius, fill, stroke = null, lineWidth = 1) {
        roundedPath(context, x, y, width, height, radius);
        context.fillStyle = fill;
        context.fill();
        if (stroke) {
            context.lineWidth = lineWidth;
            context.strokeStyle = stroke;
            context.stroke();
        }
    }

    function canvasText(context, text, x, y, width, size = 20, color = CASINO_COLORS.ivory, align = "center", weight = "bold") {
        context.save();
        context.font = `${weight} ${size}px GameFont`;
        context.fillStyle = color;
        context.textAlign = align;
        context.textBaseline = "middle";
        const drawX = align === "left" ? x : align === "right" ? x + width : x + width / 2;
        context.fillText(String(text ?? ""), drawX, y, width);
        context.restore();
    }

    function updateBitmap(bitmap) {
        if (bitmap && bitmap.baseTexture) bitmap.baseTexture.update();
    }

    function drawChip(context, x, y, radius, color, label = "") {
        context.save();
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
        context.lineWidth = Math.max(3, radius * 0.12);
        context.strokeStyle = CASINO_COLORS.ivory;
        context.setLineDash([radius * 0.35, radius * 0.22]);
        context.stroke();
        context.setLineDash([]);
        context.beginPath();
        context.arc(x, y, radius * 0.58, 0, Math.PI * 2);
        context.lineWidth = 2;
        context.strokeStyle = CASINO_COLORS.brassLight;
        context.stroke();
        if (label) canvasText(context, label, x - radius, y, radius * 2, Math.max(12, radius * 0.52));
        context.restore();
    }

    function suitColor(suit) {
        return suit === "♥" || suit === "♦" ? CASINO_COLORS.red : CASINO_COLORS.black;
    }

    function cardRankLabel(rank) {
        const value = Number(rank);
        if (value === 1) return "A";
        if (value === 11) return "J";
        if (value === 12) return "Q";
        if (value === 13) return "K";
        return String(rank ?? "?");
    }

    function drawCard(context, x, y, width, height, card, hidden = false, angle = 0, alpha = 1) {
        context.save();
        context.globalAlpha = alpha;
        context.translate(x + width / 2, y + height / 2);
        context.rotate(angle);
        context.shadowColor = "rgba(0,0,0,0.42)";
        context.shadowBlur = 8;
        context.shadowOffsetY = 5;
        fillRound(context, -width / 2, -height / 2, width, height, 8, hidden ? CASINO_COLORS.red : CASINO_COLORS.ivory, CASINO_COLORS.brassLight, 2);
        context.shadowColor = "transparent";
        if (hidden) {
            context.save();
            roundedPath(context, -width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 7);
            context.clip();
            context.strokeStyle = CASINO_COLORS.brassLight;
            context.lineWidth = 2;
            for (let offset = -height; offset < width + height; offset += 12) {
                context.beginPath();
                context.moveTo(-width / 2, offset - width / 2);
                context.lineTo(width / 2, offset + width / 2);
                context.stroke();
            }
            fillRound(context, -width * 0.34, -height * 0.37, width * 0.68, height * 0.74, 5, "rgba(65,15,18,0.82)", CASINO_COLORS.brassLight, 1);
            context.restore();
        } else {
            const rank = card?.[0] || "?";
            const suit = card?.[1] || "";
            const color = suitColor(suit);
            canvasText(context, rank, -width * 0.42, -height * 0.36, width * 0.3, Math.max(16, width * 0.24), color, "left");
            canvasText(context, suit, -width * 0.42, -height * 0.17, width * 0.3, Math.max(16, width * 0.23), color, "left");
            canvasText(context, suit, -width * 0.35, height * 0.08, width * 0.7, Math.max(28, width * 0.52), color);
        }
        context.restore();
    }

    function drawDie(context, x, y, size, value, angle = 0, alpha = 1) {
        context.save();
        context.globalAlpha = alpha;
        context.translate(x + size / 2, y + size / 2);
        context.rotate(angle);
        context.shadowColor = "rgba(0,0,0,0.4)";
        context.shadowBlur = 8;
        context.shadowOffsetY = 5;
        fillRound(context, -size / 2, -size / 2, size, size, size * 0.16, CASINO_COLORS.ivory, CASINO_COLORS.brassLight, 2);
        context.shadowColor = "transparent";
        const spots = {
            1: [[0, 0]],
            2: [[-1, -1], [1, 1]],
            3: [[-1, -1], [0, 0], [1, 1]],
            4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
            5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
            6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
        };
        const step = size * 0.27;
        for (const [px, py] of spots[Number(value) || 1]) {
            context.beginPath();
            context.arc(px * step, py * step, size * 0.07, 0, Math.PI * 2);
            context.fillStyle = CASINO_COLORS.black;
            context.fill();
        }
        context.restore();
    }

    function drawCactus(context, centerX, centerY, size, alpha = 1) {
        context.save();
        context.globalAlpha = alpha;
        context.strokeStyle = "#86c96f";
        context.lineWidth = Math.max(5, size * 0.18);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(centerX, centerY + size * 0.34);
        context.lineTo(centerX, centerY - size * 0.34);
        context.moveTo(centerX, centerY - size * 0.02);
        context.lineTo(centerX - size * 0.28, centerY - size * 0.16);
        context.lineTo(centerX - size * 0.28, centerY - size * 0.3);
        context.moveTo(centerX, centerY + size * 0.08);
        context.lineTo(centerX + size * 0.28, centerY - size * 0.02);
        context.lineTo(centerX + size * 0.28, centerY - size * 0.18);
        context.stroke();
        context.restore();
    }

    function outcomeLabel(outcome) {
        return ({
            win: "勝利",
            lose: "落敗",
            push: "平手",
            cashout: "已提現",
            cap_cashout: "達上限，自動提現",
            player_bust: "玩家爆牌",
            dealer_bust: "莊家爆牌",
            blackjack: "Blackjack",
            dealer_blackjack: "莊家 Blackjack",
            cactus: "踩到仙人掌",
            safe: "安全",
            top: "登頂",
        })[outcome] || String(outcome || "");
    }

    function drawSlotSymbol(context, symbol, x, y, size, alpha = 1) {
        context.save();
        context.globalAlpha = alpha;
        const cx = x + size / 2;
        const cy = y + size / 2;
        if (symbol === "🍒") {
            context.fillStyle = "#bd343b";
            context.beginPath(); context.arc(cx - size * 0.16, cy + size * 0.1, size * 0.18, 0, Math.PI * 2); context.fill();
            context.beginPath(); context.arc(cx + size * 0.16, cy + size * 0.1, size * 0.18, 0, Math.PI * 2); context.fill();
            context.strokeStyle = "#4d8a48"; context.lineWidth = 4;
            context.beginPath(); context.moveTo(cx - size * 0.1, cy - size * 0.02); context.quadraticCurveTo(cx, cy - size * 0.35, cx + size * 0.18, cy - size * 0.23); context.stroke();
        } else if (symbol === "🍋") {
            context.fillStyle = "#f2cf45";
            context.beginPath(); context.ellipse(cx, cy, size * 0.3, size * 0.2, -0.2, 0, Math.PI * 2); context.fill();
        } else if (symbol === "🍇") {
            context.fillStyle = "#70489d";
            for (const [ox, oy] of [[0,-.18],[-.16,0],[.16,0],[-.09,.18],[.09,.18],[0,.35]]) {
                context.beginPath(); context.arc(cx + size * ox, cy + size * oy, size * 0.13, 0, Math.PI * 2); context.fill();
            }
        } else if (symbol === "🔔") {
            context.fillStyle = CASINO_COLORS.brass;
            context.beginPath(); context.moveTo(cx - size * 0.28, cy + size * 0.2); context.quadraticCurveTo(cx - size * 0.2, cy - size * 0.28, cx, cy - size * 0.32); context.quadraticCurveTo(cx + size * 0.2, cy - size * 0.28, cx + size * 0.28, cy + size * 0.2); context.closePath(); context.fill();
            context.beginPath(); context.arc(cx, cy + size * 0.27, size * 0.07, 0, Math.PI * 2); context.fill();
        } else {
            canvasText(context, "7", x, cy, size, size * 0.72, CASINO_COLORS.red);
        }
        context.restore();
    }

    class Sprite_CasinoButton extends Sprite_Clickable {
        constructor(width, height, label, callback, options = {}) {
            super();
            this.bitmap = new Bitmap(width, height);
            this._buttonWidth = width;
            this._buttonHeight = height;
            this._label = label;
            this._callback = callback;
            this._options = options;
            this._enabled = options.enabled !== false;
            this._focused = false;
            this._selected = Boolean(options.selected);
            this.redraw();
        }

        setEnabled(enabled) {
            const next = Boolean(enabled);
            if (next !== this._enabled) {
                this._enabled = next;
                this.redraw();
            }
        }

        setFocused(focused) {
            const next = Boolean(focused);
            if (next !== this._focused) {
                this._focused = next;
                this.redraw();
            }
        }

        setSelected(selected) {
            const next = Boolean(selected);
            if (next !== this._selected) {
                this._selected = next;
                this.redraw();
            }
        }

        isClickEnabled() {
            return this._enabled;
        }

        onClick() {
            if (this._enabled && this._callback) this._callback();
        }

        redraw() {
            const bitmap = this.bitmap;
            bitmap.clear();
            const context = bitmap.context;
            const accent = this._options.accent || CASINO_COLORS.brass;
            const fill = this._selected ? accent : (this._options.fill || CASINO_COLORS.wood);
            const border = this._focused ? CASINO_COLORS.ivory : (this._selected ? CASINO_COLORS.brassLight : CASINO_COLORS.brass);
            context.save();
            context.globalAlpha = this._enabled ? 1 : 0.42;
            fillRound(context, 2, 2, this._buttonWidth - 4, this._buttonHeight - 4, Math.min(8, this._buttonHeight * 0.18), fill, border, this._focused ? 4 : 2);
            if (this._options.swatch) {
                context.beginPath();
                context.arc(18, this._buttonHeight / 2, 8, 0, Math.PI * 2);
                context.fillStyle = this._options.swatch;
                context.fill();
                context.strokeStyle = CASINO_COLORS.ivory;
                context.lineWidth = 1;
                context.stroke();
            }
            const leftPad = this._options.swatch ? 30 : 4;
            canvasText(context, this._label, leftPad, this._buttonHeight / 2, this._buttonWidth - leftPad - 4, this._options.fontSize || 18, this._selected ? CASINO_COLORS.ink : CASINO_COLORS.ivory);
            context.restore();
            updateBitmap(bitmap);
        }
    }

    class CasinoRenderer {
        constructor(scene) {
            this.scene = scene;
            this.sprite = new Sprite();
            this.rect = new Rectangle(0, 0, 1, 1);
            this._animation = null;
        }

        attach(parent) {
            parent.addChild(this.sprite);
        }

        layout(rect) {
            this.rect = rect;
            this.sprite.x = rect.x;
            this.sprite.y = rect.y;
            if (this.sprite.bitmap) this.sprite.bitmap.destroy();
            this.sprite.bitmap = new Bitmap(Math.max(1, rect.width), Math.max(1, rect.height));
            this.render();
        }

        context() {
            return this.sprite.bitmap.context;
        }

        beginTable(title = "") {
            const bitmap = this.sprite.bitmap;
            bitmap.clear();
            const context = bitmap.context;
            fillRound(context, 0, 0, this.rect.width, this.rect.height, 8, CASINO_COLORS.wood, CASINO_COLORS.brass, 3);
            fillRound(context, 10, 10, this.rect.width - 20, this.rect.height - 20, 6, CASINO_COLORS.felt, CASINO_COLORS.feltDark, 3);
            context.save();
            context.globalAlpha = 0.08;
            context.strokeStyle = CASINO_COLORS.ivory;
            context.lineWidth = 1;
            for (let x = 22; x < this.rect.width; x += 34) {
                context.beginPath(); context.moveTo(x, 14); context.lineTo(x - 70, this.rect.height - 14); context.stroke();
            }
            context.restore();
            if (title) canvasText(context, title, 18, 30, this.rect.width - 36, 22, CASINO_COLORS.brassLight);
            return context;
        }

        finish() {
            updateBitmap(this.sprite.bitmap);
        }

        animate(kind, response, duration = 54) {
            if (this._animation?.resolve) this._animation.resolve();
            return new Promise(resolve => {
                this._animation = { kind, response, frame: 0, duration, resolve };
                this.render();
            });
        }

        animationProgress() {
            if (!this._animation) return 1;
            return clamp(this._animation.frame / this._animation.duration, 0, 1);
        }

        isAnimating() {
            return Boolean(this._animation);
        }

        skipAnimation() {
            if (this._animation) this._animation.frame = this._animation.duration;
        }

        update() {
            if (!this._animation) return;
            this._animation.frame += 1;
            this.render();
            if (this._animation.frame >= this._animation.duration) {
                const resolve = this._animation.resolve;
                this._animation = null;
                this.render();
                resolve();
            }
        }

        response() {
            return this._animation?.response || this.scene._lastResponse || null;
        }

        render() {
            const context = this.beginTable(GAME_NAMES[this.scene._game]);
            canvasText(context, "準備下注", 20, this.rect.height / 2, this.rect.width - 40, 28, CASINO_COLORS.ivory);
            this.finish();
        }

        playResponse(response) {
            return this.animate("result", response, 48);
        }

        onStageTap() {
            return false;
        }

        onStageDrag() {
            return false;
        }
    }

    class RouletteRenderer extends CasinoRenderer {
        render() {
            const context = this.beginTable("輪盤賭桌");
            const w = this.rect.width;
            const h = this.rect.height;
            const compact = w < 620;
            const radius = Math.min(h * 0.33, compact ? w * 0.25 : w * 0.22);
            const cx = compact ? w * 0.5 : w * 0.3;
            const cy = compact ? h * 0.4 : h * 0.53;
            const sequence = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
            this._betZones = [];
            context.save();
            context.translate(cx, cy);
            context.beginPath(); context.arc(0, 0, radius + 18, 0, Math.PI * 2); context.fillStyle = CASINO_COLORS.woodLight; context.fill();
            context.lineWidth = 5; context.strokeStyle = CASINO_COLORS.brass; context.stroke();
            for (let index = 0; index < sequence.length; index++) {
                const start = -Math.PI / 2 + index * Math.PI * 2 / sequence.length;
                const end = -Math.PI / 2 + (index + 1) * Math.PI * 2 / sequence.length;
                context.beginPath();
                context.moveTo(0, 0);
                context.arc(0, 0, radius, start, end);
                context.closePath();
                context.fillStyle = index === 0 ? CASINO_COLORS.felt : (index % 2 ? CASINO_COLORS.red : CASINO_COLORS.black);
                context.fill();
                context.strokeStyle = CASINO_COLORS.brassLight;
                context.lineWidth = 1;
                context.stroke();
                const middle = (start + end) / 2;
                const labelRadius = radius * 0.87;
                canvasText(
                    context,
                    sequence[index],
                    Math.cos(middle) * labelRadius - 10,
                    Math.sin(middle) * labelRadius,
                    20,
                    Math.max(8, radius * 0.075),
                    CASINO_COLORS.ivory
                );
            }
            context.beginPath(); context.arc(0, 0, radius * 0.58, 0, Math.PI * 2); context.fillStyle = CASINO_COLORS.wood; context.fill();
            context.lineWidth = 4; context.strokeStyle = CASINO_COLORS.brass; context.stroke();
            drawChip(context, 0, 0, radius * 0.23, CASINO_COLORS.red, "R");
            const response = this.response();
            const target = Number(response?.result?.result ?? this.scene._lastResponse?.result?.result);
            let ballAngle = -Math.PI / 2;
            if (Number.isFinite(target)) {
                const index = Math.max(0, sequence.indexOf(target));
                const finalAngle = -Math.PI / 2 + (index + 0.5) * Math.PI * 2 / sequence.length;
                if (this._animation) {
                    const p = easeOutCubic(this.animationProgress());
                    ballAngle = -Math.PI / 2 - (1 - p) * Math.PI * 10 + p * finalAngle;
                } else {
                    ballAngle = finalAngle;
                }
            } else if (this._animation) {
                ballAngle = -Math.PI / 2 - this.animationProgress() * Math.PI * 8;
            }
            context.beginPath();
            context.arc(Math.cos(ballAngle) * radius * 0.83, Math.sin(ballAngle) * radius * 0.83, Math.max(5, radius * 0.055), 0, Math.PI * 2);
            context.fillStyle = CASINO_COLORS.ivory;
            context.shadowColor = "rgba(0,0,0,0.5)";
            context.shadowBlur = 5;
            context.fill();
            context.restore();

            const boardX = compact ? 22 : w * 0.57;
            const boardY = compact ? h * 0.7 : h * 0.22;
            const boardW = compact ? w - 44 : w * 0.37;
            const boardH = compact ? Math.min(h * 0.24, 96) : h * 0.62;
            fillRound(context, boardX, boardY, boardW, boardH, 6, "rgba(8,45,31,0.82)", CASINO_COLORS.brass, 2);
            const labels = [
                ["紅", CASINO_COLORS.red, { bet_type: "red" }],
                ["黑", CASINO_COLORS.black, { bet_type: "black" }],
                ["單", CASINO_COLORS.woodLight, { bet_type: "odd" }],
                ["雙", CASINO_COLORS.woodLight, { bet_type: "even" }],
                ["1–18", CASINO_COLORS.blue, { bet_type: "low" }],
                ["19–36", CASINO_COLORS.blue, { bet_type: "high" }],
                ["單號", CASINO_COLORS.woodLight, { mode: "number" }],
                ["0", CASINO_COLORS.feltDark, { bet_type: "number", number: 0 }],
            ];
            const cols = 4;
            const cellW = boardW / cols;
            const cellH = boardH / 2;
            labels.forEach(([label, color, action], index) => {
                const x = boardX + (index % cols) * cellW;
                const y = boardY + Math.floor(index / cols) * cellH;
                fillRound(context, x + 4, y + 4, cellW - 8, cellH - 8, 4, color, CASINO_COLORS.brassLight, 1);
                canvasText(context, label, x + 4, y + cellH / 2, cellW - 8, compact ? 15 : 18);
                this._betZones.push({ x: x + 4, y: y + 4, width: cellW - 8, height: cellH - 8, action });
            });
            if (Number.isFinite(target)) {
                const color = response?.result?.color || "";
                canvasText(context, `開出 ${target}  ${color === "red" ? "紅" : color === "black" ? "黑" : "綠"}`, 20, h - 25, w - 40, 22, response?.result?.won ? CASINO_COLORS.win : CASINO_COLORS.lose);
            }
            this.finish();
        }

        onStageTap(x, y) {
            if (this.scene._busy || !["bet", "rouletteChoice"].includes(this.scene._mode)) return false;
            const zone = this._betZones.find(item => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
            if (!zone) return false;
            if (zone.action.mode === "number") this.scene.openRouletteNumber();
            else this.scene.playInstant(zone.action);
            return true;
        }

        playResponse(response) {
            playCasinoSe("Machine", 78, 108);
            return this.animate("spin", response, 72).then(() => playCasinoSe(response.result?.won ? "Applause1" : "Disappointment", 80));
        }
    }

    class DiceRenderer extends CasinoRenderer {
        render() {
            const context = this.beginTable("骰盅");
            const w = this.rect.width;
            const h = this.rect.height;
            const response = this.response();
            const target = Number(response?.result?.result || 1);
            const p = this.animationProgress();
            const rolling = Boolean(this._animation && p < 0.86);
            const mainValue = rolling ? (Math.floor(this._animation.frame / 4) % 6) + 1 : target;
            this._choiceZones = [];
            const dieSize = Math.min(112, w * 0.18, h * 0.32);
            const cupW = dieSize * 1.45;
            const cupH = dieSize * 1.2;
            const cupX = w / 2 - cupW / 2;
            const cupY = h * 0.16;
            context.save();
            context.fillStyle = CASINO_COLORS.woodLight;
            context.beginPath();
            context.moveTo(cupX + cupW * 0.12, cupY);
            context.lineTo(cupX + cupW * 0.88, cupY);
            context.lineTo(cupX + cupW, cupY + cupH);
            context.lineTo(cupX, cupY + cupH);
            context.closePath();
            context.fill();
            context.lineWidth = 4;
            context.strokeStyle = CASINO_COLORS.brass;
            context.stroke();
            for (let x = cupX + 16; x < cupX + cupW - 10; x += 20) {
                context.strokeStyle = "rgba(246,237,218,0.13)";
                context.beginPath(); context.moveTo(x, cupY + 8); context.lineTo(x + 18, cupY + cupH - 8); context.stroke();
            }
            context.restore();
            const bounce = rolling ? Math.sin(p * Math.PI * 12) * 18 : 0;
            const angle = rolling ? p * Math.PI * 7 : 0;
            drawDie(context, w / 2 - dieSize / 2, h * 0.53 - dieSize / 2 + bounce, dieSize, mainValue, angle);
            const choiceSize = Math.min(46, (w - 56) / 7, h * 0.16);
            const gap = Math.max(5, choiceSize * 0.2);
            const choicesWidth = choiceSize * 6 + gap * 5;
            const choiceY = h - choiceSize - 38;
            for (let value = 1; value <= 6; value++) {
                const choiceX = (w - choicesWidth) / 2 + (value - 1) * (choiceSize + gap);
                drawDie(context, choiceX, choiceY, choiceSize, value, 0, response ? 0.52 : 1);
                this._choiceZones.push({ x: choiceX, y: choiceY, width: choiceSize, height: choiceSize, value });
            }
            canvasText(context, response ? `你猜 ${response.result?.guess}　開出 ${target}` : `直接點選要猜的點數`, 20, h - 18, w - 40, 19, response?.result?.won ? CASINO_COLORS.win : CASINO_COLORS.ivory);
            this.finish();
        }

        onStageTap(x, y) {
            if (this.scene._busy || !["bet", "diceChoice"].includes(this.scene._mode)) return false;
            const zone = this._choiceZones.find(item => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
            if (!zone) return false;
            this.scene.playInstant({ guess: zone.value });
            return true;
        }

        playResponse(response) {
            playCasinoSe("Move2", 85, 110);
            return this.animate("roll", response, 52).then(() => playCasinoSe(response.result?.won ? "Bell2" : "Buzzer2", 80));
        }
    }

    class CoinRenderer extends CasinoRenderer {
        render() {
            const context = this.beginTable("正面或反面");
            const w = this.rect.width;
            const h = this.rect.height;
            const response = this.response();
            const p = this.animationProgress();
            const result = response?.result?.result || "heads";
            this._choiceZones = [];
            const flips = this._animation ? p * Math.PI * 12 : (result === "heads" ? 0 : Math.PI);
            const scaleX = Math.max(0.07, Math.abs(Math.cos(flips)));
            const coinR = Math.min(w * 0.18, h * 0.3, 118);
            const lift = this._animation ? Math.sin(Math.min(1, p * 1.15) * Math.PI) * h * 0.2 : 0;
            const cx = w / 2;
            const cy = h * 0.55 - lift;
            context.save();
            context.translate(cx, cy);
            context.scale(scaleX, 1);
            context.beginPath(); context.arc(0, 0, coinR, 0, Math.PI * 2); context.fillStyle = CASINO_COLORS.brass; context.fill();
            context.lineWidth = 8; context.strokeStyle = CASINO_COLORS.brassLight; context.stroke();
            context.beginPath(); context.arc(0, 0, coinR * 0.75, 0, Math.PI * 2); context.lineWidth = 3; context.strokeStyle = CASINO_COLORS.wood; context.stroke();
            const visibleSide = Math.cos(flips) >= 0 ? "正" : "反";
            canvasText(context, visibleSide, -coinR, 0, coinR * 2, coinR * 0.72, CASINO_COLORS.wood);
            context.restore();
            context.save();
            context.globalAlpha = 0.25;
            context.beginPath(); context.ellipse(cx, h * 0.82, coinR * 0.9, coinR * 0.18, 0, 0, Math.PI * 2); context.fillStyle = "#000"; context.fill();
            context.restore();
            if (!response || ["bet", "coinChoice"].includes(this.scene._mode)) {
                const optionRadius = Math.min(34, w * 0.07, h * 0.1);
                const optionY = h - optionRadius - 22;
                [[w * 0.3, "正面", "heads"], [w * 0.7, "反面", "tails"]].forEach(([optionX, label, side]) => {
                    context.beginPath();
                    context.arc(optionX, optionY, optionRadius, 0, Math.PI * 2);
                    context.fillStyle = side === "heads" ? CASINO_COLORS.brass : CASINO_COLORS.woodLight;
                    context.fill();
                    context.lineWidth = 3;
                    context.strokeStyle = CASINO_COLORS.brassLight;
                    context.stroke();
                    canvasText(context, label, optionX - optionRadius, optionY, optionRadius * 2, Math.max(14, optionRadius * 0.48), side === "heads" ? CASINO_COLORS.wood : CASINO_COLORS.ivory);
                    this._choiceZones.push({ x: optionX - optionRadius, y: optionY - optionRadius, width: optionRadius * 2, height: optionRadius * 2, side });
                });
            }
            if (response) canvasText(context, `結果：${result === "heads" ? "正面" : "反面"}`, 20, h - 28, w - 40, 22, response.result?.won ? CASINO_COLORS.win : CASINO_COLORS.lose);
            this.finish();
        }

        onStageTap(x, y) {
            if (this.scene._busy || !["bet", "coinChoice"].includes(this.scene._mode)) return false;
            const zone = this._choiceZones.find(item => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
            if (!zone) return false;
            this.scene.playInstant({ side: zone.side });
            return true;
        }

        playResponse(response) {
            playCasinoSe("Coin", 88, 120);
            return this.animate("flip", response, 58).then(() => playCasinoSe(response.result?.won ? "Bell1" : "Buzzer1", 75));
        }
    }

    class ScratchRenderer extends CasinoRenderer {
        constructor(scene) {
            super(scene);
            this._revealed = new Set();
            this._scratchResponse = null;
        }

        gridRect() {
            const w = this.rect.width;
            const h = this.rect.height;
            const size = Math.min(w * 0.72, h * 0.72);
            return { x: (w - size) / 2, y: (h - size) / 2 + 12, size };
        }

        render() {
            const context = this.beginTable("刮開九格");
            const w = this.rect.width;
            const h = this.rect.height;
            const response = this._scratchResponse || this.scene._lastResponse;
            const grid = response?.result?.grid || ["?","?","?","?","?","?","?","?","?"];
            const rect = this.gridRect();
            fillRound(context, rect.x - 12, rect.y - 12, rect.size + 24, rect.size + 24, 8, "#ead9b5", CASINO_COLORS.brass, 3);
            const cell = rect.size / 3;
            for (let index = 0; index < 9; index++) {
                const x = rect.x + (index % 3) * cell;
                const y = rect.y + Math.floor(index / 3) * cell;
                fillRound(context, x + 5, y + 5, cell - 10, cell - 10, 5, CASINO_COLORS.ivory, CASINO_COLORS.woodLight, 2);
                canvasText(context, grid[index], x + 5, y + cell / 2, cell - 10, Math.min(38, cell * 0.42), CASINO_COLORS.ink);
                if (response && !this._revealed.has(index)) {
                    fillRound(context, x + 5, y + 5, cell - 10, cell - 10, 5, "#9ca4a5", "#d9dfdf", 2);
                    context.save();
                    context.strokeStyle = "rgba(255,255,255,0.28)";
                    for (let line = -cell; line < cell * 2; line += 12) {
                        context.beginPath(); context.moveTo(x + 6, y + line); context.lineTo(x + cell - 6, y + line + cell); context.stroke();
                    }
                    context.restore();
                    canvasText(context, "刮", x + 5, y + cell / 2, cell - 10, Math.min(24, cell * 0.25), "#525b5d");
                }
            }
            if (!response) canvasText(context, "購買後用滑鼠或手指刮開", 20, h - 25, w - 40, 19, CASINO_COLORS.muted);
            else if (this._revealed.size >= 9) canvasText(context, `${response.result?.prize_name || "未中獎"}　派彩 ${money(response.payout)}`, 20, h - 25, w - 40, 20, Number(response.payout) > 0 ? CASINO_COLORS.win : CASINO_COLORS.lose);
            else canvasText(context, `已刮開 ${this._revealed.size}/9`, 20, h - 25, w - 40, 19, CASINO_COLORS.brassLight);
            this.finish();
        }

        playResponse(response) {
            this._scratchResponse = response;
            this._revealed.clear();
            playCasinoSe("Open3", 72, 115);
            this.render();
            return Promise.resolve();
        }

        revealAt(localX, localY) {
            if (!this._scratchResponse) return false;
            const rect = this.gridRect();
            if (localX < rect.x || localY < rect.y || localX >= rect.x + rect.size || localY >= rect.y + rect.size) return false;
            const col = Math.floor((localX - rect.x) / (rect.size / 3));
            const row = Math.floor((localY - rect.y) / (rect.size / 3));
            const index = row * 3 + col;
            if (!this._revealed.has(index)) {
                this._revealed.add(index);
                playCasinoSe("Cursor4", 45, 125);
                if (this._revealed.size >= 9) {
                    for (let i = 0; i < 9; i++) this._revealed.add(i);
                    playCasinoSe(Number(this._scratchResponse.payout) > 0 ? "Applause1" : "Disappointment", 75);
                }
                this.render();
                this.scene.refreshControls();
            }
            return true;
        }

        revealAll() {
            if (!this._scratchResponse) return;
            for (let index = 0; index < 9; index++) this._revealed.add(index);
            this.render();
            this.scene.refreshControls();
        }

        onStageTap(x, y) {
            return this.revealAt(x, y);
        }

        onStageDrag(x, y) {
            return this.revealAt(x, y);
        }
    }

    class LotteryRenderer extends CasinoRenderer {
        render() {
            const context = this.beginTable("");
            const w = this.rect.width;
            const h = this.rect.height;
            const lottery = this.scene._lottery || {};
            const compact = w < 600;
            const ticketW = compact ? w * 0.82 : w * 0.56;
            const ticketH = Math.min(h * 0.58, 250);
            const x = (w - ticketW) / 2;
            this._ticketZones = [];
            const enterOffset = this._animation ? (1 - easeOutCubic(this.animationProgress())) * h * 0.42 : 0;
            const y = h * 0.22 + enterOffset;
            context.save();
            context.shadowColor = "rgba(0,0,0,0.38)";
            context.shadowBlur = 10;
            context.shadowOffsetY = 6;
            fillRound(context, x, y, ticketW, ticketH, 6, "#ead9b5", CASINO_COLORS.brass, 3);
            context.shadowColor = "transparent";
            context.setLineDash([8, 6]);
            context.strokeStyle = CASINO_COLORS.woodLight;
            context.beginPath(); context.moveTo(x + ticketW * 0.65, y + 12); context.lineTo(x + ticketW * 0.65, y + ticketH - 12); context.stroke();
            context.setLineDash([]);
            canvasText(context, "EXPLORE CASINO", x + 20, y + 34, ticketW * 0.58, compact ? 18 : 22, CASINO_COLORS.wood);
            canvasText(context, String(this.scene._number).padStart(2, "0"), x + 20, y + ticketH * 0.58, ticketW * 0.58, Math.min(76, ticketH * 0.34), CASINO_COLORS.red);
            const arrowY = y + ticketH * 0.58;
            const arrowRadius = Math.min(24, ticketH * 0.1);
            [[x + ticketW * 0.1, "‹", -1], [x + ticketW * 0.58, "›", 1]].forEach(([arrowX, label, delta]) => {
                context.beginPath(); context.arc(arrowX, arrowY, arrowRadius, 0, Math.PI * 2); context.fillStyle = CASINO_COLORS.wood; context.fill();
                context.lineWidth = 2; context.strokeStyle = CASINO_COLORS.brass; context.stroke();
                canvasText(context, label, arrowX - arrowRadius, arrowY, arrowRadius * 2, arrowRadius * 1.3, CASINO_COLORS.ivory);
                this._ticketZones.push({ x: arrowX - arrowRadius, y: arrowY - arrowRadius, width: arrowRadius * 2, height: arrowRadius * 2, delta });
            });
            canvasText(context, "選號", x + ticketW * 0.68, y + 38, ticketW * 0.28, 16, CASINO_COLORS.wood);
            canvasText(context, `下注 ${money(this.scene._bet)}`, x + ticketW * 0.68, y + ticketH * 0.54, ticketW * 0.28, compact ? 15 : 18, CASINO_COLORS.ink);
            const canBuy = this.scene._mode === "bet";
            fillRound(context, x + ticketW * 0.7, y + ticketH * 0.68, ticketW * 0.24, 40, 5, canBuy ? CASINO_COLORS.red : CASINO_COLORS.woodLight, CASINO_COLORS.brass, 2);
            canvasText(context, canBuy ? "購買" : "已購買", x + ticketW * 0.7, y + ticketH * 0.68 + 20, ticketW * 0.24, 17, CASINO_COLORS.ivory);
            if (canBuy) this._ticketZones.push({ x: x + ticketW * 0.7, y: y + ticketH * 0.68, width: ticketW * 0.24, height: 40, buy: true });
            context.restore();
            fillRound(context, w * 0.16, h * 0.06, w * 0.68, 54, 6, CASINO_COLORS.black, CASINO_COLORS.brass, 2);
            canvasText(context, `獎池  ${money(lottery.jackpot)} ${this.scene._currency || "全域幣"}`, w * 0.17, h * 0.06 + 27, w * 0.66, compact ? 18 : 23, CASINO_COLORS.brassLight);
            const mine = Object.entries(lottery.my_tickets || {}).slice(0, 4).map(([number, stake]) => `${number}:${money(stake)}`).join("　");
            canvasText(context, mine ? `持有 ${mine}` : "尚未持有本期彩票", 20, h - 46, w - 40, 17, CASINO_COLORS.muted);
            if (lottery.draw_at) canvasText(context, `開獎 ${new Date(lottery.draw_at).toLocaleString()}`, 20, h - 22, w - 40, 15, CASINO_COLORS.muted);
            this.finish();
        }

        onStageTap(x, y) {
            if (this.scene._busy || this.scene._mode !== "bet") return false;
            const zone = this._ticketZones.find(item => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
            if (!zone) return false;
            if (zone.buy) this.scene.buyLottery();
            else this.scene.adjustNumber(zone.delta, 99);
            return true;
        }

        playResponse(response) {
            playCasinoSe("Book1", 75, 108);
            return this.animate("ticket", response, 32).then(() => playCasinoSe("Coin", 70, 115));
        }
    }

    class TowerRenderer extends CasinoRenderer {
        render() {
            const context = this.beginTable("五層幸運塔");
            const w = this.rect.width;
            const h = this.rect.height;
            const round = this.scene._round;
            const response = this.response();
            const current = Number(round?.current_level || 1);
            const safe = Number(round?.safe_level || 0);
            const floorH = Math.min(62, (h - 82) / 5);
            const towerW = Math.min(w * 0.78, 560);
            const startX = (w - towerW) / 2;
            const baseY = h - 42;
            this._doorZones = [];
            for (let level = 1; level <= 5; level++) {
                const y = baseY - level * floorH;
                const active = round?.status === "active" && level === current;
                const cleared = level <= safe;
                fillRound(context, startX, y, towerW, floorH - 4, 4, active ? "#276d4c" : cleared ? "#305b43" : "#223b31", active ? CASINO_COLORS.brassLight : CASINO_COLORS.brass, active ? 3 : 1);
                canvasText(context, `${level}F`, startX + 8, y + floorH / 2 - 2, 44, 16, active ? CASINO_COLORS.brassLight : CASINO_COLORS.muted, "left");
                const doorW = Math.min(92, (towerW - 92) / 3);
                const gap = (towerW - 64 - doorW * 3) / 4;
                for (let tile = 0; tile < 3; tile++) {
                    const dx = startX + 58 + gap + tile * (doorW + gap);
                    const dy = y + 8;
                    const dh = floorH - 19;
                    const selected = Number(response?.result?.level) === level && Number(response?.result?.tile) === tile;
                    let fill = active ? CASINO_COLORS.woodLight : "#34251c";
                    if (cleared && round?.picked?.[String(level)] === tile) fill = CASINO_COLORS.brass;
                    const openProgress = selected ? easeOutCubic(this.animationProgress()) : 0;
                    fillRound(context, dx, dy, doorW, dh, 4, "#17130f", active ? CASINO_COLORS.ivory : CASINO_COLORS.brass, active ? 2 : 1);
                    if (selected && openProgress > 0.42) {
                        if (response?.result?.outcome === "cactus") {
                            drawCactus(context, dx + doorW / 2, dy + dh / 2, Math.min(doorW, dh) * 0.72, clamp((openProgress - 0.42) / 0.35, 0, 1));
                        } else {
                            canvasText(context, "✓", dx, dy + dh / 2, doorW, Math.min(28, dh * 0.72), CASINO_COLORS.win);
                        }
                    }
                    const panelWidth = Math.max(5, doorW * (1 - openProgress * 0.88));
                    fillRound(context, dx, dy, panelWidth, dh, 4, fill, CASINO_COLORS.brass, 1);
                    if (panelWidth > 30) {
                        context.beginPath(); context.arc(dx + panelWidth - 10, dy + dh / 2, 3, 0, Math.PI * 2); context.fillStyle = CASINO_COLORS.brassLight; context.fill();
                        canvasText(context, ["左", "中", "右"][tile], dx, dy + dh / 2, panelWidth, 16, CASINO_COLORS.ivory);
                    }
                    if (active) this._doorZones.push({ x: dx, y: dy, width: doorW, height: dh, tile });
                }
            }
            const multiplier = round?.multipliers?.[safe] || 1;
            canvasText(context, round ? `安全樓層 ${safe}/5　可提現 x${Number(multiplier).toFixed(1)}` : "下注後選擇每層的一扇門", 20, h - 20, w - 40, 19, CASINO_COLORS.brassLight);
            this.finish();
        }

        onStageTap(x, y) {
            if (this.scene._busy || this.scene._round?.status !== "active") return false;
            const zone = this._doorZones.find(item => x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
            if (!zone) return false;
            this.scene.actRound({ action: "pick", tile: zone.tile });
            return true;
        }

        playResponse(response) {
            const outcome = response.result?.outcome;
            playCasinoSe("Door3", 80, 110);
            return this.animate("door", response, 42).then(() => playCasinoSe(outcome === "cactus" ? "Buzzer3" : outcome === "safe" ? "Up4" : "Applause2", 82));
        }
    }

    class SlotsRenderer extends CasinoRenderer {
        render() {
            const context = this.beginTable("幸運拉霸");
            const w = this.rect.width;
            const h = this.rect.height;
            const response = this.response();
            const targets = response?.result?.reels || ["7️⃣", "🍒", "🔔"];
            const symbols = ["🍒", "🍋", "🍇", "🔔", "7️⃣"];
            const cabinetW = Math.min(w * 0.78, 650);
            const cabinetH = Math.min(h * 0.72, 330);
            const x = (w - cabinetW) / 2;
            const y = h * 0.16;
            fillRound(context, x, y, cabinetW, cabinetH, 12, CASINO_COLORS.red, CASINO_COLORS.brassLight, 5);
            fillRound(context, x + 18, y + 52, cabinetW - 74, cabinetH - 90, 8, CASINO_COLORS.black, CASINO_COLORS.brass, 3);
            canvasText(context, "LUCKY 7", x + 20, y + 28, cabinetW - 40, 24, CASINO_COLORS.brassLight);
            const reelGap = 12;
            const reelW = (cabinetW - 110 - reelGap * 2) / 3;
            const reelH = cabinetH - 120;
            for (let reel = 0; reel < 3; reel++) {
                const rx = x + 36 + reel * (reelW + reelGap);
                const ry = y + 72;
                fillRound(context, rx, ry, reelW, reelH, 5, CASINO_COLORS.ivory, CASINO_COLORS.brass, 2);
                let symbol = targets[reel];
                let offset = 0;
                if (this._animation) {
                    const frame = this._animation.frame;
                    const stopFrame = 26 + reel * 10;
                    if (frame < stopFrame) {
                        symbol = symbols[(Math.floor(frame / 3) + reel * 2) % symbols.length];
                        offset = (frame % 3) / 3 * reelH * 0.34;
                    }
                }
                drawSlotSymbol(context, symbol, rx + reelW * 0.13, ry + reelH * 0.12 + offset, Math.min(reelW * 0.74, reelH * 0.75));
                context.save();
                context.globalAlpha = 0.15;
                context.fillStyle = "#000";
                context.fillRect(rx + 2, ry + 2, reelW - 4, reelH * 0.15);
                context.fillRect(rx + 2, ry + reelH * 0.85, reelW - 4, reelH * 0.13);
                context.restore();
            }
            const leverX = x + cabinetW - 40;
            const leverPull = this._animation ? Math.sin(Math.min(1, this.animationProgress() * 1.35) * Math.PI) : 0;
            const knobX = leverX + 25;
            const knobY = y + 15 + leverPull * Math.min(78, cabinetH * 0.24);
            context.lineWidth = 8; context.strokeStyle = CASINO_COLORS.brass;
            context.beginPath(); context.moveTo(leverX, y + 82); context.lineTo(knobX, knobY); context.stroke();
            context.beginPath(); context.arc(knobX, knobY, 13, 0, Math.PI * 2); context.fillStyle = CASINO_COLORS.red; context.fill(); context.strokeStyle = CASINO_COLORS.brassLight; context.lineWidth = 3; context.stroke();
            this._leverZone = { x: leverX - 18, y: y, width: 86, height: cabinetH * 0.52 };
            const won = response?.result?.won;
            if (response) canvasText(context, `${response.result?.prize_name || "未中獎"}　派彩 ${money(response.payout)}`, 20, h - 24, w - 40, 21, won ? CASINO_COLORS.win : CASINO_COLORS.lose);
            else canvasText(context, "拉下把手，等待轉輪停止", 20, h - 24, w - 40, 19, CASINO_COLORS.muted);
            this.finish();
        }

        onStageTap(x, y) {
            if (this.scene._busy || this.scene._round) return false;
            const zone = this._leverZone;
            if (zone && x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) {
                this.scene.selectGameAction();
                return true;
            }
            return false;
        }

        playResponse(response) {
            playCasinoSe("Machine", 88, 108);
            return this.animate("reels", response, 60).then(() => playCasinoSe(response.result?.won ? "Applause2" : "Disappointment", 82));
        }
    }

    class HighLowRenderer extends CasinoRenderer {
        render() {
            const context = this.beginTable("比大小牌桌");
            const w = this.rect.width;
            const h = this.rect.height;
            const round = this.scene._round;
            const response = this.response();
            this._guessZones = [];
            const cardW = Math.min(128, w * 0.22, h * 0.28);
            const cardH = cardW * 1.4;
            const leftX = w * 0.34 - cardW / 2;
            const rightX = w * 0.66 - cardW / 2;
            const cardY = h * 0.37 - cardH / 2;
            let currentCard = round?.card ? [round.card.rank_name, round.card.suit] : ["7", "♠"];
            let nextCard = null;
            if (this._animation && response?.result?.previous) {
                currentCard = [cardRankLabel(response.result.previous.rank), response.result.previous.suit];
                nextCard = [cardRankLabel(response.result.next?.rank), response.result.next?.suit];
            } else if (response?.result?.next && round?.status !== "active") {
                nextCard = [cardRankLabel(response.result.next.rank), response.result.next.suit];
            }
            drawCard(context, leftX, cardY, cardW, cardH, currentCard, false, -0.04);
            const flip = this._animation ? Math.abs(Math.cos(this.animationProgress() * Math.PI)) : 1;
            if (nextCard) {
                context.save(); context.translate(rightX + cardW / 2, 0); context.scale(Math.max(0.05, flip), 1); context.translate(-(rightX + cardW / 2), 0);
                drawCard(context, rightX, cardY, cardW, cardH, nextCard, this._animation && this.animationProgress() < 0.5, 0.04);
                context.restore();
            } else {
                drawCard(context, rightX, cardY, cardW, cardH, null, true, 0.04);
            }
            canvasText(context, "目前牌", leftX - 10, cardY + cardH + 24, cardW + 20, 17, CASINO_COLORS.muted);
            canvasText(context, "下一張", rightX - 10, cardY + cardH + 24, cardW + 20, 17, CASINO_COLORS.muted);
            if (round?.status === "active") {
                const guessRadius = Math.min(38, w * 0.065, h * 0.11);
                const guessY = cardY + cardH * 0.48;
                [
                    { x: w * 0.14, label: "↑", guess: "high", color: CASINO_COLORS.red, enabled: Number(round.probabilities?.high || 0) > 0 },
                    { x: w * 0.86, label: "↓", guess: "low", color: CASINO_COLORS.blue, enabled: Number(round.probabilities?.low || 0) > 0 },
                ].forEach(option => {
                    context.save();
                    context.globalAlpha = option.enabled ? 1 : 0.35;
                    context.beginPath(); context.arc(option.x, guessY, guessRadius, 0, Math.PI * 2); context.fillStyle = option.color; context.fill();
                    context.lineWidth = 3; context.strokeStyle = CASINO_COLORS.brassLight; context.stroke();
                    canvasText(context, option.label, option.x - guessRadius, guessY, guessRadius * 2, guessRadius * 1.2, CASINO_COLORS.ivory);
                    context.restore();
                    this._guessZones.push({ x: option.x - guessRadius, y: guessY - guessRadius, width: guessRadius * 2, height: guessRadius * 2, guess: option.guess, enabled: option.enabled });
                });
            }
            const streak = Number(round?.streak || 0);
            const pot = Number(round?.pot || this.scene._bet);
            fillRound(context, w * 0.27, h * 0.76, w * 0.46, 54, 6, CASINO_COLORS.black, CASINO_COLORS.brass, 2);
            canvasText(context, `連勝 ${streak}　彩池 ${money(pot)} ${this.scene._currency || "全域幣"}`, w * 0.28, h * 0.76 + 27, w * 0.44, 19, CASINO_COLORS.brassLight);
            if (response?.result?.outcome) canvasText(context, `結果：${outcomeLabel(response.result.outcome)}`, 20, h - 20, w - 40, 19, response.result.outcome === "lose" ? CASINO_COLORS.lose : CASINO_COLORS.win);
            this.finish();
        }

        onStageTap(x, y) {
            if (this.scene._busy || this.scene._round?.status !== "active") return false;
            const zone = this._guessZones.find(item => item.enabled && x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height);
            if (!zone) return false;
            this.scene.actRound({ action: "guess", guess: zone.guess });
            return true;
        }

        playResponse(response) {
            playCasinoSe("Book1", 78, 110);
            return this.animate("flip", response, 44).then(() => playCasinoSe(response.result?.outcome === "lose" ? "Buzzer1" : "Bell1", 75));
        }
    }

    class BlackjackRenderer extends CasinoRenderer {
        drawHand(context, cards, hiddenCount, centerX, y, cardW, cardH, progress = 1) {
            const total = cards.length + hiddenCount;
            const spacing = Math.min(cardW * 0.58, this.rect.width * 0.42 / Math.max(1, total));
            const startX = centerX - ((total - 1) * spacing + cardW) / 2;
            for (let index = 0; index < total; index++) {
                const targetX = startX + index * spacing;
                const deal = clamp(progress * total - index, 0, 1);
                const x = targetX + (1 - easeOutCubic(deal)) * (this.rect.width - targetX);
                const card = cards[index] || null;
                drawCard(context, x, y, cardW, cardH, card, index >= cards.length, (index - total / 2) * 0.018, deal);
            }
        }

        render() {
            const context = this.beginTable("BLACKJACK PAYS 3:2");
            const w = this.rect.width;
            const h = this.rect.height;
            const round = this.scene._round || this.response()?.round;
            const cardW = Math.min(92, w * 0.13, h * 0.19);
            const cardH = cardW * 1.38;
            const progress = this._animation ? easeOutCubic(this.animationProgress()) : 1;
            context.save();
            context.strokeStyle = CASINO_COLORS.brassLight;
            context.lineWidth = 3;
            context.beginPath(); context.arc(w / 2, h * 0.55, w * 0.38, Math.PI * 1.08, Math.PI * 1.92); context.stroke();
            context.restore();
            canvasText(context, "莊家", 20, 60, w - 40, 18, CASINO_COLORS.muted);
            this.drawHand(context, round?.dealer_hand || [], Number(round?.dealer_hidden || 0), w / 2, 76, cardW, cardH, progress);
            const playerY = h - cardH - 72;
            this.drawHand(context, round?.player_hand || [], 0, w / 2, playerY, cardW, cardH, progress);
            canvasText(context, `玩家 ${round?.player_total ?? 0} 點`, 20, h - 42, w - 40, 20, CASINO_COLORS.ivory);
            if (round?.dealer_total != null) canvasText(context, `莊家 ${round.dealer_total} 點`, 20, 48, w - 40, 17, CASINO_COLORS.ivory);
            const bet = Number(round?.bet || this.scene._bet);
            drawChip(context, w * 0.14, h * 0.7, Math.min(34, w * 0.05), CASINO_COLORS.red, money(bet));
            const result = this.response()?.result;
            if (result?.outcome) {
                const outcomeColor = result.outcome === "push" ? CASINO_COLORS.brassLight : Number(this.response()?.payout) > 0 ? CASINO_COLORS.win : CASINO_COLORS.lose;
                canvasText(context, `結果：${outcomeLabel(result.outcome)}　派彩 ${money(this.response()?.payout)}`, w * 0.52, h - 42, w * 0.42, 18, outcomeColor, "right");
            }
            this.finish();
        }

        playResponse(response) {
            playCasinoSe("Book2", 80, 108);
            return this.animate("deal", response, 48).then(() => {
                if (response.round?.status !== "active") playCasinoSe(Number(response.payout) > 0 ? "Applause1" : "Disappointment", 80);
            });
        }
    }

    const RENDERERS = {
        roulette: RouletteRenderer,
        dice: DiceRenderer,
        coinflip: CoinRenderer,
        scratchcard: ScratchRenderer,
        lottery: LotteryRenderer,
        tower: TowerRenderer,
        slots: SlotsRenderer,
        highlow: HighLowRenderer,
        blackjack: BlackjackRenderer,
    };

    class Scene_CasinoTable extends Scene_MenuBase {
        prepare(game) {
            this._game = GAME_NAMES[game] ? game : "slots";
        }

        needsCancelButton() {
            return false;
        }

        createBackground() {
            this._backgroundSprite = new Sprite();
            this.addChild(this._backgroundSprite);
            this.redrawBackground();
        }

        redrawBackground() {
            const width = Graphics.boxWidth;
            const height = Graphics.boxHeight;
            if (this._backgroundSprite.bitmap) this._backgroundSprite.bitmap.destroy();
            const bitmap = new Bitmap(width, height);
            const context = bitmap.context;
            context.fillStyle = CASINO_COLORS.night;
            context.fillRect(0, 0, width, height);
            context.save();
            context.globalAlpha = 0.16;
            context.strokeStyle = CASINO_COLORS.brass;
            context.lineWidth = 2;
            for (let x = -height; x < width + height; x += 46) {
                context.beginPath(); context.moveTo(x, 0); context.lineTo(x + height, height); context.stroke();
            }
            context.restore();
            context.fillStyle = CASINO_COLORS.wood;
            context.fillRect(0, 0, width, 66);
            context.fillStyle = CASINO_COLORS.brass;
            context.fillRect(0, 64, width, 2);
            updateBitmap(bitmap);
            this._backgroundSprite.bitmap = bitmap;
        }

        create() {
            this._bet = BET_MIN;
            this._number = 0;
            this._balance = 0;
            this._currency = "全域幣";
            this._lottery = null;
            this._round = null;
            this._lastResponse = null;
            this._mode = "bet";
            this._busy = false;
            this._busyMessage = "";
            this._error = "";
            this._retryOperation = null;
            this._buttons = [];
            this._focusIndex = 0;
            this._layoutWidth = 0;
            this._layoutHeight = 0;
            super.create();
            this._stageLayer = new Sprite();
            this._controlLayer = new Sprite();
            this._hudLayer = new Sprite();
            this._overlayLayer = new Sprite();
            this.addChild(this._stageLayer);
            this.addChild(this._controlLayer);
            this.addChild(this._hudLayer);
            this.addChild(this._overlayLayer);
            const RendererClass = RENDERERS[this._game] || SlotsRenderer;
            this._renderer = new RendererClass(this);
            this._renderer.attach(this._stageLayer);
            this.refreshLayout();
            this.loadState();
        }

        terminate() {
            this.clearControls();
            if (this._renderer?.sprite?.bitmap) this._renderer.sprite.bitmap.destroy();
            super.terminate();
        }

        applyBalance(response) {
            if (response?.balance != null) this._balance = Number(response.balance);
            if (response?.currency_name) this._currency = response.currency_name;
        }

        async loadState() {
            if (this._busy) return;
            const operation = {
                run: () => CasinoApi.state(),
                message: "正在整理賭桌…",
                success: async state => {
                    this.applyBalance(state);
                    this._lottery = state.lottery || {};
                    this._round = (state.active_rounds || []).find(round => round.game === this._game) || null;
                    this._lastResponse = this._round ? { game: this._game, round: this._round, result: this._round.result, payout: this._round.payout || 0 } : null;
                    this._mode = this._round ? (this._round.status === "active" ? "round" : "result") : "bet";
                    this._renderer.render();
                },
            };
            await this.executeOperation(operation, false);
        }

        async executeOperation(operation, animate = true) {
            if (this._busy) return;
            this._busy = true;
            this._busyMessage = operation.message || "荷官處理中…";
            this._error = "";
            this._retryOperation = operation;
            this.refreshLayout();
            try {
                const response = await operation.run();
                this.applyBalance(response);
                await operation.success(response, animate);
                this._error = "";
                this._retryOperation = null;
            } catch (error) {
                if (error?.data?.round) {
                    this.applyBalance(error.data);
                    this._round = error.data.round;
                    this._lastResponse = error.data;
                    this._mode = this._round.status === "active" ? "round" : "result";
                    this._retryOperation = null;
                    this._renderer.render();
                } else {
                    this._error = error?.message || "賭場服務暫時無法使用。";
                    playCasinoSe("Buzzer1", 70);
                }
            } finally {
                this._busy = false;
                this._busyMessage = "";
                this.refreshLayout();
            }
        }

        retryLastOperation() {
            if (this._retryOperation && !this._busy) this.executeOperation(this._retryOperation);
        }

        command(label, callback, options = {}) {
            return { label, callback, ...options };
        }

        betCommands() {
            const chips = [50, 100, 500, 1000, 2000].map((value, index) => {
                const swatches = [CASINO_COLORS.blue, CASINO_COLORS.red, "#7555a4", CASINO_COLORS.black, CASINO_COLORS.brass];
                return this.command(money(value), () => {
                    this._bet = value;
                    this._renderer.render();
                    this.refreshControls();
                }, { selected: this._bet === value, swatch: swatches[index], fill: CASINO_COLORS.feltDark });
            });
            return [
                ...chips,
                this.command("−50", () => this.adjustBet(-50), { fill: CASINO_COLORS.black }),
                this.command("+50", () => this.adjustBet(50), { fill: CASINO_COLORS.black }),
                this.command(this._game === "slots" ? "拉桿" : this._game === "scratchcard" ? "購買" : "開始", () => this.selectGameAction(), { selected: true, focus: true }),
            ];
        }

        lotteryCommands() {
            return [
                this.command("號碼 −10", () => this.adjustNumber(-10, 99)),
                this.command("號碼 −1", () => this.adjustNumber(-1, 99)),
                this.command("號碼 +1", () => this.adjustNumber(1, 99)),
                this.command("號碼 +10", () => this.adjustNumber(10, 99)),
                this.command("下注 −50", () => this.adjustBet(-50)),
                this.command("下注 +50", () => this.adjustBet(50)),
                this.command("購買彩票", () => this.buyLottery(), { selected: true, focus: true }),
            ];
        }

        rouletteChoiceCommands() {
            return [
                this.command("紅", () => this.playInstant({ bet_type: "red" }), { swatch: CASINO_COLORS.red, fill: CASINO_COLORS.red }),
                this.command("黑", () => this.playInstant({ bet_type: "black" }), { swatch: CASINO_COLORS.black, fill: CASINO_COLORS.black }),
                this.command("單數", () => this.playInstant({ bet_type: "odd" })),
                this.command("雙數", () => this.playInstant({ bet_type: "even" })),
                this.command("1–18", () => this.playInstant({ bet_type: "low" }), { fill: CASINO_COLORS.blue }),
                this.command("19–36", () => this.playInstant({ bet_type: "high" }), { fill: CASINO_COLORS.blue }),
                this.command("單號", () => this.openRouletteNumber()),
                this.command("返回", () => { this._mode = "bet"; this.refreshLayout(); }, { fill: CASINO_COLORS.black }),
            ];
        }

        numberCommands(max, submit) {
            return [
                this.command("−10", () => this.adjustNumber(-10, max)),
                this.command("−1", () => this.adjustNumber(-1, max)),
                this.command(`號碼 ${String(this._number).padStart(2, "0")}`, () => {}, { selected: true, enabled: false }),
                this.command("+1", () => this.adjustNumber(1, max)),
                this.command("+10", () => this.adjustNumber(10, max)),
                this.command("確認下注", submit, { selected: true, focus: true }),
                this.command("返回", () => { this._mode = "rouletteChoice"; this.refreshLayout(); }, { fill: CASINO_COLORS.black }),
            ];
        }

        roundCommands() {
            if (!this._round || this._round.status !== "active") return this.resultCommands();
            if (this._game === "tower") {
                const safe = Number(this._round.safe_level || 0);
                return [
                    this.command("左門", () => this.actRound({ action: "pick", tile: 0 })),
                    this.command("中門", () => this.actRound({ action: "pick", tile: 1 })),
                    this.command("右門", () => this.actRound({ action: "pick", tile: 2 })),
                    this.command("提現", () => this.actRound({ action: "cashout" }), { selected: safe > 0, enabled: safe > 0, focus: safe > 0 }),
                    this.command("離開牌桌", () => this.popScene(), { fill: CASINO_COLORS.black }),
                ];
            }
            if (this._game === "highlow") {
                return [
                    this.command("猜大", () => this.actRound({ action: "guess", guess: "high" }), { enabled: Number(this._round.probabilities?.high || 0) > 0, fill: CASINO_COLORS.red, focus: true }),
                    this.command("猜小", () => this.actRound({ action: "guess", guess: "low" }), { enabled: Number(this._round.probabilities?.low || 0) > 0, fill: CASINO_COLORS.blue }),
                    this.command("提現", () => this.actRound({ action: "cashout" }), { selected: Number(this._round.streak || 0) > 0, enabled: Number(this._round.streak || 0) > 0 }),
                    this.command("離開牌桌", () => this.popScene(), { fill: CASINO_COLORS.black }),
                ];
            }
            return [
                this.command("要牌", () => this.actRound({ action: "hit" }), { fill: CASINO_COLORS.blue, focus: true }),
                this.command("停牌", () => this.actRound({ action: "stand" }), { selected: true }),
                this.command("加倍", () => this.actRound({ action: "double" }), { enabled: Boolean(this._round.can_double), fill: CASINO_COLORS.red }),
                this.command("離開牌桌", () => this.popScene(), { fill: CASINO_COLORS.black }),
            ];
        }

        resultCommands() {
            const list = [];
            if (this._game === "scratchcard" && this._renderer._scratchResponse && this._renderer._revealed.size < 9) {
                list.push(this.command("全部刮開", () => this._renderer.revealAll(), { fill: CASINO_COLORS.blue }));
            }
            list.push(this.command("再玩一次", () => this.resetForAnother(), { selected: true, focus: true }));
            list.push(this.command("離開牌桌", () => this.popScene(), { fill: CASINO_COLORS.black }));
            return list;
        }

        commands() {
            if (this._busy) return [this.command(this._busyMessage || "荷官處理中…", () => {}, { enabled: false })];
            if (this._error) {
                return [
                    this.command("重試", () => this.retryLastOperation(), { selected: true }),
                    this.command("返回地圖", () => this.popScene(), { fill: CASINO_COLORS.black }),
                ];
            }
            if (this._mode === "round") return this.roundCommands();
            if (this._mode === "result") return this.resultCommands();
            if (this._mode === "rouletteChoice") return this.rouletteChoiceCommands();
            if (this._mode === "rouletteNumber") return this.numberCommands(36, () => this.playInstant({ bet_type: "number", number: this._number }));
            if (this._mode === "diceChoice") {
                return [1,2,3,4,5,6].map(value => this.command(`猜 ${value}`, () => this.playInstant({ guess: value }), { selected: this._number === value })).concat([
                    this.command("返回", () => { this._mode = "bet"; this.refreshLayout(); }, { fill: CASINO_COLORS.black }),
                ]);
            }
            if (this._mode === "coinChoice") {
                return [
                    this.command("正面", () => this.playInstant({ side: "heads" }), { selected: true, fill: CASINO_COLORS.brass }),
                    this.command("反面", () => this.playInstant({ side: "tails" }), { fill: CASINO_COLORS.woodLight }),
                    this.command("返回", () => { this._mode = "bet"; this.refreshLayout(); }, { fill: CASINO_COLORS.black }),
                ];
            }
            if (this._game === "lottery") return this.lotteryCommands();
            return this.betCommands();
        }

        adjustBet(delta) {
            this._bet = clamp(Math.round((this._bet + delta) / 50) * 50, BET_MIN, BET_MAX);
            this._renderer.render();
            this.refreshControls();
        }

        adjustNumber(delta, max) {
            this._number = clamp(this._number + delta, 0, max);
            this._renderer.render();
            this.refreshControls();
        }

        openRouletteNumber() {
            this._number = 0;
            this._mode = "rouletteNumber";
            this.refreshLayout();
        }

        selectGameAction() {
            if (this._busy) return;
            if (this._game === "roulette") {
                this._mode = "rouletteChoice";
                this.refreshLayout();
            } else if (this._game === "dice") {
                this._mode = "diceChoice";
                this.refreshLayout();
            } else if (this._game === "coinflip") {
                this._mode = "coinChoice";
                this.refreshLayout();
            } else if (["tower", "highlow", "blackjack"].includes(this._game)) {
                this.startRound();
            } else {
                this.playInstant({});
            }
        }

        async playInstant(options) {
            const operationId = requestId();
            const operation = {
                run: () => CasinoApi.play(this._game, this._bet, options, operationId),
                message: this._game === "slots" ? "轉輪加速中…" : this._game === "scratchcard" ? "正在印製彩票…" : "荷官確認下注…",
                success: async response => {
                    this._lastResponse = response;
                    this._round = null;
                    this._mode = "result";
                    await this._renderer.playResponse(response);
                },
            };
            await this.executeOperation(operation);
        }

        async buyLottery() {
            const operationId = requestId();
            const operation = {
                run: () => CasinoApi.buyLottery(this._bet, this._number, operationId),
                message: "正在印製彩票…",
                success: async response => {
                    this._lottery = response.lottery || this._lottery;
                    this._lastResponse = response;
                    this._mode = "result";
                    await this._renderer.playResponse(response);
                },
            };
            await this.executeOperation(operation);
        }

        async startRound() {
            const operationId = requestId();
            const operation = {
                run: () => CasinoApi.startRound(this._game, this._bet, operationId),
                message: this._game === "blackjack" ? "正在洗牌與發牌…" : "正在準備牌局…",
                success: async response => {
                    this._lastResponse = response;
                    this._round = response.round;
                    this._mode = this._round?.status === "active" ? "round" : "result";
                    await this._renderer.playResponse(response);
                },
            };
            await this.executeOperation(operation);
        }

        async actRound(options) {
            if (!this._round || this._busy) return;
            const operationId = requestId();
            const roundId = this._round.round_id;
            const { action, ...rest } = options;
            const operation = {
                run: () => CasinoApi.actRound(roundId, action, rest, operationId),
                message: action === "cashout" ? "正在兌現籌碼…" : action === "pick" ? "正在開門…" : action === "guess" ? "正在翻牌…" : "荷官處理中…",
                success: async response => {
                    this._lastResponse = response;
                    this._round = response.round;
                    this._mode = this._round?.status === "active" ? "round" : "result";
                    await this._renderer.playResponse(response);
                },
            };
            await this.executeOperation(operation);
        }

        resetForAnother() {
            this._round = null;
            this._lastResponse = null;
            this._mode = "bet";
            this._error = "";
            if (this._renderer instanceof ScratchRenderer) {
                this._renderer._scratchResponse = null;
                this._renderer._revealed.clear();
            }
            this.refreshLayout();
        }

        clearControls() {
            for (const button of this._buttons || []) {
                this._controlLayer?.removeChild(button);
                if (button.bitmap) button.bitmap.destroy();
                button.destroy();
            }
            this._buttons = [];
        }

        refreshControls() {
            this.refreshLayout(false);
        }

        refreshLayout(reflowStage = true) {
            if (!this._renderer || !this._controlLayer) return;
            const width = Graphics.boxWidth;
            const height = Graphics.boxHeight;
            if (width !== this._layoutWidth || height !== this._layoutHeight) {
                this._layoutWidth = width;
                this._layoutHeight = height;
                this.redrawBackground();
                reflowStage = true;
            }
            const definitions = this.commands();
            const commandSignature = `${this._mode}|${this._busy}|${Boolean(this._error)}|${this._round?.status || ""}|${definitions.map(item => `${item.label}:${item.enabled !== false}`).join("|")}`;
            const commandSetChanged = commandSignature !== this._commandSignature;
            this._commandSignature = commandSignature;
            const landscape = width >= height;
            const columns = landscape ? Math.min(8, Math.max(1, definitions.length)) : Math.min(width < 520 ? 3 : 4, Math.max(1, definitions.length));
            const rows = Math.ceil(definitions.length / columns);
            const gap = 8;
            const margin = 16;
            const buttonHeight = 50;
            const controlHeight = rows * buttonHeight + Math.max(0, rows - 1) * gap + 18;
            const stageTop = 74;
            const stageBottom = height - controlHeight - 8;
            this._stageRect = new Rectangle(margin, stageTop, width - margin * 2, Math.max(120, stageBottom - stageTop));
            if (reflowStage) this._renderer.layout(this._stageRect);
            else this._renderer.render();
            this.drawHud();
            this.clearControls();
            this._controlColumns = columns;
            const usableWidth = width - margin * 2 - gap * (columns - 1);
            const buttonWidth = Math.floor(usableWidth / columns);
            const startY = height - controlHeight + 8;
            definitions.forEach((definition, index) => {
                const column = index % columns;
                const row = Math.floor(index / columns);
                const button = new Sprite_CasinoButton(buttonWidth, buttonHeight, definition.label, definition.callback, definition);
                button.x = margin + column * (buttonWidth + gap);
                button.y = startY + row * (buttonHeight + gap);
                this._controlLayer.addChild(button);
                this._buttons.push(button);
            });
            if (commandSetChanged) {
                const preferred = definitions.findIndex(item => item.focus && item.enabled !== false);
                const firstEnabled = definitions.findIndex(item => item.enabled !== false);
                this._focusIndex = preferred >= 0 ? preferred : Math.max(0, firstEnabled);
            } else {
                this._focusIndex = clamp(this._focusIndex, 0, Math.max(0, this._buttons.length - 1));
                if (this._buttons[this._focusIndex] && !this._buttons[this._focusIndex].isClickEnabled()) {
                    const firstEnabled = this._buttons.findIndex(button => button.isClickEnabled());
                    if (firstEnabled >= 0) this._focusIndex = firstEnabled;
                }
            }
            this.updateFocus();
            this.drawOverlay();
        }

        drawHud() {
            if (this._hudSprite?.bitmap) this._hudSprite.bitmap.destroy();
            if (!this._hudSprite) {
                this._hudSprite = new Sprite();
                this._hudLayer.addChild(this._hudSprite);
            }
            const width = Graphics.boxWidth;
            const compact = width < 640;
            const bitmap = new Bitmap(width, 66);
            const context = bitmap.context;
            const titleWidth = compact ? width * 0.28 : width * 0.36;
            const chipX = compact ? width * 0.55 : width * 0.58;
            const chipRadius = compact ? 18 : 22;
            const balanceX = compact ? width * 0.61 : width * 0.62;
            canvasText(context, GAME_NAMES[this._game], 72, 31, titleWidth, compact ? 20 : 24, CASINO_COLORS.brassLight, "left");
            if (!compact) canvasText(context, "下注", chipX - 76, 31, 48, 15, CASINO_COLORS.muted, "right", "normal");
            drawChip(context, chipX, 32, chipRadius, CASINO_COLORS.red, money(this._bet));
            canvasText(context, `${money(this._balance)} ${this._currency}`, balanceX, 31, Math.max(72, width - balanceX - 12), compact ? 16 : 20, CASINO_COLORS.ivory, "right");
            updateBitmap(bitmap);
            this._hudSprite.bitmap = bitmap;
            if (this._backButton) {
                this._hudLayer.removeChild(this._backButton);
                if (this._backButton.bitmap) this._backButton.bitmap.destroy();
                this._backButton.destroy();
            }
            this._backButton = new Sprite_CasinoButton(58, 46, "←", () => this.popScene(), { fill: CASINO_COLORS.black, fontSize: 26 });
            this._backButton.x = 8;
            this._backButton.y = 9;
            this._hudLayer.addChild(this._backButton);
        }

        drawOverlay() {
            if (this._statusSprite?.bitmap) this._statusSprite.bitmap.destroy();
            if (!this._statusSprite) {
                this._statusSprite = new Sprite();
                this._overlayLayer.addChild(this._statusSprite);
            }
            const bitmap = new Bitmap(Graphics.boxWidth, 48);
            const context = bitmap.context;
            if (this._busy || this._error) {
                const text = this._error || this._busyMessage;
                const color = this._error ? CASINO_COLORS.red : CASINO_COLORS.black;
                fillRound(context, 18, 4, Graphics.boxWidth - 36, 40, 6, color, this._error ? CASINO_COLORS.lose : CASINO_COLORS.brass, 2);
                canvasText(context, text, 30, 24, Graphics.boxWidth - 60, 17, CASINO_COLORS.ivory);
            }
            updateBitmap(bitmap);
            this._statusSprite.bitmap = bitmap;
            this._statusSprite.y = 66;
        }

        updateFocus() {
            this._buttons.forEach((button, index) => button.setFocused(index === this._focusIndex));
        }

        moveFocus(dx, dy) {
            if (!this._buttons.length) return;
            const columns = this._controlColumns || 1;
            const step = dx + dy * columns;
            let next = clamp(this._focusIndex + step, 0, this._buttons.length - 1);
            while (next >= 0 && next < this._buttons.length && !this._buttons[next].isClickEnabled()) {
                const candidate = next + Math.sign(step || 1);
                if (candidate < 0 || candidate >= this._buttons.length) break;
                next = candidate;
            }
            if (next !== this._focusIndex) {
                this._focusIndex = next;
                this.updateFocus();
                playCasinoSe("Cursor3", 45, 110);
            }
        }

        triggerFocused() {
            const button = this._buttons[this._focusIndex];
            if (button?.isClickEnabled()) {
                playCasinoSe("Decision2", 55, 105);
                button.onClick();
            } else {
                playCasinoSe("Buzzer1", 50);
            }
        }

        update() {
            super.update();
            if (Graphics.boxWidth !== this._layoutWidth || Graphics.boxHeight !== this._layoutHeight) this.refreshLayout();
            this._renderer?.update();
            if (this._renderer?.isAnimating()) {
                if (Input.isTriggered("ok") || Input.isTriggered("cancel") || TouchInput.isTriggered()) this._renderer.skipAnimation();
                return;
            }
            const inStage = this._stageRect && TouchInput.x >= this._stageRect.x && TouchInput.x <= this._stageRect.x + this._stageRect.width && TouchInput.y >= this._stageRect.y && TouchInput.y <= this._stageRect.y + this._stageRect.height;
            if (inStage && !this._busy) {
                const localX = TouchInput.x - this._stageRect.x;
                const localY = TouchInput.y - this._stageRect.y;
                if (TouchInput.isTriggered()) this._renderer.onStageTap(localX, localY);
                if (TouchInput.isPressed()) this._renderer.onStageDrag(localX, localY);
            }
            if (this._busy) return;
            if (Input.isRepeated("left")) this.moveFocus(-1, 0);
            else if (Input.isRepeated("right")) this.moveFocus(1, 0);
            else if (Input.isRepeated("up")) this.moveFocus(0, -1);
            else if (Input.isRepeated("down")) this.moveFocus(0, 1);
            else if (Input.isTriggered("ok")) this.triggerFocused();
            else if (Input.isTriggered("cancel")) {
                if (["rouletteChoice", "rouletteNumber", "diceChoice", "coinChoice"].includes(this._mode)) {
                    this._mode = this._mode === "rouletteNumber" ? "rouletteChoice" : "bet";
                    this.refreshLayout();
                } else {
                    this.popScene();
                }
            }
        }
    }

    PluginManager.registerCommand(PLUGIN_NAME, "OpenCasinoGame", args => {
        SceneManager.push(Scene_CasinoTable);
        SceneManager.prepareNextScene(String(args.game || "slots"));
    });

    let devSceneOpened = false;
    const _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (devSceneOpened || !isDevMode()) return;
        const game = new URLSearchParams(window.location.search).get("casinoGame");
        if (!GAME_NAMES[game]) return;
        devSceneOpened = true;
        SceneManager.push(Scene_CasinoTable);
        SceneManager.prepareNextScene(game);
    };
})();
