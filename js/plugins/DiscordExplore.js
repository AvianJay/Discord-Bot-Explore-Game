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
    const IGNORED_MAPS = [3, 4, 5, 6, 7, 8, 9, 1];

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

    let myUserId = null;
    let myName = null;
    let pendingSpaceTiles = null; // [{x,y,z,tile_id}]

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
            if (!isIgnoredMap() && currentGuildId) {
                socket.emit('join', { guild_id: currentGuildId });
            }
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
            console.log("User joined:", data);
            const player = upsertRemotePlayerState(data);
            if (onlinePlayersVisible && player) spawnPlayer(player);
        });

        socket.on('user_left', (data) => {
            console.log("User left:", data);
            const uid = data && (data.user_id ?? data.id);
            if (uid != null) {
                removeRemotePlayerState(uid);
                removePlayer(String(uid));
            }
        });

        socket.on('user_moved', (data) => {
            const player = upsertRemotePlayerState(data);
            if (onlinePlayersVisible && player) movePlayer(player);
        });

        socket.on('skin_changed', (data) => {
            // data: { guild_id, user_id, skin_id }
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            const player = upsertRemotePlayerState(data);
            if (!onlinePlayersVisible || !player) return;
            const uid = player.user_id;
            const entry = otherPlayers[uid];
            if (!entry) return;
            entry.skin_id = player.skin_id;
            applySkinToCharacter(entry.character, entry.skin_id);
        });

        socket.on('error', (data) => {
            console.error("Socket error:", data);
            if (data.message === 'Membership required') {
                alert("You must join this server to enter!");
                // Logic to kick user back to world map
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

    function leaveSpace() {
        safeEmit('leave', { guild_id: currentGuildId });

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
            safeEmit('join', { guild_id: currentGuildId });
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
        if (!entry || entry.sprite) return;

        const scene = SceneManager._scene;
        const spriteset = scene && scene._spriteset;
        if (!spriteset || !spriteset._tilemap) return;

        const sprite = new Sprite_Character(entry.character);
        if (Array.isArray(spriteset._characterSprites)) spriteset._characterSprites.push(sprite);
        spriteset._tilemap.addChild(sprite);
        entry.sprite = sprite;
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
            if ($gameMap && entry.character && $gameMap._events[entry.character['_eventId']] !== undefined) {
                $gameMap.eraseEvent(entry.character['_eventId']);
            }
            // detachSpriteForUserId(uid);
            delete otherPlayers[uid];
        }
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

        const x = Number(user.x ?? 11);
        const y = Number(user.y ?? 11);
        const direction = user.direction != null ? Number(user.direction) : null;
        const skinId = user.skin_id != null ? String(user.skin_id) : null;

        let entry = otherPlayers[userId];
        if (!entry) {
            let { characterName, characterIndex } = getCharacter(skinId);
            const character = $gameMap.createNormalEventAt(characterName, characterIndex, x, y, 8, 0, true);
            character.headDisplay = character.list().push({ code: 108, indent: 0, parameters: [`<Name: ${userId}>`] }); // Show Name
            character._priorityType = 0;
            character._stepAnime = false;
            character._moveSpeed = 4;
            character._isBusy = false;
            entry = otherPlayers[userId] = { character, sprite: null, skin_id: skinId };
            attachSpriteForUserId(userId);
        } else {
            entry.skin_id = skinId;
            let { characterName, characterIndex } = getCharacter(skinId);
            entry.character.setImage(characterName, characterIndex);
            if (Number.isFinite(x) && Number.isFinite(y)) entry.character.locate(x, y);
            if (direction != null && Number.isFinite(direction)) entry.character.setDirection(direction);
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

        // 確保玩家存在
        if (!otherPlayers[userId]) {
            spawnPlayer(data);
        }
        const entry = otherPlayers[userId];
        if (!entry) return;

        entry.character.setMoveSpeed(data.moveSpeed);
        entry.character.setMoveFrequency(data.moveFrequency);
        entry.character.moveStraight(data.direction);
        if (data.x !== entry.character.x || data.y !== entry.character.y) {
            console.log("Correcting position for", userId, "to", data.x, data.y);
            entry.character.setPosition(data.x, data.y);
        }

        // 刷新頭頂顯示 (名字/氣泡等)
        attachSpriteForUserId(userId);
    }

    function removePlayer(userId) {
        if (!userId) return;
        const entry = otherPlayers[userId];
        if (!entry) return;
        if ($gameMap && entry.character && $gameMap._events[entry.character['_eventId']] !== undefined) {
            $gameMap.eraseEvent(entry.character['_eventId']);
        }
        // detachSpriteForUserId(userId);
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

        drawItem(index) {
            const server = this.serverAt(index);
            if (!server) return;
            const rect = this.itemRectWithPadding(index);

            // Draw icon if available (best-effort; may fail due to CORS)
            let x = rect.x;
            if (server.icon_url) {
                const bmp = this._loadUrlBitmap(server.icon_url);
                if (bmp && bmp.isReady && bmp.isReady()) {
                    const size = 32;
                    this.contents.blt(bmp, 0, 0, bmp.width, bmp.height, x, rect.y + 2, size, size);
                }
            }
            x += 36;

            const name = server.name || server.id;
            const count = server.member_count ?? 0;
            this.drawText(`${name} (${count})`, x, rect.y, rect.width - (x - rect.x));
        }

        _loadUrlBitmap(url) {
            if (!url) return null;
            if (!this._iconBitmaps[url]) {
                try {
                    this._iconBitmaps[url] = Bitmap.load(url);
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
            this.createWindowLayer();
            const rect = new Rectangle(0, 0, Graphics.boxWidth, Graphics.boxHeight);
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
            connectToSpace(server.id);
            this.popScene();
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
                    safeEmit('skin_change', { guild_id: currentGuildId, skin_id: skin.id });
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

        applySpaceTiles();

        // 清除舊地圖殘留的遠端玩家資料
        otherPlayers = {};
        remotePlayerStates = {};

        // 非忽略地圖自動加入房間（伺服器會回傳 room_state 重新生成玩家）
        if (!isIgnoredMap() && currentGuildId) {
            safeEmit('join', { guild_id: currentGuildId });
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
