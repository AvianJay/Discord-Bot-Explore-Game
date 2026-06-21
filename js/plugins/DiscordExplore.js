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
    let pendingSpaceTiles = null; // [{x,y,z,tile_id}]
    let pendingLoadedSaveContext = null;

    // Editor State
    let isEditMode = false;
    let currentTileId = 0;
    let currentZ = 0; // 0=Layer 1, 1=Layer 2, etc.

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

    function showHint(message) {
        if (typeof HintBar !== "undefined" && HintBar && typeof HintBar.show === "function") {
            HintBar.show(String(message));
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

        socket.on('map_edited', (data) => {
            // data: { guild_id, x, y, z, tile_id }
            if ($gameMap && typeof $gameMap.setNormalTile === 'function') {
                $gameMap.setNormalTile(data.x, data.y, data.z, Number(data.tile_id));
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
        isEditMode = true;
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

    function getCharacter(skinId) {

        // NOTE: Our backend only provides skin_id, not the actual RPG Maker character sheet.
        // For now, use the player's current character as a fallback.
        // If you later add a skin_id -> {characterName, characterIndex} mapping, plug it in here.
        const img = getFallbackCharacterImage();
        return { characterName: img.characterName, characterIndex: img.characterIndex };
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
        return rawName || String(user && (user.user_id ?? user.id) || "Unknown");
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
        this.addCommand("更換外觀", "changeSkin", true);
    }

    const _Window_MenuCommand_makeCommandList = Window_MenuCommand.prototype.makeCommandList;
    Window_MenuCommand.prototype.makeCommandList = function () {
        this.addGuildsCommand();
        this.addSkinCommand();
        this.addOptionsCommand();
    }

    // --- Menu Handlers ---
    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function () {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler("openGuilds", this.commandOpenGuilds.bind(this));
        this._commandWindow.setHandler("changeSkin", this.commandChangeSkin.bind(this));
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
            this.refresh();
        }

        setSkins(skins) {
            this._skins = skins || [];
            this.refresh();
            this.select(0);
        }

        maxItems() {
            return this._skins.length;
        }

        skinAt(index) {
            return this._skins[index];
        }

        drawItem(index) {
            const skin = this.skinAt(index);
            if (!skin) return;
            const rect = this.itemRectWithPadding(index);
            this.drawText(`${skin.name} [${skin.id}]`, rect.x, rect.y, rect.width);
        }
    }

    class Scene_ExploreSkinList extends Scene_MenuBase {
        create() {
            super.create();
            this.createWindowLayer();
            const rect = new Rectangle(0, 0, Graphics.boxWidth, Graphics.boxHeight);
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
                    this._listWindow.setSkins([]);
                    return;
                }
                this._listWindow.setSkins(data);
            } catch (e) {
                console.error('Failed to fetch skins', e);
                this._listWindow.setSkins([]);
            }
        }

        async onOk() {
            const skin = this._listWindow.skinAt(this._listWindow.index());
            if (!skin) return;
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
                    console.error('Failed to set skin', data);
                } else {
                    if (!isIgnoredMap()) {
                        safeEmit('skin_change', { guild_id: currentGuildId, map_id: getCurrentMapId(), skin_id: skin.id });
                    }
                }
            } catch (e) {
                console.error('Failed to set skin', e);
            }
            this.popScene();
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

        if (isEditMode && !isWorldMap) {
            this.updateEditorInput();
        }
    };

    Scene_Map.prototype.updateEditorInput = function () {
        // Save: S key (KeyCode 83)
        if (Input.isTriggered('s') || Input.isTriggered('menu')) { // 'menu' is usually X or Esc, let's use a specific key check if possible
            // RMMZ Input mapper doesn't map 's' by default.
            // We can check raw key or add mapper.
        }

        // We'll use TouchInput for mouse interaction
        if (TouchInput.isTriggered()) {
            const x = $gameMap.canvasToMapX(TouchInput.x);
            const y = $gameMap.canvasToMapY(TouchInput.y);

            // Left Click: Place
            // But TouchInput doesn't distinguish Left/Right easily in RMMZ core without mods?
            // Actually TouchInput.isCancelled() is Right Click.

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

        // Get tile ID at x, y, z
        // $gameMap.tileId(x, y, z)
        // Note: RMMZ layers are 0-3 usually.
        // OcRam uses 1-based Z in params but 0-based in logic?
        // "z = pz < 1 ? 0 : pz - 1;" -> So if we pass 0, it uses 0.

        // We need to know which layer we are editing.
        // For now, let's just pick from the top-most visible layer or iterate?
        // Let's default to layer 0 (Ground) for now or cycle?

        // Simple picker: Pick from layer 0
        currentTileId = $gameMap.tileId(x, y, currentZ);
        console.log("Picked tile:", currentTileId);
    };

    document.addEventListener('keydown', (event) => {
        // Layer switching
        if (event.key === '1') { currentZ = 0; console.log("Layer 1"); }
        if (event.key === '2') { currentZ = 1; console.log("Layer 2"); }
        if (event.key === '3') { currentZ = 2; console.log("Layer 3"); }
        if (event.key === '4') { currentZ = 3; console.log("Layer 4"); }
    });

})();
