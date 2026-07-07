/*:
 * @target MZ
 * @plugindesc Discord Explore Integration
 * @author AvianJay
 * 
 * @command InitializeSDK
 * @text 初始化 SDK
 * @desc 初始化 Discord Embedded App SDK 並連線到 Explore 後端。
 * 
 * @arg switchId
 * @type switch
 *
 * @command OpenServerList
 * @text 伺服器清單
 * @desc 顯示可連線的伺服器清單，點擊後連線並切換到 MAP002 載入空間地圖。
 *
 * @command ChangeSkin
 * @text 更換外觀
 * @desc 顯示可用皮膚清單，選擇後呼叫 API 設定並同步到空間。
 *
 * @command TransferToTarget
 * @text 傳送至目標地圖
 * @desc 根據初始化時判斷的目標（大廳或伺服器空間），傳送玩家到對應地圖。
 *
 * @command LeaveSpace
 * @text 離開空間
 * @desc 離開目前連線的空間並回到世界地圖（MAP001）。
 *
 * @command ShowOnlinePlayers
 * @text 顯示線上玩家
 * @desc 顯示目前房間中的其他線上玩家。
 *
 * @command HideOnlinePlayers
 * @text 隱藏線上玩家
 * @desc 隱藏目前房間中的其他線上玩家。
 *
 * @command SaveData
 * @text 保存存檔
 * @desc 保存目前地圖位置與白名單中的開關、變數。
 *
 * @command LoadData
 * @text 載入存檔
 * @desc 載入已保存的地圖位置與白名單中的開關、變數。
 *
 * @command FetchMusicState
 * @text 取得音樂狀態
 * @desc 向伺服器查詢目前播放的音樂資訊，並更新音樂播放器 UI。
 *
 * @command MusicAction
 * @text 音樂控制
 * @desc 控制音樂播放（next / pause / play / seek / recommend）。
 *
 * @arg action
 * @type string
 * @default pause
 * @text 動作
 * @desc next, pause, play, seek, recommend
 *
 * @arg data
 * @type string
 * @default
 * @text 參數
 * @desc seek 填秒數；recommend 填數量（1-10）；其餘留空。
 *
 * @command StopMusic
 * @text 停止音樂
 * @desc 停止目前播放的音樂並斷開語音頻道。
 *
 * @command ShowMusicPlayer
 * @text 顯示音樂播放器
 * @desc 顯示音樂播放器覆蓋 UI（右下角小視窗）。
 *
 * @command HideMusicPlayer
 * @text 隱藏音樂播放器
 * @desc 隱藏音樂播放器覆蓋 UI。
 *
 * @command CompleteQuest
 * @text 完成任務
 * @desc 向伺服器回報完成一次性任務（伺服端驗證），成功後設定任務開關與獎勵變數（V11=幣、V12=XP）。
 *
 * @arg questId
 * @type string
 * @text 任務 ID
 * @desc 例如 vill_rat / vill_delivery / vill_cabbage / vill_boss
 *
 * @command SyncQuestSwitches
 * @text 同步任務開關
 * @desc 從伺服器抓取任務完成狀態並套用到開關 11-15。
 *
 * @help DiscordExplore.js
 *
 * This plugin integrates with the Discord Explore backend.
 * It requires the Discord Embedded App SDK and Socket.IO client to be loaded.
 */

(() => {
    const PLUGIN_NAME = "DiscordExplore";

    const MAP_WORLD = 1;
    const MAP_SPACE = 2; // MAP002 — 伺服器空間
    const MAP_WAIT  = 3; // 等待室 / 起始地圖

    // 不加入任何房間的地圖 ID（等待室、過場動畫等）
    const IGNORED_MAPS = [3, 4, 5, 6, 7, 8, 9];
    const SAVE_DATA_API_PATH = "/api/explore/me/save-data";
    const DEFAULT_LOAD_MAP_ID = 5;
    const DEFAULT_LOAD_X = 8;
    const DEFAULT_LOAD_Y = 27;
    const LOAD_TINT_TONE = [0, 0, 0, 0];
    const LOAD_TINT_DURATION = 180;
    const SAVABLE_SWITCH_IDS = [
        3, 4
    ];
    const SAVABLE_VARIABLE_IDS = [
        // Add variable IDs here, for example: 1, 2, 3
    ];

    // State
    let discordSdk = null;
    let auth = null; // legacy oauth response
    let exploreAuthToken = null;
    let socket = null;
    let currentGuildId = null;
    let isWorldMap = false;
    let otherPlayers = {}; // userId -> { character: Game_Character, sprite: Sprite_Character|null, skin_id: string|null }
    let remotePlayerStates = {}; // userId -> latest server snapshot
    let onlinePlayersVisible = true;
    let clientId = null;
    let lastX = -1;
    let lastY = -1;
    let upTime = new Date();
    let musicStatePollTimer = null;

    // Music player state
    let musicState = null;       // null | {title, author, thumbnail, url, current, playing, is_radio, is_paused, available}
    let musicUiVisible = false;  // whether the drawer is expanded

    let myUserId = null;
    let myName = null;
    let myLevel = null;
    let pendingSpaceTiles = null; // [{x,y,z,tile_id}]
    let pendingLoadedSaveContext = null;

    // Editor State
    let isEditMode = false;
    let currentTileId = 0;
    let currentZ = 0; // 0=Layer 1, 1=Layer 2, etc.
    let canEditCurrentSpace = false;

    // --- Dev / Test Mode ---
    let isDevMode = false;
    let _pendingInputCallback = null;

    function detectDevMode() {
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.get('instance_id')) {
            const h = window.location.hostname;
            if (!h || h === 'localhost' || h === '127.0.0.1' || h === 'njgcanhfjdabfmnlmpmdedalocpafnhl' || window.location.protocol === 'file:') {
                isDevMode = true;
                console.log("[Explore] 開發模式啟用 — 略過 Discord SDK 與 Socket.IO");
            }
        }
        return isDevMode;
    }

    /** 安全發送 Socket.IO 事件；開發模式或未連線時僅輸出 log */
    function safeEmit(event, data) {
        if (socket && socket.connected) {
            socket.emit(event, data);
        } else if (isDevMode) {
            console.log(`[DevMode] emit '${event}':`, data);
        }
    }

    /** 等待使用者點擊或按鍵後執行回呼 */
    function awaitUserInput(callback) {
        _pendingInputCallback = callback;
    }

    /** 目前地圖是否在忽略清單中（不同步、不加入房間） */
    function isIgnoredMap() {
        return $gameMap && IGNORED_MAPS.includes($gameMap.mapId());
    }

    function getCurrentMapId() {
        if (!$gameMap || typeof $gameMap.mapId !== "function") return null;
        const mapId = Number($gameMap.mapId());
        return Number.isInteger(mapId) && mapId > 0 ? mapId : null;
    }

    function normalizeRemoteMapId(value, fallback = null) {
        const mapId = Number(value);
        if (Number.isInteger(mapId) && mapId > 0) return mapId;
        return fallback;
    }

    function buildJoinPayload() {
        const payload = {
            guild_id: currentGuildId
        };
        const mapId = getCurrentMapId();
        if (mapId != null) {
            payload.map_id = mapId;
        }
        if ($gamePlayer) {
            payload.x = Number($gamePlayer.x);
            payload.y = Number($gamePlayer.y);
            payload.direction = Number($gamePlayer.direction());
            payload.moveSpeed = $gamePlayer.realMoveSpeed();
            payload.moveFrequency = $gamePlayer.moveFrequency();
        }
        return payload;
    }

    function emitJoinCurrentGuild() {
        if (!currentGuildId || isIgnoredMap()) return;
        safeEmit('join', buildJoinPayload());
    }

    let _hintHideTimer = null;
    function showHint(message, duration = 4000) {
        if (typeof HintBar !== "undefined" && HintBar && typeof HintBar.show === "function") {
            HintBar.show(String(message));
            if (_hintHideTimer) {
                clearTimeout(_hintHideTimer);
                _hintHideTimer = null;
            }
            // 自動隱藏,避免提示永遠卡在畫面上;duration<=0 表示常駐
            if (duration > 0) {
                _hintHideTimer = setTimeout(() => {
                    _hintHideTimer = null;
                    if (typeof HintBar !== "undefined" && HintBar && typeof HintBar.hide === "function") {
                        HintBar.hide();
                    }
                }, duration);
            }
        } else {
            console.log(`[Explore] ${message}`);
        }
    }

    function openInviteLink(url) {
        const inviteUrl = String(url || "").trim();
        if (!inviteUrl) return false;
        if (discordSdk && discordSdk.commands && typeof discordSdk.commands.openExternalLink === 'function') {
            discordSdk.commands.openExternalLink({ url: inviteUrl }).catch(e => {
                console.warn('[Explore] openExternalLink failed:', e);
                window.open(inviteUrl, '_blank', 'noopener,noreferrer');
            });
            return true;
        }
        window.open(inviteUrl, '_blank', 'noopener,noreferrer');
        return true;
    }

    function handleMembershipRequired(server) {
        const inviteLink = server && server.invite_link ? String(server.invite_link) : "";
        if (inviteLink) {
            showHint("需要先加入伺服器，正在開啟邀請連結");
            openInviteLink(inviteLink);
        } else {
            showHint("需要先加入伺服器才能進入");
            alert("You must join this server to enter!");
        }
    }

    function normalizeSavableIdList(ids) {
        const normalized = [];
        const seen = new Set();
        for (const rawId of Array.isArray(ids) ? ids : []) {
            const id = Number(rawId);
            if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
            seen.add(id);
            normalized.push(id);
        }
        return normalized;
    }

    function toSaveInteger(value) {
        const number = Number(value);
        return Number.isInteger(number) ? number : null;
    }

    function applyLoadTint() {
        if ($gameScreen && typeof $gameScreen.startTint === "function") {
            $gameScreen.startTint(LOAD_TINT_TONE.slice(), LOAD_TINT_DURATION);
        }
    }

    function makeDefaultLoadSaveData() {
        return {
            map_id: DEFAULT_LOAD_MAP_ID,
            x: DEFAULT_LOAD_X,
            y: DEFAULT_LOAD_Y,
            guild_id: null,
            is_world_map: false,
            switches: {},
            variables: {},
        };
    }

    const ALLOWED_SAVE_SWITCH_IDS = normalizeSavableIdList(SAVABLE_SWITCH_IDS);
    const ALLOWED_SAVE_VARIABLE_IDS = normalizeSavableIdList(SAVABLE_VARIABLE_IDS);

    // --- Discord SDK Setup ---
    async function initDiscordSDK(switchId) {
        HintBar.show("正在初始化...");

        // --- 開發模式：略過 Discord SDK ---
        if (detectDevMode()) {
            myUserId = "dev_user";
            myName = "Developer";
            isWorldMap = true;
            currentGuildId = 'world';
            HintBar.show("開發模式");
            if (switchId) $gameSwitches.setValue(switchId, true);
            return;
        }

        // --- 階段 1：初始化 Discord SDK 並認證 ---
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const instanceParam = urlParams.get('instance_id');
            if (!instanceParam) {
                HintBar.show("缺少 instance_id，無法啟動");
                console.warn("No instance_id query param provided");
                return;
            }

            const guildIdParam = urlParams.get('guild_id');            if (guildIdParam) {
                currentGuildId = guildIdParam;
                isWorldMap = false;
                console.log("Guild ID from query param:", currentGuildId);
            } else {
                isWorldMap = true;
                currentGuildId = 'world';
                console.log("No Guild ID provided, loading World Map");
            }

            HintBar.show("正在取得用戶端資訊...");
            const statusRes = await fetch('/api/status');
            const statusData = await statusRes.json();
            clientId = statusData.id;
            console.log("Client ID fetched:", clientId);

            HintBar.show("正在連線至 Discord...");
            const module = await import('../libs/embedded-app-sdk/index.mjs');
            const { DiscordSDK } = module;
            discordSdk = new DiscordSDK(clientId);
            await discordSdk.ready();
            console.log("Discord SDK Ready");

            HintBar.show("正在登入...");
            const { code } = await discordSdk.commands.authorize({
                client_id: clientId,
                response_type: "code",
                state: "",
                prompt: "none",
                scope: ["identify", "guilds", "rpc.activities.write"],
            });

            const response = await fetch(`/api/explore/authenticate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            auth = await response.json();
            console.log("Authenticated with backend (discord token)", auth);
            await discordSdk.commands.authenticate({ access_token: auth.token });

            HintBar.show("正在取得身份資訊...");
            const tokenRes = await fetch(`/api/explore/auth/discord-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ discord_token: auth.token }),
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.auth_token) {
                HintBar.show("認證失敗");
                console.error("Failed to get explore auth_token", tokenData);
                return;
            }
            exploreAuthToken = tokenData.auth_token;
            console.log("Explore auth_token ready");

            ensureMusicStatePolling();
            fetchMusicState();

            try {
                const meRes = await fetch('/api/explore/me', {
                    headers: { "Authorization": `Bearer ${exploreAuthToken}` }
                });
                const me = await meRes.json();
                if (meRes.ok) myName = me.name;
            } catch (e) {
                console.warn("Failed to fetch /api/explore/me", e);
            }

            HintBar.show("正在連線至伺服器...");
            connectSocket();

            // 初始化完成，設定開關讓事件繼續流程
            HintBar.show("準備完成");
            if (switchId) $gameSwitches.setValue(switchId, true);

        } catch (e) {
            console.error("Failed to initialize Discord SDK", e);
            HintBar.show("初始化失敗: " + (e.message || e));
        }
    }

    async function setActivity(details, guild_name, guild_icon) {
        // Avoid SDK validation errors if SDK isn't ready yet or if RPC rejects the payload.
        if (!discordSdk || !discordSdk.commands || typeof discordSdk.commands.setActivity !== "function") return;

        try {
            await discordSdk.commands.setActivity({
                activity: {
                    type: 0,
                    // state: "",
                    url: "https://discord.com/activities/" + clientId,
                    details: String(details ?? ""),
                    assets: {
                        large_text: "探索空間",
                        large_image: "explore",
                        small_text: String(guild_name ?? "大廳"),
                        small_image: String(guild_icon ?? "lobby"),
                    },
                    timestamps: { start: upTime.getTime() }
                }
            });
        } catch (e) {
            console.warn("Discord setActivity failed:", e);
        }
    }

    function connectSocket() {
        if (typeof io === 'undefined') {
            console.error("Socket.IO not loaded");
            return;
        }

        if (!exploreAuthToken) {
            console.error("Missing exploreAuthToken");
            return;
        }

        socket = io(undefined, {
            // Use default because our url mapping routes /socket.io to the right place
            // path: '/explore/socket.io',
            auth: { token: exploreAuthToken }
        });

        socket.on('connect', () => {
            console.log("Socket connected");
            // 重連時自動重新加入房間（首次連線在等待室不加入）
            emitJoinCurrentGuild();
            fetchMusicState();
        });

        socket.on('joined', (data) => {
            myUserId = data.user_id;
            if (data.level != null) myLevel = Number(data.level);
            if (data.skin_id != null) applySkinToSelf(data.skin_id);
        });

        socket.on('room_state', (data) => {
            // data: { guild_id, players: [...] }
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            const players = Array.isArray(data.players) ? data.players : [];
            replaceRemotePlayerStates(players);
            syncVisiblePlayersFromState();
        });

        socket.on('user_joined', (data) => {
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            console.log("User joined:", data);
            const player = upsertRemotePlayerState(data);
            if (!onlinePlayersVisible || !player) return;
            if (isRemotePlayerOnCurrentMap(player)) {
                spawnPlayer(player);
            } else {
                removePlayer(String(player.user_id));
            }
        });

        socket.on('user_left', (data) => {
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            console.log("User left:", data);
            const uid = data && (data.user_id ?? data.id);
            if (uid != null) {
                removeRemotePlayerState(uid);
                removePlayer(String(uid));
            }
        });

        socket.on('user_moved', (data) => {
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            const player = upsertRemotePlayerState(data);
            if (!onlinePlayersVisible || !player) return;
            if (isRemotePlayerOnCurrentMap(player)) {
                movePlayer(player);
            } else {
                removePlayer(String(player.user_id));
            }
        });

        socket.on('skin_changed', (data) => {
            // data: { guild_id, user_id, skin_id }
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            const player = upsertRemotePlayerState(data);
            if (!onlinePlayersVisible || !player) return;
            const uid = player.user_id;
            if (!isRemotePlayerOnCurrentMap(player)) {
                removePlayer(String(uid));
                return;
            }
            if (!otherPlayers[uid]) {
                spawnPlayer(player);
            }
            const entry = otherPlayers[uid];
            if (!entry) return;
            entry.skin_id = player.skin_id;
            applySkinToCharacter(entry.character, entry.skin_id);
        });

        socket.on('error', (data) => {
            console.error("Socket error:", data);
            if (data.message === 'Membership required') {
                handleMembershipRequired(data);
                currentGuildId = 'world';
                isWorldMap = true;
                decideMapToLoad();
            }
        });

        socket.on('level_up', (data) => {
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            const uid = String(data.user_id);
            const level = Number(data.level);
            if (myUserId && uid === String(myUserId)) {
                myLevel = level;
                showHint(`🎉 升級了!現在是 Lv.${level}`);
                return;
            }
            const player = remotePlayerStates[uid];
            if (player) {
                player.level = level;
                const entry = otherPlayers[uid];
                if (entry) {
                    entry.name = getRemotePlayerDisplayName(player);
                    if (entry.sprite && entry.sprite._exploreNameLabel && entry.sprite._exploreNameLabel.bitmap) {
                        const bitmap = entry.sprite._exploreNameLabel.bitmap;
                        bitmap.clear();
                        bitmap.drawText(entry.name, 0, 0, bitmap.width, bitmap.height, "center");
                    }
                }
            }
        });

        socket.on('map_edited', (data) => {
            // data: { guild_id, x, y, z, tile_id }
            if ($gameMap && typeof $gameMap.setNormalTile === 'function') {
                $gameMap.setNormalTile(data.x, data.y, data.z, Number(data.tile_id));
            }
        });

        // Chat events
        socket.on('chat_message', (data) => {
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            _appendChatMessageDOM(data);
            // 頭頂氣泡(訊息來源是遊戲內玩家且在同地圖才顯示)
            if (data.source !== 'discord') {
                showChatBubble(String(data.user_id), data.text);
            }
        });

        socket.on('chat_history', (data) => {
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            _clearChatMessagesDOM();
            const messages = Array.isArray(data.messages) ? data.messages : [];
            for (const message of messages) {
                _appendChatMessageDOM(message, { silent: true });
            }
            chatUnreadCount = 0;
            _updateChatOverlay();
        });

        socket.on('chat_error', (data) => {
            showHint((data && data.message) || '訊息發送失敗');
        });

        socket.on('user_emote', (data) => {
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            const uid = String(data.user_id);
            if (myUserId && uid === String(myUserId)) return; // 自己已本地播放
            const balloonId = Number(data.balloon_id);
            if (!balloonId) return;
            const entry = otherPlayers[uid];
            if (entry && entry.character && $gameTemp && isRemotePlayerOnCurrentMap(data)) {
                $gameTemp.requestBalloon(entry.character, balloonId);
            }
        });

        // Music events
        socket.on('music_update', (data) => {
            if (!data) return;
            musicState = data;
            _updateMusicOverlay();
        });

        socket.on('music_error', (data) => {
            console.warn('[Music] error:', data && data.message);
        });
    }

    // --- Music API & Player UI ---

    /**
     * Fetch current music state from the server.
     * The server auto-detects which guild/voice-channel the caller is in;
     * no guild_id is needed from the client side.
     */
    async function fetchMusicState() {
        if (socket && socket.connected) {
            socket.emit('music_get');
            return;
        }
        if (!exploreAuthToken) return;
        try {
            const res = await fetch('/api/explore/music', {
                headers: { 'Authorization': `Bearer ${exploreAuthToken}` }
            });
            if (res.status === 404) {
                musicState = { playing: false, available: false };
                _updateMusicOverlay();
                return;
            }
            if (res.ok) {
                const data = await res.json();
                musicState = data;
                _updateMusicOverlay();
            }
        } catch (e) {
            console.error('[Music] fetchMusicState failed:', e);
        }
    }

    function ensureMusicStatePolling() {
        if (musicStatePollTimer != null) return;
        musicStatePollTimer = window.setInterval(() => {
            if (!exploreAuthToken) return;
            fetchMusicState();
        }, 5000);
    }

    /**
     * Send a music control action.
     * Prefers Socket.IO (server verifies voice-channel); falls back to REST PATCH.
     * @param {string} action  next | pause | play | seek | recommend
     * @param {*}      [data]  seek=seconds, recommend=count, others=null
     */
    function musicAction(action, data = null) {
        if (socket && socket.connected) {
            // Server auto-detects guild from caller's voice channel — no guild_id needed
            socket.emit('music_action', { action, data });
            return;
        }
        if (!exploreAuthToken) return;
        fetch('/api/explore/music', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${exploreAuthToken}`
            },
            body: JSON.stringify({ action, data })
        }).then(res => { if (res.ok) fetchMusicState(); })
          .catch(e => console.error('[Music] action failed:', e));
    }

    /** Stop music via REST DELETE (server auto-detects guild from caller's voice channel). */
    async function stopMusic() {
        if (!exploreAuthToken) return;
        try {
            await fetch('/api/explore/music', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${exploreAuthToken}` }
            });
            musicState = null;
            _updateMusicOverlay();
        } catch (e) {
            console.error('[Music] stopMusic failed:', e);
        }
    }

    function _musicLauncherIcon() {
        return musicState && musicState.thumbnail ? String(musicState.thumbnail) : '';
    }

    function _shouldShowMusicLauncher() {
        return !!(musicState && musicState.available);
    }

    /** 防止面板上的按鈕搶走鍵盤焦點(避免 Enter/空白鍵重複觸發按鈕、遊戲按鍵失效);INPUT 除外 */
    function _preventFocusSteal(shell) {
        shell.addEventListener('mousedown', (ev) => {
            const target = ev.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
            ev.preventDefault();
        });
        // 觸控等其他途徑萬一還是聚焦了,點完立刻放掉焦點
        shell.addEventListener('click', (ev) => {
            const target = ev.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
            const active = document.activeElement;
            if (active && active !== document.body && shell.contains(active)) {
                active.blur();
            }
        });
    }

    /** Create the music overlay DOM element if it doesn't exist yet. */
    function _ensureMusicOverlayDOM() {
        if (document.getElementById('explore-music-shell')) return;
        const shell = document.createElement('div');
        shell.id = 'explore-music-shell';
        shell.style.cssText = [
            'position:fixed', 'left:14px', 'bottom:14px',
            'z-index:9999', 'display:none',
            'pointer-events:none', 'font-family:sans-serif',
            'user-select:none'
        ].join(';');
        shell.innerHTML = `
<div id="explore-music-overlay" style="position:relative;width:300px;max-width:calc(100vw - 28px);background:linear-gradient(135deg, rgba(12,18,30,0.96), rgba(27,38,60,0.92));color:#fff;border-radius:18px;padding:14px 14px 12px 14px;box-shadow:0 18px 38px rgba(0,0,0,0.42);backdrop-filter:blur(10px);transform:translateX(calc(-100% - 12px));opacity:0;transition:transform 220ms ease, opacity 220ms ease;pointer-events:auto;border:1px solid rgba(255,255,255,0.09)">
  <div id="emp-info" style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
    <img id="emp-thumb" src="" style="width:46px;height:46px;border-radius:10px;object-fit:cover;display:none;flex-shrink:0;box-shadow:0 6px 16px rgba(0,0,0,0.28)"/>
    <div id="emp-fallback-icon" style="width:46px;height:46px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.11);font-size:22px">🎵</div>
    <div style="overflow:hidden;min-width:0">
      <div id="emp-title" style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3"></div>
      <div id="emp-author" style="opacity:0.68;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px"></div>
    </div>
  </div>
  <div style="display:flex;gap:6px;justify-content:flex-start;align-items:center">
    <button id="emp-btn-play" title="Play / Pause" style="background:rgba(255,255,255,0.16);border:none;color:#fff;border-radius:8px;padding:6px 11px;cursor:pointer;font-size:13px">▶</button>
    <button id="emp-btn-next" title="Next" style="background:rgba(255,255,255,0.12);border:none;color:#fff;border-radius:8px;padding:6px 11px;cursor:pointer;font-size:13px">⏭</button>
    <button id="emp-btn-stop" title="Stop" style="background:rgba(255,255,255,0.12);border:none;color:#fff;border-radius:8px;padding:6px 11px;cursor:pointer;font-size:13px">⏹</button>
    <button id="emp-btn-rec" title="Recommend×5" style="background:rgba(255,255,255,0.12);border:none;color:#fff;border-radius:8px;padding:6px 11px;cursor:pointer;font-size:13px">🎯</button>
  </div>
</div>
<button id="explore-music-toggle" title="Music Player" style="position:absolute;left:0;bottom:0;width:52px;height:52px;border:none;border-radius:16px;background:linear-gradient(135deg, rgba(255,255,255,0.2), rgba(92,169,255,0.26));box-shadow:0 14px 28px rgba(0,0,0,0.3);cursor:pointer;pointer-events:auto;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:0;transition:transform 220ms ease, border-radius 220ms ease, box-shadow 220ms ease;border:1px solid rgba(255,255,255,0.12)">
  <img id="emp-toggle-thumb" src="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none"/>
  <span id="emp-toggle-icon" style="position:relative;font-size:22px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,0.35)">🎵</span>
</button>`;
        document.body.appendChild(shell);
        _preventFocusSteal(shell);

        document.getElementById('emp-btn-play').onclick = () => {
            musicState && musicState.is_paused ? musicAction('play') : musicAction('pause');
        };
        document.getElementById('emp-btn-next').onclick = () => musicAction('next');
        document.getElementById('emp-btn-stop').onclick = () => stopMusic();
        document.getElementById('emp-btn-rec').onclick = () => musicAction('recommend', 5);
        document.getElementById('emp-title').onclick = () => {
            if (!musicState || !musicState.playing || !musicState.url) return;
            if (discordSdk && discordSdk.commands && typeof discordSdk.commands.openExternalLink === 'function') {
                discordSdk.commands.openExternalLink({ url: musicState.url }).catch(e => {
                    console.warn('[Music] openExternalLink failed:', e);
                });
            } else {
                // Dev mode fallback
                window.open(musicState.url, '_blank', 'noopener,noreferrer');
            }
        };
        document.getElementById('explore-music-toggle').onclick = () => {
            musicUiVisible = !musicUiVisible;
            if (musicUiVisible) fetchMusicState();
            _updateMusicOverlay();
        };
    }

    /** Refresh the music overlay display based on current musicState. */
    function _updateMusicOverlay() {
        _ensureMusicOverlayDOM();
        const shell = document.getElementById('explore-music-shell');
        const drawer = document.getElementById('explore-music-overlay');
        const launcher = document.getElementById('explore-music-toggle');
        const titleEl = document.getElementById('emp-title');
        const authorEl = document.getElementById('emp-author');
        const thumbEl = document.getElementById('emp-thumb');
        const fallbackEl = document.getElementById('emp-fallback-icon');
        const playBtn = document.getElementById('emp-btn-play');
        const toggleThumb = document.getElementById('emp-toggle-thumb');
        const toggleIcon = document.getElementById('emp-toggle-icon');
        if (!shell || !drawer || !launcher) return;

        if (!_shouldShowMusicLauncher()) {
            shell.style.display = 'none';
            musicUiVisible = false;
            return;
        }

        shell.style.display = 'block';
        drawer.style.transform = musicUiVisible ? 'translateX(0)' : 'translateX(calc(-100% - 12px))';
        drawer.style.opacity = musicUiVisible ? '1' : '0';
        launcher.style.transform = musicUiVisible ? 'translateX(248px) scale(0.98)' : 'translateX(0) scale(1)';
        launcher.style.borderRadius = musicUiVisible ? '14px' : '16px';
        launcher.style.boxShadow = musicUiVisible
            ? '0 16px 30px rgba(0,0,0,0.38)'
            : '0 14px 28px rgba(0,0,0,0.3)';

        if (titleEl) {
            titleEl.textContent = musicState.playing ? (musicState.title || 'Unknown') : 'Voice Ready';
            const hasLink = musicState.playing && !!musicState.url;
            titleEl.style.cursor = hasLink ? 'pointer' : 'default';
            titleEl.style.textDecoration = hasLink ? 'underline dotted rgba(255,255,255,0.35)' : 'none';
            titleEl.title = hasLink ? musicState.url : '';
        }
        if (authorEl) authorEl.textContent = musicState.playing ? (musicState.author || '') : 'Open player controls';
        if (thumbEl) {
            if (musicState.thumbnail) {
                thumbEl.src = musicState.thumbnail;
                thumbEl.style.display = '';
                if (fallbackEl) fallbackEl.style.display = 'none';
            } else {
                thumbEl.style.display = 'none';
                if (fallbackEl) fallbackEl.style.display = 'flex';
            }
        }
        const launcherIcon = _musicLauncherIcon();
        if (toggleThumb) {
            if (launcherIcon) {
                toggleThumb.src = launcherIcon;
                toggleThumb.style.display = 'block';
                if (toggleIcon) toggleIcon.style.opacity = '0';
            } else {
                toggleThumb.style.display = 'none';
                if (toggleIcon) toggleIcon.style.opacity = '1';
            }
        }
        if (playBtn) playBtn.textContent = musicState.is_paused ? '▶' : '⏸';
    }

    /** Hide the overlay element without changing musicUiVisible. */
    function _hideMusicOverlay() {
        musicUiVisible = false;
        _updateMusicOverlay();
    }

    // --- Chat UI (DOM overlay, bottom-right) ---

    let chatUiVisible = false;
    let chatUnreadCount = 0;
    const CHAT_EMOTES = [
        { balloon: 1, icon: "❗" },
        { balloon: 2, icon: "❓" },
        { balloon: 4, icon: "❤️" },
        { balloon: 3, icon: "🎵" },
        { balloon: 6, icon: "💦" },
        { balloon: 7, icon: "😵" },
        { balloon: 11, icon: "💤" },
    ];

    function _escapeChatHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function _ensureChatOverlayDOM() {
        if (document.getElementById('explore-chat-shell')) return;
        const shell = document.createElement('div');
        shell.id = 'explore-chat-shell';
        shell.style.cssText = [
            'position:fixed', 'right:14px', 'bottom:14px',
            'z-index:9998', 'display:none',
            'pointer-events:none', 'font-family:sans-serif',
        ].join(';');
        shell.innerHTML = `
<div id="explore-chat-panel" style="position:relative;width:340px;max-width:calc(100vw - 28px);margin-bottom:64px;background:linear-gradient(135deg, rgba(12,18,30,0.96), rgba(27,38,60,0.92));color:#fff;border-radius:18px;padding:12px;box-shadow:0 18px 38px rgba(0,0,0,0.42);backdrop-filter:blur(10px);transform:translateX(calc(100% + 12px));opacity:0;transition:transform 220ms ease, opacity 220ms ease;pointer-events:auto;border:1px solid rgba(255,255,255,0.09)">
  <div style="font-weight:700;font-size:13px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
    <span>💬 聊天室</span>
    <span id="ec-room" style="opacity:0.6;font-size:11px;font-weight:400"></span>
  </div>
  <div id="ec-messages" style="height:200px;overflow-y:auto;font-size:13px;line-height:1.5;display:flex;flex-direction:column;gap:4px;margin-bottom:8px;scrollbar-width:thin"></div>
  <div id="ec-emotes" style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap"></div>
  <div style="display:flex;gap:6px">
    <input id="ec-input" type="text" maxlength="200" placeholder="說點什麼..." style="flex:1;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.14);color:#fff;border-radius:8px;padding:7px 10px;font-size:13px;outline:none"/>
    <button id="ec-send" style="background:rgba(92,169,255,0.35);border:none;color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px">送出</button>
  </div>
</div>
<button id="explore-chat-toggle" title="聊天室" style="position:absolute;right:0;bottom:0;width:52px;height:52px;border:1px solid rgba(255,255,255,0.12);border-radius:16px;background:linear-gradient(135deg, rgba(255,255,255,0.2), rgba(92,255,169,0.26));box-shadow:0 14px 28px rgba(0,0,0,0.3);cursor:pointer;pointer-events:auto;display:flex;align-items:center;justify-content:center;padding:0;transition:transform 220ms ease">
  <span style="position:relative;font-size:22px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,0.35)">💬</span>
  <span id="ec-badge" style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:#ff4d5e;color:#fff;font-size:11px;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 4px">0</span>
</button>`;
        document.body.appendChild(shell);
        _preventFocusSteal(shell);

        // 防止點擊面板穿透到遊戲(TouchInput 在 document 上監聽)
        for (const evName of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) {
            shell.addEventListener(evName, (ev) => ev.stopPropagation());
        }

        const input = document.getElementById('ec-input');
        // 阻止 RMMZ 攔截打字(WASD 移動、Enter 確認等)
        for (const evName of ['keydown', 'keyup', 'keypress']) {
            input.addEventListener(evName, (ev) => {
                ev.stopPropagation();
                if (evName === 'keydown' && ev.key === 'Enter') {
                    _sendChatFromInput();
                }
                if (evName === 'keydown' && ev.key === 'Escape') {
                    input.blur();
                }
            });
        }
        document.getElementById('ec-send').onclick = () => _sendChatFromInput();
        document.getElementById('explore-chat-toggle').onclick = () => {
            chatUiVisible = !chatUiVisible;
            if (chatUiVisible) {
                chatUnreadCount = 0;
            } else {
                input.blur();
            }
            _updateChatOverlay();
        };

        const emoteRow = document.getElementById('ec-emotes');
        for (const emote of CHAT_EMOTES) {
            const btn = document.createElement('button');
            btn.textContent = emote.icon;
            btn.style.cssText = 'background:rgba(255,255,255,0.1);border:none;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:15px';
            btn.onclick = () => sendEmote(emote.balloon);
            emoteRow.appendChild(btn);
        }
    }

    function _shouldShowChatLauncher() {
        return !!(socket && socket.connected && currentGuildId && !isIgnoredMap()) || isDevMode;
    }

    function _updateChatOverlay() {
        _ensureChatOverlayDOM();
        const shell = document.getElementById('explore-chat-shell');
        const panel = document.getElementById('explore-chat-panel');
        const launcher = document.getElementById('explore-chat-toggle');
        const badge = document.getElementById('ec-badge');
        const room = document.getElementById('ec-room');
        if (!shell || !panel || !launcher) return;

        if (!_shouldShowChatLauncher()) {
            shell.style.display = 'none';
            chatUiVisible = false;
            return;
        }

        shell.style.display = 'block';
        panel.style.transform = chatUiVisible ? 'translateX(0)' : 'translateX(calc(100% + 12px))';
        panel.style.opacity = chatUiVisible ? '1' : '0';
        panel.style.pointerEvents = chatUiVisible ? 'auto' : 'none';
        launcher.style.transform = chatUiVisible ? 'scale(0.98)' : 'scale(1)';
        if (room) room.textContent = String(currentGuildId) === 'world' ? '大廳' : '';
        if (badge) {
            badge.style.display = (!chatUiVisible && chatUnreadCount > 0) ? 'flex' : 'none';
            badge.textContent = String(Math.min(chatUnreadCount, 99));
        }
    }

    function _appendChatMessageDOM(message, options = {}) {
        _ensureChatOverlayDOM();
        const list = document.getElementById('ec-messages');
        if (!list) return;

        const isMe = myUserId && String(message.user_id) === String(myUserId);
        const fromDiscord = message.source === 'discord';
        const row = document.createElement('div');
        const levelTag = message.level != null ? `Lv.${Number(message.level)} ` : '';
        const sourceTag = fromDiscord ? '<span style="opacity:0.75">[DC]</span> ' : '';
        const nameColor = isMe ? '#8fd0ff' : (fromDiscord ? '#a0e8af' : '#ffd27d');
        row.innerHTML = `${sourceTag}<span style="color:${nameColor};font-weight:700">${_escapeChatHtml(levelTag + (message.name || message.user_id))}</span>: ${_escapeChatHtml(message.text || '')}`;
        list.appendChild(row);
        while (list.children.length > 80) list.removeChild(list.firstChild);
        list.scrollTop = list.scrollHeight;

        if (!chatUiVisible && !options.silent) {
            chatUnreadCount++;
        }
        _updateChatOverlay();
    }

    function _clearChatMessagesDOM() {
        const list = document.getElementById('ec-messages');
        if (list) list.innerHTML = '';
    }

    function _sendChatFromInput() {
        const input = document.getElementById('ec-input');
        if (!input) return;
        const text = String(input.value || '').trim();
        if (!text) return;
        input.value = '';
        if (isDevMode) {
            _appendChatMessageDOM({ user_id: myUserId, name: myName || 'Dev', text, level: myLevel }, { silent: true });
            return;
        }
        safeEmit('chat_send', { guild_id: currentGuildId, text });
    }

    function sendEmote(balloonId) {
        if ($gamePlayer && $gameTemp) {
            $gameTemp.requestBalloon($gamePlayer, Number(balloonId));
        }
        safeEmit('emote', { guild_id: currentGuildId, map_id: getCurrentMapId(), balloon_id: Number(balloonId) });
    }

    // --- Overhead chat bubbles ---

    function _findSpriteForUserId(userId) {
        const entry = otherPlayers[String(userId)];
        if (entry && entry.sprite) return entry.sprite;
        if (entry && entry.character) {
            const scene = SceneManager._scene;
            const spriteset = scene && scene._spriteset;
            if (spriteset && Array.isArray(spriteset._characterSprites)) {
                return spriteset._characterSprites.find(s => s && s._character === entry.character) || null;
            }
        }
        return null;
    }

    function _findMySprite() {
        const scene = SceneManager._scene;
        const spriteset = scene && scene._spriteset;
        if (spriteset && Array.isArray(spriteset._characterSprites)) {
            return spriteset._characterSprites.find(s => s && s._character === $gamePlayer) || null;
        }
        return null;
    }

    function showChatBubble(userId, text) {
        const sprite = (myUserId && String(userId) === String(myUserId)) ? _findMySprite() : _findSpriteForUserId(userId);
        if (!sprite) return;

        // 移除舊氣泡
        if (sprite._exploreChatBubble) {
            if (sprite._exploreChatBubble.parent) {
                sprite._exploreChatBubble.parent.removeChild(sprite._exploreChatBubble);
            }
            sprite._exploreChatBubble = null;
        }

        let display = String(text || '');
        if (display.length > 30) display = display.slice(0, 30) + '…';

        const bitmap = new Bitmap(260, 34);
        bitmap.fontSize = 15;
        const textWidth = Math.min(bitmap.measureTextWidth(display) + 16, 256);
        bitmap.fillRoundRect
            ? bitmap.fillRoundRect((260 - textWidth) / 2, 2, textWidth, 26, 8, "rgba(0,0,0,0.66)")
            : bitmap.fillRect((260 - textWidth) / 2, 2, textWidth, 26, "rgba(0,0,0,0.66)");
        bitmap.textColor = "#ffffff";
        bitmap.outlineWidth = 0;
        bitmap.drawText(display, 0, 0, 260, 30, "center");

        const bubble = new Sprite(bitmap);
        bubble.anchor.x = 0.5;
        bubble.anchor.y = 1;
        bubble.y = -62; // 名字標籤上方
        sprite.addChild(bubble);
        sprite._exploreChatBubble = bubble;
        bubble._exploreExpireFrame = Graphics.frameCount + 240; // 約 4 秒
    }

    const _Sprite_Character_update = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function () {
        _Sprite_Character_update.call(this);
        const bubble = this._exploreChatBubble;
        if (bubble && bubble._exploreExpireFrame != null && Graphics.frameCount >= bubble._exploreExpireFrame) {
            if (bubble.parent) bubble.parent.removeChild(bubble);
            this._exploreChatBubble = null;
        }
    };

    // --- Plugin Commands (RPG Maker MZ) ---
    // These are the commands you can call from event commands.
    // Menu entries below also call these to stay in sync.

    PluginManager.registerCommand(PLUGIN_NAME, "OpenServerList", function () {
        SceneManager.push(Scene_ExploreServerList);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "ChangeSkin", function () {
        SceneManager.push(Scene_ExploreSkinList);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "LeaveSpace", function () {
        leaveSpace();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "ShowOnlinePlayers", function () {
        showOnlinePlayers();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "HideOnlinePlayers", function () {
        hideOnlinePlayers();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "SaveData", function () {
        saveExploreSaveData();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "LoadData", function () {
        loadExploreSaveData();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "FetchMusicState", function () {
        fetchMusicState();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "MusicAction", function (args) {
        const raw = args.data != null ? String(args.data).trim() : null;
        const parsed = raw && raw !== '' ? (isNaN(raw) ? raw : Number(raw)) : null;
        musicAction(String(args.action || 'pause'), parsed);
    });

    PluginManager.registerCommand(PLUGIN_NAME, "StopMusic", function () {
        stopMusic();
    });

    PluginManager.registerCommand(PLUGIN_NAME, "ShowMusicPlayer", function () {
        musicUiVisible = true;
        fetchMusicState();  // always refresh; server auto-detects voice channel
    });

    PluginManager.registerCommand(PLUGIN_NAME, "HideMusicPlayer", function () {
        musicUiVisible = false;
        _hideMusicOverlay();
    });

    // --- Quests (server-verified, one-time) ---
    // 開關對應:11=鼠患 12=快遞 13=高麗菜 14=Boss出現(前置全完成) 15=Boss討伐
    // 變數對應:11=本次獎勵全域幣 12=本次獎勵XP

    const QUEST_SWITCH_MAP = {
        vill_rat: 11,
        vill_delivery: 12,
        vill_cabbage: 13,
        vill_boss: 15,
    };
    const QUEST_BOSS_READY_SWITCH = 14;
    const QUEST_REWARD_COIN_VAR = 11;
    const QUEST_REWARD_XP_VAR = 12;
    const VILL_BOSS_PREREQS = ["vill_rat", "vill_delivery", "vill_cabbage"];

    function applyQuestStateToSwitches(state) {
        if (!$gameSwitches || !state) return;
        const completed = new Set(state.completed || []);
        for (const questId of Object.keys(QUEST_SWITCH_MAP)) {
            $gameSwitches.setValue(QUEST_SWITCH_MAP[questId], completed.has(questId));
        }
        const bossReady = state.vill_boss_ready != null
            ? !!state.vill_boss_ready
            : VILL_BOSS_PREREQS.every(q => completed.has(q));
        $gameSwitches.setValue(QUEST_BOSS_READY_SWITCH, bossReady);
    }

    async function syncQuestSwitches() {
        if (isDevMode) {
            // 開發模式:由目前開關推算 Boss ready
            if ($gameSwitches) {
                const ready = [11, 12, 13].every(id => $gameSwitches.value(id));
                $gameSwitches.setValue(QUEST_BOSS_READY_SWITCH, ready);
            }
            return;
        }
        if (!exploreAuthToken) return;
        try {
            const res = await fetch('/api/explore/quests', {
                headers: { 'Authorization': `Bearer ${exploreAuthToken}` }
            });
            const data = await res.json();
            if (res.ok) {
                applyQuestStateToSwitches(data);
                if (data.level != null) myLevel = Number(data.level);
            }
        } catch (e) {
            console.error('Failed to sync quest switches', e);
        }
    }

    async function completeQuestRequest(questId) {
        if ($gameVariables) {
            $gameVariables.setValue(QUEST_REWARD_COIN_VAR, 0);
            $gameVariables.setValue(QUEST_REWARD_XP_VAR, 0);
        }

        if (isDevMode) {
            const switchId = QUEST_SWITCH_MAP[questId];
            if (switchId && $gameSwitches) $gameSwitches.setValue(switchId, true);
            if ($gameVariables) {
                $gameVariables.setValue(QUEST_REWARD_COIN_VAR, 30);
                $gameVariables.setValue(QUEST_REWARD_XP_VAR, 50);
            }
            await syncQuestSwitches();
            showHint(`[Dev] 任務 ${questId} 完成`);
            return true;
        }

        if (!exploreAuthToken) {
            showHint('尚未連線,無法完成任務');
            return false;
        }
        try {
            const res = await fetch('/api/explore/quests/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${exploreAuthToken}`
                },
                body: JSON.stringify({ quest_id: questId })
            });
            const data = await res.json();
            if (!res.ok) {
                showHint(data.error || '任務完成失敗');
                return false;
            }
            if ($gameVariables) {
                $gameVariables.setValue(QUEST_REWARD_COIN_VAR, Number(data.coins || 0));
                $gameVariables.setValue(QUEST_REWARD_XP_VAR, Number(data.xp_gained || 0));
            }
            if (data.level != null) myLevel = Number(data.level);
            applyQuestStateToSwitches({ completed: data.completed_quests || [] });
            showHint(`✅ ${data.name || questId} 完成!獲得 ${data.coins || 0} 全域幣、${data.xp_gained || 0} XP`);
            return true;
        } catch (e) {
            console.error('Failed to complete quest', e);
            showHint('任務完成失敗(連線錯誤)');
            return false;
        }
    }

    PluginManager.registerCommand(PLUGIN_NAME, "CompleteQuest", function (args) {
        const questId = String(args.questId || '').trim();
        if (!questId) return;
        // 阻塞事件直到伺服器回應,讓後續分歧能讀到開關/變數
        this._exploreQuestWaiting = true;
        this.setWaitMode('exploreQuest');
        completeQuestRequest(questId).finally(() => {
            this._exploreQuestWaiting = false;
        });
    });

    PluginManager.registerCommand(PLUGIN_NAME, "SyncQuestSwitches", function () {
        this._exploreQuestWaiting = true;
        this.setWaitMode('exploreQuest');
        syncQuestSwitches().finally(() => {
            this._exploreQuestWaiting = false;
        });
    });

    const _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function () {
        if (this._waitMode === 'exploreQuest') {
            if (this._exploreQuestWaiting) return true;
            this._waitMode = '';
            return false;
        }
        return _Game_Interpreter_updateWaitMode.call(this);
    };

    function leaveSpace() {
        safeEmit('leave', { guild_id: currentGuildId });
        clearOtherPlayers();
        remotePlayerStates = {};

        currentGuildId = 'world';
        isWorldMap = true;
        pendingSpaceTiles = null;

        if ($gamePlayer) {
            $gamePlayer.reserveTransfer(MAP_WORLD, 8, 6, 2, 0);
            $gamePlayer.requestMapReload();
        }

        fetchMapData();
        // 'join' 會在 onMapLoaded 中自動發送
    }

    function collectSavableSwitches() {
        const snapshot = {};
        if (!$gameSwitches) return snapshot;

        for (const switchId of ALLOWED_SAVE_SWITCH_IDS) {
            snapshot[String(switchId)] = !!$gameSwitches.value(switchId);
        }
        return snapshot;
    }

    function collectSavableVariables() {
        const snapshot = {};
        if (!$gameVariables) return snapshot;

        for (const variableId of ALLOWED_SAVE_VARIABLE_IDS) {
            const value = $gameVariables.value(variableId);
            snapshot[String(variableId)] = value === undefined ? null : value;
        }
        return snapshot;
    }

    function buildExploreSavePayload() {
        if (!$gamePlayer || !$gameMap) return null;

        return {
            map_id: Number($gameMap.mapId()),
            x: Number($gamePlayer.x),
            y: Number($gamePlayer.y),
            guild_id: currentGuildId != null ? String(currentGuildId) : null,
            is_world_map: !!isWorldMap,
            switches: collectSavableSwitches(),
            variables: collectSavableVariables(),
        };
    }

    function applySavedSwitches(savedSwitches) {
        if (!$gameSwitches || !savedSwitches || typeof savedSwitches !== "object") return;

        for (const switchId of ALLOWED_SAVE_SWITCH_IDS) {
            const key = String(switchId);
            if (!Object.prototype.hasOwnProperty.call(savedSwitches, key)) continue;
            $gameSwitches.setValue(switchId, !!savedSwitches[key]);
        }
    }

    function applySavedVariables(savedVariables) {
        if (!$gameVariables || !savedVariables || typeof savedVariables !== "object") return;

        for (const variableId of ALLOWED_SAVE_VARIABLE_IDS) {
            const key = String(variableId);
            if (!Object.prototype.hasOwnProperty.call(savedVariables, key)) continue;
            $gameVariables.setValue(variableId, savedVariables[key]);
        }
    }

    function resolveLoadedSaveContext(saveData, mapId) {
        if (mapId === MAP_WORLD) {
            return { mapId, guildId: "world", isWorldMap: true };
        }

        if (mapId === MAP_SPACE) {
            const savedGuildId = saveData && saveData.guild_id != null ? String(saveData.guild_id) : null;
            const activeGuildId = currentGuildId != null ? String(currentGuildId) : null;
            const guildId = savedGuildId && savedGuildId !== "world"
                ? savedGuildId
                : (activeGuildId && activeGuildId !== "world" ? activeGuildId : null);
            if (guildId) {
                return { mapId, guildId, isWorldMap: false };
            }
        }

        return null;
    }

    function applySavedLocation(saveData) {
        if (!$gamePlayer) return false;

        const mapId = toSaveInteger(saveData && saveData.map_id);
        const x = toSaveInteger(saveData && saveData.x);
        const y = toSaveInteger(saveData && saveData.y);
        if (!mapId || x === null || y === null) return false;

        pendingSpaceTiles = null;
        pendingLoadedSaveContext = resolveLoadedSaveContext(saveData, mapId);

        if (pendingLoadedSaveContext) {
            currentGuildId = pendingLoadedSaveContext.guildId;
            isWorldMap = pendingLoadedSaveContext.isWorldMap;
        } else {
            currentGuildId = null;
            isWorldMap = false;
        }

        $gamePlayer.reserveTransfer(mapId, x, y, $gamePlayer.direction(), 0);
        $gamePlayer.requestMapReload();
        return true;
    }

    async function saveExploreSaveData() {
        try {
            if (!exploreAuthToken) {
                showHint("尚未連線 Explore，無法保存存檔");
                return false;
            }

            const payload = buildExploreSavePayload();
            if (!payload) {
                showHint("目前無法取得玩家位置，無法保存存檔");
                return false;
            }

            const response = await fetch(SAVE_DATA_API_PATH, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${exploreAuthToken}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok) {
                showHint(`保存失敗: ${data.error || response.statusText}`);
                return false;
            }

            showHint("存檔已保存");
            return true;
        } catch (error) {
            console.error("Failed to save explore data", error);
            showHint(`保存失敗: ${error.message || error}`);
            return false;
        }
    }

    async function loadExploreSaveData() {
        try {
            if (!exploreAuthToken) {
                showHint("尚未連線 Explore，無法載入存檔");
                return false;
            }

            const response = await fetch(SAVE_DATA_API_PATH, {
                headers: {
                    "Authorization": `Bearer ${exploreAuthToken}`,
                },
            });
            const data = await response.json();

            if (!response.ok) {
                showHint(`載入失敗: ${data.error || response.statusText}`);
                return false;
            }

            const saveData = data.has_save ? data : makeDefaultLoadSaveData();

            applySavedSwitches(saveData.switches);
            applySavedVariables(saveData.variables);
            const moved = applySavedLocation(saveData);
            applyLoadTint();

            if (data.has_save) {
                showHint(moved ? "存檔已載入" : "存檔已載入（未移動位置）");
            } else {
                showHint(moved ? "沒有存檔，已移動到預設位置" : "沒有存檔，已套用預設位置");
            }
            return true;
        } catch (error) {
            console.error("Failed to load explore data", error);
            showHint(`載入失敗: ${error.message || error}`);
            return false;
        }
    }

    function decideMapToLoad() {
        // In a real implementation, you would map guild_id to a specific MapID in RPG Maker
        // or generate the map dynamically.
        // For this prototype, let's assume:
        // Map 1 = World Map
        // Map 2 = Generic Server Template

        const mapId = isWorldMap ? MAP_WORLD : MAP_SPACE;
        if ($gamePlayer) {
            if (isWorldMap) {
                $gamePlayer.reserveTransfer(mapId, 8, 6, 2, 0);
            } else {
                $gamePlayer.reserveTransfer(mapId, 11, 11, 8, 0);
            }
            $gamePlayer.requestMapReload();
        }

        // World map still uses legacy endpoints; space uses new tiles endpoint.
        fetchMapData();
    }

    function fetchMapData() {
        if (isWorldMap) {
            setActivity("在大廳", "大廳", "lobby");
            canEditCurrentSpace = false;
            isEditMode = false;
            _updateEditorToolbar();
            return;
        }

        // Fetch guild info for activity
        fetch(`/api/explore/server/${currentGuildId}`, {
            headers: { "Authorization": `Bearer ${exploreAuthToken}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    console.error(data.error);
                    return;
                }
                const guild_name = data.name || "未知伺服器";
                const guild_icon = data.icon_url || "lobby";
                setActivity(`在 ${guild_name} 的空間`, guild_name, guild_icon);
                canEditCurrentSpace = !!data.can_edit;
                if (!canEditCurrentSpace) isEditMode = false;
                _updateEditorToolbar();
            })
            .catch(e => console.error("Failed to fetch guild info", e));

        // Space: fetch tiles list and apply on map loaded
        fetch(`/api/explore/space/${currentGuildId}`, {
            headers: { "Authorization": `Bearer ${exploreAuthToken}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    console.error(data.error);
                    return;
                }
                pendingSpaceTiles = data.tiles || [];
                // If map already exists, apply immediately; otherwise wait for onMapLoaded.
                if ($gameMap && typeof $gameMap.setNormalTile === 'function') {
                    applySpaceTiles();
                }
            })
            .catch(e => console.error("Failed to fetch space tiles", e));
    }


    function setupGuildMap(data) {
        // Legacy
        console.log("Guild Map Data:", data);
    }

    function applySpaceTiles() {
        if (!pendingSpaceTiles || !$gameMap || typeof $gameMap.setNormalTile !== 'function') return;
        // OcRam API expects numeric tile id.
        for (const t of pendingSpaceTiles) {
            $gameMap.setNormalTile(t.x, t.y, t.z, Number(t.tile_id));
        }
        pendingSpaceTiles = null;
        if (SceneManager._scene && SceneManager._scene._spriteset && SceneManager._scene._spriteset._tilemap) {
            SceneManager._scene._spriteset._tilemap.refresh();
        }
    }

    // --- Remote Players (Game_Character + Sprite_Character) ---

    function getFallbackCharacterImage() {
        const fallbackName = ($gamePlayer && $gamePlayer._characterName) ? $gamePlayer._characterName : "Actor1";
        const fallbackIndex = ($gamePlayer && Number.isInteger($gamePlayer._characterIndex)) ? $gamePlayer._characterIndex : 0;
        return { characterName: fallbackName, characterIndex: fallbackIndex };
    }

    function parseSkinId(skinId) {
        // Skin id format: "<CharacterSheet>:<index>", e.g. "Actor1:3".
        const raw = String(skinId || "").trim();
        if (!raw) return null;
        const parts = raw.split(":");
        if (parts.length !== 2) return null;
        const sheet = parts[0].trim();
        const index = Number(parts[1]);
        if (!sheet || !Number.isInteger(index) || index < 0 || index > 7) return null;
        return { characterName: sheet, characterIndex: index };
    }

    function getCharacter(skinId) {
        const parsed = parseSkinId(skinId);
        if (parsed) return parsed;
        return getFallbackCharacterImage();
    }

    function applySkinToSelf(skinId) {
        // Apply to actor 1 so menus/save data stay consistent, then refresh the player.
        const parsed = parseSkinId(skinId);
        if (!parsed) return;
        const actor = $gameActors && $gameActors.actor(1);
        if (actor) {
            actor.setCharacterImage(parsed.characterName, parsed.characterIndex);
        }
        if ($gamePlayer) {
            $gamePlayer.refresh();
        }
    }

    function applySkinToCharacter(character, skinId) {
        if (!character) return;
        const { characterName, characterIndex } = getCharacter(skinId);
        character.setImage(characterName, characterIndex);
    }

    function normalizeRemotePlayerState(user, fallback = {}) {
        if (!user && !fallback) return null;
        const uid = (user && (user.user_id ?? user.id)) ?? fallback.user_id ?? fallback.id;
        if (uid == null) return null;

        return {
            user_id: String(uid),
            id: String(uid),
            name: (user && user.name) ?? fallback.name ?? null,
            skin_id: user && user.skin_id != null ? String(user.skin_id) : (fallback.skin_id ?? null),
            level: (user && user.level != null) ? Number(user.level) : (fallback.level ?? null),
            map_id: normalizeRemoteMapId((user && user.map_id) ?? fallback.map_id, getCurrentMapId()),
            x: Number((user && user.x) ?? fallback.x ?? 11),
            y: Number((user && user.y) ?? fallback.y ?? 11),
            direction: user && user.direction != null ? Number(user.direction) : (fallback.direction ?? null),
            moveSpeed: (user && user.moveSpeed) ?? fallback.moveSpeed ?? null,
            moveFrequency: (user && user.moveFrequency) ?? fallback.moveFrequency ?? null,
        };
    }

    function upsertRemotePlayerState(user) {
        const existing = user ? remotePlayerStates[String(user.user_id ?? user.id)] : null;
        const normalized = normalizeRemotePlayerState(user, existing || {});
        if (!normalized) return null;
        if (myUserId && normalized.user_id === String(myUserId)) return null;
        remotePlayerStates[normalized.user_id] = normalized;
        return normalized;
    }

    function replaceRemotePlayerStates(players) {
        const nextStates = {};
        for (const player of players) {
            const normalized = normalizeRemotePlayerState(player);
            if (!normalized) continue;
            if (myUserId && normalized.user_id === String(myUserId)) continue;
            nextStates[normalized.user_id] = normalized;
        }
        remotePlayerStates = nextStates;
    }

    function removeRemotePlayerState(userId) {
        if (userId == null) return;
        delete remotePlayerStates[String(userId)];
    }

    function getRemotePlayerEventUniqueId(userId) {
        return `explore_remote_player:${String(userId)}`;
    }

    function isRemotePlayerOnCurrentMap(user) {
        const currentMapId = getCurrentMapId();
        if (currentMapId == null) return true;
        return normalizeRemoteMapId(user && user.map_id, currentMapId) === currentMapId;
    }

    function getRemotePlayerDisplayName(user) {
        const rawName = String(user && (user.name ?? user.username ?? user.global_name) || "").trim();
        const baseName = rawName || String(user && (user.user_id ?? user.id) || "Unknown");
        const level = user && user.level != null ? Number(user.level) : null;
        return (level && level > 0) ? `Lv.${level} ${baseName}` : baseName;
    }

    function syncVisiblePlayersFromState() {
        clearOtherPlayers();
        if (!onlinePlayersVisible) return;
        for (const userId of Object.keys(remotePlayerStates)) {
            spawnPlayer(remotePlayerStates[userId]);
        }
    }

    function showOnlinePlayers() {
        onlinePlayersVisible = true;
        syncVisiblePlayersFromState();
        if (!isIgnoredMap() && currentGuildId && Object.keys(remotePlayerStates).length === 0) {
            emitJoinCurrentGuild();
        }
        HintBar.show("已顯示線上玩家");
    }

    function hideOnlinePlayers() {
        onlinePlayersVisible = false;
        clearOtherPlayers();
        HintBar.show("已隱藏線上玩家");
    }

    function attachSpriteForUserId(userId) {
        const entry = otherPlayers[userId];
        if (!entry) return;

        const scene = SceneManager._scene;
        const spriteset = scene && scene._spriteset;
        if (!spriteset || !spriteset._tilemap) return;

        const sprite = Array.isArray(spriteset._characterSprites)
            ? spriteset._characterSprites.find(candidate => candidate && candidate._character === entry.character)
            : null;
        if (!sprite) return;
        attachNameLabelToSprite(sprite, entry.name || userId);
        entry.sprite = sprite;
    }

    function attachNameLabelToSprite(sprite, name) {
        if (!sprite) return;
        const labelText = String(name || "").trim();
        if (!labelText) return;

        let labelSprite = sprite._exploreNameLabel;
        if (!labelSprite) {
            const bitmap = new Bitmap(220, 36);
            bitmap.fontSize = 18;
            bitmap.outlineWidth = 4;
            bitmap.outlineColor = "rgba(0, 0, 0, 0.85)";
            bitmap.textColor = "#ffffff";

            labelSprite = new Sprite(bitmap);
            labelSprite.anchor.x = 0.5;
            labelSprite.anchor.y = 1;
            labelSprite.x = 0;
            labelSprite.y = -40;
            sprite.addChild(labelSprite);
            sprite._exploreNameLabel = labelSprite;
        }

        const bitmap = labelSprite.bitmap;
        bitmap.clear();
        bitmap.drawText(labelText, 0, 0, bitmap.width, bitmap.height, "center");
    }

    function removeNameLabelFromSprite(sprite) {
        if (!sprite || !sprite._exploreNameLabel) return;
        const labelSprite = sprite._exploreNameLabel;
        if (labelSprite.parent) {
            labelSprite.parent.removeChild(labelSprite);
        }
        sprite._exploreNameLabel = null;
    }

    function removeCharacterSprites(character) {
        if (!character) return;
        const scene = SceneManager._scene;
        const spriteset = scene && scene._spriteset;
        const spriteList = spriteset && Array.isArray(spriteset._characterSprites)
            ? spriteset._characterSprites
            : null;
        if (!spriteList) return;

        for (let index = spriteList.length - 1; index >= 0; index--) {
            const sprite = spriteList[index];
            if (!sprite || sprite._character !== character) continue;
            removeNameLabelFromSprite(sprite);
            if (sprite.parent) {
                sprite.parent.removeChild(sprite);
            }
            spriteList.splice(index, 1);
        }
    }

    function removeRemotePlayerEventsByUniqueId(uniqueId) {
        if (!$gameMap || !Array.isArray($gameMap._events) || !uniqueId) return;
        for (let eventId = $gameMap._events.length - 1; eventId >= 0; eventId--) {
            const event = $gameMap._events[eventId];
            if (!event || !event._eventData || event._eventData.uniqueId !== uniqueId) continue;
            removeCharacterSprites(event);
            if (typeof event.erase === "function") {
                event.erase();
            }
            if ($gameMap._events[eventId] === event) {
                $gameMap._events[eventId] = null;
            }
        }
    }

    function clearOrphanedRemotePlayerEvents() {
        if (!$gameMap || !Array.isArray($gameMap._events)) return;
        for (let eventId = $gameMap._events.length - 1; eventId >= 0; eventId--) {
            const event = $gameMap._events[eventId];
            const uniqueId = event && event._eventData ? event._eventData.uniqueId : null;
            if (typeof uniqueId !== "string" || !uniqueId.startsWith("explore_remote_player:")) continue;
            removeCharacterSprites(event);
            if (typeof event.erase === "function") {
                event.erase();
            }
            if ($gameMap._events[eventId] === event) {
                $gameMap._events[eventId] = null;
            }
        }
    }

    function refreshRemotePlayerSprites() {
        // When map changes, a new spriteset is created; reattach sprites.
        for (const uid of Object.keys(otherPlayers)) {
            const entry = otherPlayers[uid];
            if (!entry) continue;
            entry.sprite = null;
            attachSpriteForUserId(uid);
        }
    }

    function clearOtherPlayers() {
        for (const uid of Object.keys(otherPlayers)) {
            const entry = otherPlayers[uid];
            if (!entry) {
                delete otherPlayers[uid];
                continue;
            }
            removeCharacterSprites(entry.character);
            removeRemotePlayerEventsByUniqueId(entry.uniqueId || getRemotePlayerEventUniqueId(uid));
            delete otherPlayers[uid];
        }
        clearOrphanedRemotePlayerEvents();
    }

    // --- Player Movement Sync ---

    // Hook into Game_Player.prototype.update
    // const _Game_Player_update = Game_Player.prototype.update;
    // Game_Player.prototype.update = function (sceneActive) {
    //     _Game_Player_update.call(this, sceneActive);

    //     // 只有連接時才執行檢查
    //     if (socket && socket.connected) {
    //         // 初始化網路同步用的變數 (如果還沒定義過)
    //         if (this._lastNetworkX === undefined) {
    //             this._lastNetworkX = this.x;
    //             this._lastNetworkY = this.y;
    //             this._lastNetworkDir = this.direction();
    //         }

    //         // 檢查座標是否改變
    //         const isMoved = this.x !== this._lastNetworkX || this.y !== this._lastNetworkY;
    //         // 檢查方向是否改變 (修復原地轉向不同步的問題)
    //         const isTurned = this.direction() !== this._lastNetworkDir;

    //         // 只要有移動 或 轉向，就發送一次
    //         if (isMoved || isTurned) {
    //             socket.emit('move', {
    //                 guild_id: currentGuildId,
    //                 x: this.x,
    //                 y: this.y,
    //                 direction: this.direction()
    //             });

    //             // 更新紀錄，確保下一幀不會重複發送
    //             this._lastNetworkX = this.x;
    //             this._lastNetworkY = this.y;
    //             this._lastNetworkDir = this.direction();
    //         }
    //     }
    // };

    Game_Player.prototype.moveByInput = function () {
        if (!this.isMoving() && this.canMove()) {
            if (this.triggerAction()) return;
            var direction = this.getInputDirection();

            if (direction > 0) {
                $gameTemp.clearDestination();
            } else if ($gameTemp.isDestinationValid()) {
                var x = $gameTemp.destinationX();
                var y = $gameTemp.destinationY();
                direction = this.findDirectionTo(x, y);
            }

            if (direction > 0) {
                this.executeMove(direction);
                if (!isIgnoredMap()) {
                    safeEmit('move', {
                        guild_id: currentGuildId,
                        map_id: getCurrentMapId(),
                        direction: direction,
                        x: this.x,
                        y: this.y,
                        moveSpeed: this.realMoveSpeed(),
                        moveFrequency: this.moveFrequency()
                    });
                }
            }
        }
    };

    function spawnPlayer(user) {
        if (!user) return;
        const uid = user.user_id ?? user.id;
        if (uid == null) return;
        const userId = String(uid);
        if (myUserId && userId === String(myUserId)) return; // Don't spawn self
        if (!onlinePlayersVisible) return;
        if (!isRemotePlayerOnCurrentMap(user)) {
            removePlayer(userId);
            return;
        }

        const x = Number(user.x ?? 11);
        const y = Number(user.y ?? 11);
        const direction = user.direction != null ? Number(user.direction) : null;
        const skinId = user.skin_id != null ? String(user.skin_id) : null;
        const displayName = getRemotePlayerDisplayName(user);
        const uniqueId = getRemotePlayerEventUniqueId(userId);

        let entry = otherPlayers[userId];
        if (!entry) {
            let { characterName, characterIndex } = getCharacter(skinId);
            const character = $gameMap.createNormalEventAt(characterName, characterIndex, x, y, 8, 0, true, null, uniqueId);
            if (character && character.event && character.event()) {
                character.event().note = `<Name: ${displayName}>`;
                if (typeof character.initMetaMembers === "function") {
                    character.initMetaMembers();
                }
                if (typeof character.extractEliMetaData === "function") {
                    character.extractEliMetaData();
                }
            }
            character._priorityType = 0;
            character._stepAnime = false;
            character._moveSpeed = 4;
            character._isBusy = false;
            entry = otherPlayers[userId] = { character, sprite: null, skin_id: skinId, name: displayName, uniqueId };
            attachSpriteForUserId(userId);
        } else {
            entry.skin_id = skinId;
            entry.name = displayName;
            let { characterName, characterIndex } = getCharacter(skinId);
            entry.character.setImage(characterName, characterIndex);
            if (Number.isFinite(x) && Number.isFinite(y)) entry.character.locate(x, y);
            if (direction != null && Number.isFinite(direction)) entry.character.setDirection(direction);
            if (entry.character && entry.character.event && entry.character.event()) {
                entry.character.event().note = `<Name: ${displayName}>`;
                if (typeof entry.character.initMetaMembers === "function") {
                    entry.character.initMetaMembers();
                }
                if (typeof entry.character.extractEliMetaData === "function") {
                    entry.character.extractEliMetaData();
                }
            }
            if (entry.sprite && entry.sprite._exploreNameLabel && entry.sprite._exploreNameLabel.bitmap) {
                const bitmap = entry.sprite._exploreNameLabel.bitmap;
                bitmap.clear();
                bitmap.drawText(displayName, 0, 0, bitmap.width, bitmap.height, "center");
            }
            attachSpriteForUserId(userId);
        }
    }

    function movePlayer(data) {
        if (!data) return;
        const uid = data.user_id ?? data.id;
        if (uid == null) return;
        const userId = String(uid);
        if (myUserId && userId === String(myUserId)) return;
        if (!onlinePlayersVisible) return;
        if (!isRemotePlayerOnCurrentMap(data)) {
            removePlayer(userId);
            return;
        }

        // 確保玩家存在
        if (!otherPlayers[userId]) {
            spawnPlayer(data);
        }
        const entry = otherPlayers[userId];
        if (!entry) return;

        if (data.moveSpeed != null) entry.character.setMoveSpeed(Number(data.moveSpeed));
        if (data.moveFrequency != null) entry.character.setMoveFrequency(Number(data.moveFrequency));
        if (data.direction != null) entry.character.moveStraight(Number(data.direction));
        if (Number.isFinite(Number(data.x)) && Number.isFinite(Number(data.y)) && (data.x !== entry.character.x || data.y !== entry.character.y)) {
            console.log("Correcting position for", userId, "to", data.x, data.y);
            entry.character.setPosition(data.x, data.y);
        }

        // 刷新頭頂顯示 (名字/氣泡等)
        attachSpriteForUserId(userId);
    }

    function removePlayer(userId) {
        if (!userId) return;
        const entry = otherPlayers[userId];
        if (!entry) {
            removeRemotePlayerEventsByUniqueId(getRemotePlayerEventUniqueId(userId));
            return;
        }
        removeCharacterSprites(entry.character);
        removeRemotePlayerEventsByUniqueId(entry.uniqueId || getRemotePlayerEventUniqueId(userId));
        delete otherPlayers[userId];
    }

    // --- Patch commands ---

    Window_MenuCommand.prototype.addGuildsCommand = function () {
        this.addCommand("伺服器清單", "openGuilds", true);
    }

    Window_MenuCommand.prototype.addSkinCommand = function () {
        this.addCommand("皮膚商店", "changeSkin", true);
    }

    Window_MenuCommand.prototype.addPlayersCommand = function () {
        this.addCommand("線上玩家", "showPlayers", true);
    }

    const _Window_MenuCommand_makeCommandList = Window_MenuCommand.prototype.makeCommandList;
    Window_MenuCommand.prototype.makeCommandList = function () {
        this.addGuildsCommand();
        this.addSkinCommand();
        this.addPlayersCommand();
        this.addOptionsCommand();
    }

    // --- Menu Handlers ---
    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function () {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler("openGuilds", this.commandOpenGuilds.bind(this));
        this._commandWindow.setHandler("changeSkin", this.commandChangeSkin.bind(this));
        this._commandWindow.setHandler("showPlayers", this.commandShowPlayers.bind(this));
    };

    Scene_Menu.prototype.commandShowPlayers = function () {
        SceneManager.push(Scene_ExplorePlayerList);
    };

    Scene_Menu.prototype.commandOpenGuilds = function () {
        PluginManager.callCommand(this, PLUGIN_NAME, "OpenServerList", {});
    };

    Scene_Menu.prototype.commandChangeSkin = function () {
        PluginManager.callCommand(this, PLUGIN_NAME, "ChangeSkin", {});
    };

    // --- Scenes ---

    class Window_ExploreServerList extends Window_Selectable {
        initialize(rect) {
            super.initialize(rect);
            this._servers = [];
            this._iconBitmaps = {};
            this.refresh();
        }

        maxCols() {
            return 1;
        }

        itemHeight() {
            return 76;
        }

        setServers(servers) {
            this._servers = servers || [];
            this.refresh();
            this.select(0);
        }

        maxItems() {
            return this._servers.length;
        }

        serverAt(index) {
            return this._servers[index];
        }

        drawAllItems() {
            this.drawHeader();
            Window_Selectable.prototype.drawAllItems.call(this);
        }

        drawHeader() {
            const width = this.innerWidth - this.itemPadding() * 2;
            this.contents.fontSize = 28;
            this.changeTextColor(ColorManager.systemColor());
            this.drawText("選擇伺服器", this.itemPadding(), 22, width, "center");
            this.resetTextColor();
            this.contents.fontSize = 18;
            this.contents.paintOpacity = 180;
            this.drawText("要去哪個伺服器玩？", this.itemPadding(), 58, width, "center");
            this.contents.paintOpacity = 255;
            this.resetFontSettings();
        }

        itemRect(index) {
            const rect = Window_Selectable.prototype.itemRect.call(this, index);
            rect.y += 94;
            rect.height = this.itemHeight() - 6;
            return rect;
        }

        drawItem(index) {
            const server = this.serverAt(index);
            if (!server) return;
            const rect = this.itemRectWithPadding(index);
            const iconSize = 48;
            const badgeWidth = 120;
            const infoX = rect.x + iconSize + 18;
            const textWidth = Math.max(0, rect.width - (iconSize + badgeWidth + 42));

            this.drawItemBackground(index);

            this.contents.paintOpacity = 255;
            this.contentsBack.gradientFillRect(
                rect.x,
                rect.y + 4,
                rect.width,
                rect.height - 8,
                "rgba(20, 26, 40, 0.94)",
                "rgba(10, 14, 24, 0.94)",
                true
            );
            this.contentsBack.strokeRect(rect.x, rect.y + 4, rect.width, rect.height - 8, "rgba(255, 255, 255, 0.08)");

            if (server.icon_url) {
                const bmp = this._loadUrlBitmap(server.icon_url);
                if (bmp && bmp.isReady && bmp.isReady()) {
                    this.contents.blt(
                        bmp,
                        0,
                        0,
                        bmp.width,
                        bmp.height,
                        rect.x + 6,
                        rect.y + 10,
                        iconSize,
                        iconSize
                    );
                }
            } else {
                this.contentsBack.gradientFillRect(
                    rect.x + 6,
                    rect.y + 10,
                    iconSize,
                    iconSize,
                    "rgba(78, 122, 255, 0.6)",
                    "rgba(39, 62, 125, 0.6)",
                    true
                );
                this.changeTextColor(ColorManager.systemColor());
                this.contents.fontSize = 16;
                this.drawText("NO", rect.x + 6, rect.y + 18, iconSize, "center");
                this.drawText("ICON", rect.x + 6, rect.y + 34, iconSize, "center");
                this.resetFontSettings();
            }

            const name = server.name || server.id;
            const count = Number(server.member_count ?? 0);
            const insideCount = Number(server.in_space_count ?? 0);
            const statusText = server.require_join
                ? (server.is_member ? "私人" : "需要加入伺服器")
                : (server.is_public ? "公開" : "私人");
            const audienceText = `${count} 位成員`;
            const insideText = `${insideCount} 線上`;

            this.contents.fontSize = 24;
            this.resetTextColor();
            this.drawText(name, infoX, rect.y + 8, textWidth, "left");

            this.contents.fontSize = 16;
            this.contents.paintOpacity = 180;
            this.drawText(audienceText, infoX, rect.y + 36, Math.max(100, textWidth - 12), "left");
            this.drawText(insideText, infoX + 108, rect.y + 36, Math.max(100, textWidth - 120), "left");
            this.contents.paintOpacity = 255;

            const badgeX = rect.x + rect.width - badgeWidth - 10;
            const badgeY = rect.y + 13;
            const badgeHeight = 24;
            const badgeColor1 = server.require_join ? "rgba(255, 170, 64, 0.92)" : "rgba(72, 194, 134, 0.92)";
            const badgeColor2 = server.require_join ? "rgba(183, 92, 21, 0.92)" : "rgba(18, 110, 93, 0.92)";
            this.contents.gradientFillRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeColor1, badgeColor2, false);
            this.contents.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight, "rgba(255, 255, 255, 0.14)");
            this.contents.fontSize = 14;
            this.changeTextColor("#ffffff");
            this.contents.drawText(statusText, badgeX, badgeY, badgeWidth, badgeHeight, "center");
            this.resetFontSettings();
        }

        _loadUrlBitmap(url) {
            if (!url) return null;
            if (!this._iconBitmaps[url]) {
                try {
                    const bitmap = Bitmap.load(url);
                    bitmap.addLoadListener(() => this.refresh());
                    this._iconBitmaps[url] = bitmap;
                } catch (e) {
                    this._iconBitmaps[url] = null;
                }
            }
            return this._iconBitmaps[url];
        }
    }

    class Scene_ExploreServerList extends Scene_MenuBase {
        create() {
            super.create();
            const topInset = Math.max(this.buttonAreaBottom() + 8, 60);
            const sideInset = 28;
            const bottomInset = 24;
            const rect = new Rectangle(
                sideInset,
                topInset,
                Graphics.boxWidth - sideInset * 2,
                Graphics.boxHeight - topInset - bottomInset
            );
            this._listWindow = new Window_ExploreServerList(rect);
            this._listWindow.setHandler('ok', this.onOk.bind(this));
            this._listWindow.setHandler('cancel', this.popScene.bind(this));
            this.addWindow(this._listWindow);
            this.fetchServers();
        }

        start() {
            super.start();
            this._listWindow.activate();
            // 選擇第一項
            this._listWindow.select(0);
        }

        async fetchServers() {
            try {
                const res = await fetch('/api/explore/servers', {
                    headers: { 'Authorization': `Bearer ${exploreAuthToken}` }
                });
                const data = await res.json();
                if (!res.ok) {
                    console.error('Failed to fetch servers', data);
                    this._listWindow.setServers([]);
                    return;
                }
                this._listWindow.setServers(data);
            } catch (e) {
                console.error('Failed to fetch servers', e);
                this._listWindow.setServers([]);
            }
        }

        onOk() {
            const server = this._listWindow.serverAt(this._listWindow.index());
            if (!server) return;
            if (server.require_join && !server.is_member) {
                handleMembershipRequired(server);
                return;
            }
            connectToSpace(server.id);
            // 清除場景堆疊，直接回到地圖場景以觸發地圖轉移
            SceneManager._stack.length = 0;
            SceneManager.goto(Scene_Map);
        }
    }

    class Window_ExploreSkinList extends Window_Selectable {
        initialize(rect) {
            super.initialize(rect);
            this._skins = [];
            this._currentSkinId = null;
            this._balance = null;
            this._currencyName = "全域幣";
            this.refresh();
        }

        maxCols() {
            return 2;
        }

        itemHeight() {
            return 64;
        }

        setShopData(data) {
            this._skins = (data && data.skins) || [];
            this._currentSkinId = data && data.current_skin_id != null ? String(data.current_skin_id) : null;
            this._balance = data && data.balance != null ? Number(data.balance) : null;
            this._currencyName = (data && data.currency_name) || "全域幣";
            this.refresh();
            this.select(0);
        }

        maxItems() {
            return this._skins.length;
        }

        skinAt(index) {
            return this._skins[index];
        }

        drawAllItems() {
            this.drawHeader();
            Window_Selectable.prototype.drawAllItems.call(this);
        }

        drawHeader() {
            const width = this.innerWidth - this.itemPadding() * 2;
            this.contents.fontSize = 24;
            this.changeTextColor(ColorManager.systemColor());
            this.drawText("皮膚商店", this.itemPadding(), 4, width, "center");
            this.resetTextColor();
            if (this._balance != null) {
                this.contents.fontSize = 16;
                this.contents.paintOpacity = 200;
                this.drawText(`持有 ${this._currencyName}: ${Math.floor(this._balance)}`, this.itemPadding(), 34, width, "center");
                this.contents.paintOpacity = 255;
            }
            this.resetFontSettings();
        }

        itemRect(index) {
            const rect = Window_Selectable.prototype.itemRect.call(this, index);
            rect.y += 60;
            rect.height = this.itemHeight() - 6;
            return rect;
        }

        drawItem(index) {
            const skin = this.skinAt(index);
            if (!skin) return;
            const rect = this.itemRectWithPadding(index);
            const isCurrent = this._currentSkinId != null && String(skin.id) === this._currentSkinId;
            const owned = !!skin.owned || !skin.price;

            // 角色預覽(取站立第一格)
            const parsed = parseSkinId(skin.id);
            if (parsed) {
                try {
                    const bitmap = ImageManager.loadCharacter(parsed.characterName);
                    if (bitmap && bitmap.isReady()) {
                        const big = ImageManager.isBigCharacter(parsed.characterName);
                        const pw = bitmap.width / (big ? 3 : 12);
                        const ph = bitmap.height / (big ? 4 : 8);
                        const n = big ? 0 : parsed.characterIndex;
                        const sx = ((n % 4) * 3 + 1) * pw;
                        const sy = Math.floor(n / 4) * 4 * ph;
                        const scale = Math.min(48 / pw, 48 / ph, 1);
                        this.contents.blt(bitmap, sx, sy, pw, ph, rect.x + 4, rect.y + (rect.height - ph * scale) / 2, pw * scale, ph * scale);
                    } else if (bitmap) {
                        bitmap.addLoadListener(() => this.refresh());
                    }
                } catch (e) { /* 預覽失敗不擋列表 */ }
            }

            const textX = rect.x + 56;
            const textWidth = rect.width - 60;
            this.contents.fontSize = 20;
            this.changePaintOpacity(owned || isCurrent);
            this.resetTextColor();
            if (isCurrent) this.changeTextColor(ColorManager.powerUpColor());
            this.drawText(String(skin.name || skin.id), textX, rect.y + 4, textWidth, "left");
            this.resetTextColor();

            this.contents.fontSize = 15;
            this.contents.paintOpacity = 180;
            let subText;
            if (isCurrent) {
                subText = "使用中";
            } else if (owned) {
                subText = "已擁有";
            } else {
                subText = `${skin.price} ${this._currencyName}`;
            }
            this.drawText(subText, textX, rect.y + 30, textWidth, "left");
            this.contents.paintOpacity = 255;
            this.changePaintOpacity(true);
            this.resetFontSettings();
        }
    }

    class Scene_ExploreSkinList extends Scene_MenuBase {
        create() {
            super.create();
            this.createWindowLayer();
            const topInset = Math.max(this.buttonAreaBottom() + 8, 60);
            const sideInset = 28;
            const rect = new Rectangle(
                sideInset,
                topInset,
                Graphics.boxWidth - sideInset * 2,
                Graphics.boxHeight - topInset - 24
            );
            this._listWindow = new Window_ExploreSkinList(rect);
            this._listWindow.setHandler('ok', this.onOk.bind(this));
            this._listWindow.setHandler('cancel', this.popScene.bind(this));
            this.addWindow(this._listWindow);
            this.fetchSkins();
        }

        start() {
            super.start();
            this._listWindow.activate();
            this._listWindow.select(0);
        }

        async fetchSkins() {
            try {
                const res = await fetch('/api/explore/skins', {
                    headers: { 'Authorization': `Bearer ${exploreAuthToken}` }
                });
                const data = await res.json();
                if (!res.ok) {
                    console.error('Failed to fetch skins', data);
                    this._listWindow.setShopData({ skins: [] });
                    return;
                }
                // 相容舊格式(純陣列)與新格式({skins, current_skin_id, balance})
                if (Array.isArray(data)) {
                    this._listWindow.setShopData({ skins: data });
                } else {
                    this._listWindow.setShopData(data);
                }
            } catch (e) {
                console.error('Failed to fetch skins', e);
                this._listWindow.setShopData({ skins: [] });
            }
        }

        async onOk() {
            const skin = this._listWindow.skinAt(this._listWindow.index());
            if (!skin) return;
            const owned = !!skin.owned || !skin.price;
            if (owned) {
                await this.equipSkin(skin);
            } else {
                await this.buySkin(skin);
            }
            this._listWindow.activate();
        }

        async buySkin(skin) {
            try {
                const res = await fetch('/api/explore/skins/buy', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${exploreAuthToken}`
                    },
                    body: JSON.stringify({ skin_id: skin.id })
                });
                const data = await res.json();
                if (!res.ok) {
                    showHint(data.error || '購買失敗');
                    SoundManager.playBuzzer();
                    return;
                }
                showHint(`已購買 ${skin.name}!`);
                SoundManager.playShop();
                await this.fetchSkins();
            } catch (e) {
                console.error('Failed to buy skin', e);
                showHint('購買失敗');
            }
        }

        async equipSkin(skin) {
            try {
                const res = await fetch('/api/explore/me/skin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${exploreAuthToken}`
                    },
                    body: JSON.stringify({ skin_id: skin.id })
                });
                const data = await res.json();
                if (!res.ok) {
                    showHint(data.error || '更換失敗');
                    SoundManager.playBuzzer();
                    return;
                }
                applySkinToSelf(skin.id);
                showHint(`已換上 ${skin.name}`);
                SoundManager.playEquip();
                if (!isIgnoredMap()) {
                    safeEmit('skin_change', { guild_id: currentGuildId, map_id: getCurrentMapId(), skin_id: skin.id });
                }
                await this.fetchSkins();
            } catch (e) {
                console.error('Failed to set skin', e);
                showHint('更換失敗');
            }
        }
    }

    class Window_ExplorePlayerList extends Window_Selectable {
        initialize(rect) {
            super.initialize(rect);
            this._players = [];
            this.refresh();
        }

        setPlayers(players) {
            this._players = players || [];
            this.refresh();
            this.select(0);
        }

        maxItems() {
            return this._players.length;
        }

        itemHeight() {
            return 56;
        }

        playerAt(index) {
            return this._players[index];
        }

        drawAllItems() {
            this.drawHeader();
            Window_Selectable.prototype.drawAllItems.call(this);
        }

        drawHeader() {
            const width = this.innerWidth - this.itemPadding() * 2;
            this.contents.fontSize = 24;
            this.changeTextColor(ColorManager.systemColor());
            this.drawText(`線上玩家 (${this._players.length})`, this.itemPadding(), 4, width, "center");
            this.resetTextColor();
            this.resetFontSettings();
        }

        itemRect(index) {
            const rect = Window_Selectable.prototype.itemRect.call(this, index);
            rect.y += 44;
            rect.height = this.itemHeight() - 6;
            return rect;
        }

        drawItem(index) {
            const player = this.playerAt(index);
            if (!player) return;
            const rect = this.itemRectWithPadding(index);

            // 皮膚預覽
            const parsed = parseSkinId(player.skin_id);
            if (parsed) {
                try {
                    const bitmap = ImageManager.loadCharacter(parsed.characterName);
                    if (bitmap && bitmap.isReady()) {
                        const big = ImageManager.isBigCharacter(parsed.characterName);
                        const pw = bitmap.width / (big ? 3 : 12);
                        const ph = bitmap.height / (big ? 4 : 8);
                        const n = big ? 0 : parsed.characterIndex;
                        const sx = ((n % 4) * 3 + 1) * pw;
                        const sy = Math.floor(n / 4) * 4 * ph;
                        const scale = Math.min(40 / pw, 40 / ph, 1);
                        this.contents.blt(bitmap, sx, sy, pw, ph, rect.x + 4, rect.y + (rect.height - ph * scale) / 2, pw * scale, ph * scale);
                    } else if (bitmap) {
                        bitmap.addLoadListener(() => this.refresh());
                    }
                } catch (e) { /* ignore */ }
            }

            const isMe = myUserId && String(player.user_id) === String(myUserId);
            const level = player.level != null ? Number(player.level) : null;
            const baseName = String(player.name || player.user_id || "Unknown");
            const nameText = (level && level > 0) ? `Lv.${level} ${baseName}` : baseName;

            this.contents.fontSize = 20;
            if (isMe) this.changeTextColor(ColorManager.powerUpColor());
            this.drawText(nameText + (isMe ? " (你)" : ""), rect.x + 52, rect.y + 2, rect.width - 56, "left");
            this.resetTextColor();

            const mapId = player.map_id != null ? Number(player.map_id) : null;
            const mapInfo = mapId != null && $dataMapInfos && $dataMapInfos[mapId] ? $dataMapInfos[mapId].name : null;
            this.contents.fontSize = 14;
            this.contents.paintOpacity = 170;
            this.drawText(mapInfo ? `位於 ${mapInfo}` : "位置不明", rect.x + 52, rect.y + 26, rect.width - 56, "left");
            this.contents.paintOpacity = 255;
            this.resetFontSettings();
        }
    }

    class Scene_ExplorePlayerList extends Scene_MenuBase {
        create() {
            super.create();
            const topInset = Math.max(this.buttonAreaBottom() + 8, 60);
            const sideInset = 48;
            const rect = new Rectangle(
                sideInset,
                topInset,
                Graphics.boxWidth - sideInset * 2,
                Graphics.boxHeight - topInset - 24
            );
            this._listWindow = new Window_ExplorePlayerList(rect);
            this._listWindow.setHandler('ok', this.onOk.bind(this));
            this._listWindow.setHandler('cancel', this.popScene.bind(this));
            this.addWindow(this._listWindow);
            this.refreshPlayers();
        }

        start() {
            super.start();
            this._listWindow.activate();
            this._listWindow.select(0);
        }

        refreshPlayers() {
            // 資料來源:remotePlayerStates(伺服器 room_state 廣播)+ 自己
            const players = Object.values(remotePlayerStates).slice();
            if (myUserId) {
                players.unshift({
                    user_id: String(myUserId),
                    name: myName || "You",
                    skin_id: $gamePlayer ? `${$gamePlayer._characterName}:${$gamePlayer._characterIndex}` : null,
                    level: myLevel,
                    map_id: getCurrentMapId(),
                });
            }
            this._listWindow.setPlayers(players);
        }

        onOk() {
            this._listWindow.activate();
        }
    }

    function connectToSpace(guildId) {
        if (!guildId) return;
        safeEmit('leave', { guild_id: currentGuildId });
        clearOtherPlayers();
        remotePlayerStates = {};

        currentGuildId = String(guildId);
        isWorldMap = false;

        if ($gamePlayer) {
            $gamePlayer.reserveTransfer(MAP_SPACE, 11, 11, 8, 0);
            $gamePlayer.requestMapReload();
        }
        fetchMapData();
        // 'join' 會在 onMapLoaded 中自動發送
    }

    // --- Initialization ---
    PluginManager.registerCommand(PLUGIN_NAME, "InitializeSDK", function (args) {
        initDiscordSDK(Number(args.switchId));
    });

    PluginManager.registerCommand(PLUGIN_NAME, "TransferToTarget", function () {
        decideMapToLoad();
    });

    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.call(this);

        if (pendingLoadedSaveContext && $gameMap && $gameMap.mapId() === pendingLoadedSaveContext.mapId) {
            currentGuildId = pendingLoadedSaveContext.guildId;
            isWorldMap = pendingLoadedSaveContext.isWorldMap;
            fetchMapData();
            pendingLoadedSaveContext = null;
        }

        applySpaceTiles();

        // 進入村莊地圖時自動同步任務狀態(開關 11-15)
        if ($gameMap && $gameMap.mapId() === 11) {
            syncQuestSwitches();
        }

        // 清除舊地圖殘留的遠端玩家資料
        clearOtherPlayers();
        otherPlayers = {};
        remotePlayerStates = {};

        // 非忽略地圖自動加入房間（伺服器會回傳 room_state 重新生成玩家）
        if (isIgnoredMap()) {
            safeEmit('leave', { guild_id: currentGuildId });
        } else {
            emitJoinCurrentGuild();
        }
        _updateChatOverlay();
        _updateEditorToolbar();
    };

    // --- Map Editor (admin-only, gated by server can_edit) ---
    // 抽屜式面板(仿音樂播放器):右側中央 🛠️ 按鈕,展開後含圖層切換與 tile palette。
    // 開啟抽屜 = 進入編輯模式,關閉 = 離開。

    const TILE_DISPLAY = 34;   // palette 上每格顯示大小(原始 48px 縮放)
    const PALETTE_COLS = 8;
    let paletteTab = 'A';
    let paletteEntries = [];   // 目前分頁的 [{tileId, setNumber, sx, sy}]

    function _tilesetNames() {
        const ts = $gameMap && typeof $gameMap.tileset === 'function' ? $gameMap.tileset() : null;
        return ts ? ts.tilesetNames : null;
    }

    /** 自動地形(kind 0-127)縮圖來源:取該 autotile 區塊的左上 48x48(A1 為近似值) */
    function _autotileThumbSource(kind) {
        if (kind < 16) { // A1 水/瀑布
            let bx, by;
            if (kind === 0) { bx = 0; by = 0; }
            else if (kind === 1) { bx = 0; by = 3; }
            else if (kind === 2) { bx = 6; by = 0; }
            else if (kind === 3) { bx = 6; by = 3; }
            else {
                bx = (Math.floor(kind / 4) % 2) * 8;
                by = Math.floor(kind / 8) * 6 + (Math.floor(kind / 2) % 2) * 3;
                if (kind % 2 === 1) bx += 6;
            }
            return { setNumber: 0, sx: bx * 48, sy: by * 48 };
        } else if (kind < 48) { // A2 地面
            const local = kind - 16;
            return { setNumber: 1, sx: (local % 8) * 2 * 48, sy: Math.floor(local / 8) * 3 * 48 };
        } else if (kind < 80) { // A3 建物
            const local = kind - 48;
            return { setNumber: 2, sx: (local % 8) * 2 * 48, sy: Math.floor(local / 8) * 2 * 48 };
        } else { // A4 牆壁(高度 3,2,3,2… 交錯)
            const local = kind - 80;
            const row = Math.floor(local / 8);
            const by = Math.floor(row / 2) * 5 + (row % 2) * 3;
            return { setNumber: 3, sx: (local % 8) * 2 * 48, sy: by * 48 };
        }
    }

    /** 一般圖塊(A5 / B-E)縮圖來源(對應 rmmz_core 的排版公式) */
    function _normalTileSource(tileId) {
        if (tileId >= 1536 && tileId < 2048) { // A5
            const i = tileId - 1536;
            return { setNumber: 4, sx: (i % 8) * 48, sy: Math.floor(i / 8) * 48 };
        }
        const setNumber = 5 + Math.floor(tileId / 256);
        const sx = ((Math.floor(tileId / 128) % 2) * 8 + (tileId % 8)) * 48;
        const sy = (Math.floor((tileId % 256) / 8) % 16) * 48;
        return { setNumber, sx, sy };
    }

    function _paletteEntriesForTab(tab) {
        const names = _tilesetNames();
        if (!names) return [];
        const entries = [];
        if (tab === 'A') {
            // 自動地形:選取後由 OcRam 自動接邊
            for (let kind = 0; kind < 128; kind++) {
                const src = _autotileThumbSource(kind);
                if (!names[src.setNumber]) continue;
                entries.push({ tileId: 2048 + kind * 48, ...src });
            }
            if (names[4]) { // A5 一般地磚
                for (let i = 0; i < 128; i++) {
                    entries.push({ tileId: 1536 + i, ..._normalTileSource(1536 + i) });
                }
            }
        } else {
            const base = { B: 0, C: 256, D: 512, E: 768 }[tab];
            if (base == null) return [];
            const setNumber = 5 + base / 256;
            if (!names[setNumber]) return [];
            for (let i = 0; i < 256; i++) {
                entries.push({ tileId: base + i, ..._normalTileSource(base + i) });
            }
        }
        return entries;
    }

    function _renderPaletteCanvas() {
        const canvas = document.getElementById('ee-palette');
        if (!canvas) return;
        const entries = paletteEntries;
        const rows = Math.max(1, Math.ceil(entries.length / PALETTE_COLS));
        canvas.width = PALETTE_COLS * TILE_DISPLAY;
        canvas.height = rows * TILE_DISPLAY;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const names = _tilesetNames();
        if (!names) return;

        const drawEntry = (entry, index) => {
            const dx = (index % PALETTE_COLS) * TILE_DISPLAY;
            const dy = Math.floor(index / PALETTE_COLS) * TILE_DISPLAY;
            try {
                const bmp = ImageManager.loadTileset(names[entry.setNumber]);
                const paint = () => {
                    try {
                        ctx.drawImage(bmp.canvas, entry.sx, entry.sy, 48, 48, dx, dy, TILE_DISPLAY, TILE_DISPLAY);
                    } catch (e) { /* 個別縮圖失敗不擋整體 */ }
                    if (entry.tileId === currentTileId) {
                        ctx.strokeStyle = '#5cffa9';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(dx + 1, dy + 1, TILE_DISPLAY - 2, TILE_DISPLAY - 2);
                    }
                };
                if (bmp.isReady()) paint();
                else bmp.addLoadListener(paint);
            } catch (e) { /* ignore */ }
        };
        entries.forEach(drawEntry);
    }

    function _switchPaletteTab(tab) {
        paletteTab = tab;
        paletteEntries = _paletteEntriesForTab(tab);
        const tabRow = document.getElementById('ee-tabs');
        if (tabRow) {
            for (const btn of tabRow.children) {
                const active = btn.dataset.tab === tab;
                btn.style.background = active ? 'rgba(92,169,255,0.5)' : 'rgba(255,255,255,0.12)';
            }
        }
        _renderPaletteCanvas();
    }

    function _ensureEditorToolbarDOM() {
        if (document.getElementById('explore-editor-shell')) return;
        const shell = document.createElement('div');
        shell.id = 'explore-editor-shell';
        shell.style.cssText = [
            'position:fixed', 'right:14px', 'top:50%', 'transform:translateY(-50%)',
            'z-index:9997', 'display:none',
            'pointer-events:none', 'font-family:sans-serif', 'user-select:none',
        ].join(';');
        shell.innerHTML = `
<div id="ee-panel" style="position:absolute;right:0;top:50%;transform:translate(calc(100% + 12px), -50%);opacity:0;transition:transform 220ms ease, opacity 220ms ease;pointer-events:none;background:linear-gradient(135deg, rgba(30,18,12,0.96), rgba(60,38,27,0.93));color:#fff;border-radius:16px;padding:12px;box-shadow:0 18px 38px rgba(0,0,0,0.42);border:1px solid rgba(255,255,255,0.1);width:308px;max-width:calc(100vw - 96px)">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-weight:700;font-size:13px">🛠️ 地圖編輯</span>
    <span style="font-size:11px;opacity:0.6">左鍵放置 / 右鍵吸取 / 1-4 圖層</span>
  </div>
  <div style="display:flex;gap:4px;align-items:center;margin-bottom:8px">
    <span style="font-size:12px;opacity:0.75">圖層</span>
    <div id="ee-layers" style="display:flex;gap:4px"></div>
    <span style="flex:1"></span>
    <button id="ee-eraser" style="background:rgba(255,255,255,0.12);border:none;color:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px">🧽 橡皮擦</button>
  </div>
  <div id="ee-tabs" style="display:flex;gap:4px;margin-bottom:6px"></div>
  <div style="max-height:280px;overflow-y:auto;border-radius:8px;scrollbar-width:thin">
    <canvas id="ee-palette" style="display:block;cursor:pointer;image-rendering:pixelated"></canvas>
  </div>
  <div style="font-size:11px;opacity:0.7;margin-top:6px">目前 Tile: <span id="ee-tile" style="font-weight:700">0</span></div>
</div>
<button id="ee-launcher" title="地圖編輯" style="position:relative;width:52px;height:52px;border:1px solid rgba(255,255,255,0.12);border-radius:16px;background:linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,170,64,0.28));box-shadow:0 14px 28px rgba(0,0,0,0.3);cursor:pointer;pointer-events:auto;display:flex;align-items:center;justify-content:center;padding:0;transition:transform 220ms ease, background 220ms ease">
  <span style="font-size:22px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,0.35)">🛠️</span>
</button>`;
        document.body.appendChild(shell);
        _preventFocusSteal(shell);

        // 防止面板互動穿透到遊戲(避免誤放地磚/誤觸移動)
        for (const evName of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'contextmenu', 'wheel', 'click']) {
            shell.addEventListener(evName, (ev) => ev.stopPropagation());
        }

        document.getElementById('ee-launcher').onclick = () => {
            isEditMode = !isEditMode;
            if (isEditMode) {
                _switchPaletteTab(paletteTab);
                showHint("編輯模式:左鍵放置、右鍵吸取");
            } else {
                showHint("已離開編輯模式");
            }
            _updateEditorToolbar();
        };

        const layerRow = document.getElementById('ee-layers');
        for (let layer = 0; layer < 4; layer++) {
            const btn = document.createElement('button');
            btn.textContent = String(layer + 1);
            btn.dataset.layer = String(layer);
            btn.style.cssText = 'background:rgba(255,255,255,0.12);border:none;color:#fff;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:12px';
            btn.onclick = () => {
                currentZ = layer;
                _updateEditorToolbar();
            };
            layerRow.appendChild(btn);
        }

        const tabRow = document.getElementById('ee-tabs');
        for (const tab of ['A', 'B', 'C', 'D', 'E']) {
            const btn = document.createElement('button');
            btn.textContent = tab;
            btn.dataset.tab = tab;
            btn.style.cssText = 'flex:1;background:rgba(255,255,255,0.12);border:none;color:#fff;border-radius:6px;padding:4px 0;cursor:pointer;font-size:12px';
            btn.onclick = () => _switchPaletteTab(tab);
            tabRow.appendChild(btn);
        }

        document.getElementById('ee-eraser').onclick = () => {
            currentTileId = 0;
            _updateEditorToolbar();
            _renderPaletteCanvas();
            showHint("已選擇橡皮擦(Tile 0)");
        };

        const canvas = document.getElementById('ee-palette');
        canvas.addEventListener('click', (ev) => {
            const rect = canvas.getBoundingClientRect();
            const col = Math.floor((ev.clientX - rect.left) / TILE_DISPLAY);
            const row = Math.floor((ev.clientY - rect.top) / TILE_DISPLAY);
            const index = row * PALETTE_COLS + col;
            const entry = paletteEntries[index];
            if (!entry) return;
            currentTileId = entry.tileId;
            _updateEditorToolbar();
            _renderPaletteCanvas();
        });
    }

    function _updateEditorToolbar() {
        _ensureEditorToolbarDOM();
        const shell = document.getElementById('explore-editor-shell');
        const panel = document.getElementById('ee-panel');
        const launcher = document.getElementById('ee-launcher');
        const tileEl = document.getElementById('ee-tile');
        if (!shell || !panel || !launcher) return;

        // 只有管理員在伺服器空間(非世界地圖、非忽略地圖)才顯示入口
        const show = canEditCurrentSpace && !isWorldMap && !isIgnoredMap();
        shell.style.display = show ? 'block' : 'none';
        if (!show) {
            isEditMode = false;
            return;
        }

        panel.style.transform = isEditMode ? 'translate(calc(-52px - 12px), -50%)' : 'translate(calc(100% + 12px), -50%)';
        panel.style.opacity = isEditMode ? '1' : '0';
        panel.style.pointerEvents = isEditMode ? 'auto' : 'none';
        launcher.style.background = isEditMode
            ? 'linear-gradient(135deg, rgba(92,255,169,0.4), rgba(255,170,64,0.32))'
            : 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,170,64,0.28))';

        if (tileEl) tileEl.textContent = String(currentTileId);
        const layerRow = document.getElementById('ee-layers');
        if (layerRow) {
            for (const btn of layerRow.children) {
                const active = Number(btn.dataset.layer) === currentZ;
                btn.style.background = active ? 'rgba(92,169,255,0.5)' : 'rgba(255,255,255,0.12)';
            }
        }
    }

    // 編輯模式下右鍵不呼叫選單/返回(改為吸取工具)
    const _Scene_Map_isMenuCalled = Scene_Map.prototype.isMenuCalled;
    Scene_Map.prototype.isMenuCalled = function () {
        if (isEditMode && canEditCurrentSpace && !isWorldMap) {
            return Input.isTriggered("menu"); // 只允許鍵盤(Esc/X)開選單
        }
        return _Scene_Map_isMenuCalled.call(this);
    };

    // 編輯模式下點擊地圖不觸發移動(目的地根本不設定)
    const _Scene_Map_processMapTouch = Scene_Map.prototype.processMapTouch;
    Scene_Map.prototype.processMapTouch = function () {
        if (isEditMode && canEditCurrentSpace && !isWorldMap) return;
        _Scene_Map_processMapTouch.call(this);
    };

    // --- Input Handling for Editor ---
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);

        // 等待使用者輸入（初始化後的「點擊以繼續」）
        if (_pendingInputCallback && (Input.isTriggered('ok') || TouchInput.isTriggered())) {
            const cb = _pendingInputCallback;
            _pendingInputCallback = null;
            cb();
        }

        if (isEditMode && canEditCurrentSpace && !isWorldMap) {
            this.updateEditorInput();
        }
    };

    Scene_Map.prototype.updateEditorInput = function () {
        if (TouchInput.isTriggered()) {
            const x = $gameMap.canvasToMapX(TouchInput.x);
            const y = $gameMap.canvasToMapY(TouchInput.y);
            // 編輯模式下不要讓點擊觸發移動
            $gameTemp.clearDestination();
            this.placeTile(x, y);
        } else if (TouchInput.isCancelled()) {
            const x = $gameMap.canvasToMapX(TouchInput.x);
            const y = $gameMap.canvasToMapY(TouchInput.y);
            this.pickTile(x, y);
        }
    };

    Scene_Map.prototype.placeTile = function (x, y) {
        if (!$gameMap.isValid(x, y)) return;

        // Use OcRam API
        $gameMap.setNormalTile(x, y, currentZ, currentTileId);

        safeEmit('edit_map', {
            guild_id: currentGuildId,
            x: x,
            y: y,
            z: currentZ,
            tile_id: currentTileId
        });
    };

    Scene_Map.prototype.pickTile = function (x, y) {
        if (!$gameMap.isValid(x, y)) return;
        currentTileId = $gameMap.tileId(x, y, currentZ);
        showHint(`已吸取 Tile ${currentTileId}(圖層 ${currentZ + 1})`);
        _updateEditorToolbar();
        _renderPaletteCanvas();
    };

    document.addEventListener('keydown', (event) => {
        // 打字時(聊天輸入框聚焦)不要切圖層
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (!isEditMode) return;
        if (event.key === '1') { currentZ = 0; _updateEditorToolbar(); }
        if (event.key === '2') { currentZ = 1; _updateEditorToolbar(); }
        if (event.key === '3') { currentZ = 2; _updateEditorToolbar(); }
        if (event.key === '4') { currentZ = 3; _updateEditorToolbar(); }
    });

})();
