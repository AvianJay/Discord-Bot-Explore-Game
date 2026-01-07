/*:
 * @target MZ
 * @plugindesc Discord Explore Integration
 * @author AvianJay
 *
 * @command OpenServerList
 * @text 伺服器清單
 * @desc 顯示可連線的伺服器清單，點擊後連線並切換到 MAP002 載入空間地圖。
 *
 * @command ChangeSkin
 * @text 更換外觀
 * @desc 顯示可用皮膚清單，選擇後呼叫 API 設定並同步到空間。
 *
 * @command LeaveSpace
 * @text 離開空間
 * @desc 離開目前連線的空間並回到世界地圖（MAP001）。
 *
 * @help DiscordExplore.js
 *
 * This plugin integrates with the Discord Explore backend.
 * It requires the Discord Embedded App SDK and Socket.IO client to be loaded.
 */

(() => {
    const PLUGIN_NAME = "DiscordExplore";

    const MAP_WORLD = 1;
    const MAP_SPACE = 2; // MAP002

    // State
    let discordSdk = null;
    let auth = null; // legacy oauth response
    let exploreAuthToken = null;
    let socket = null;
    let currentGuildId = null;
    let isWorldMap = false;
    let otherPlayers = {}; // userId -> { character: Game_Character, sprite: Sprite_Character|null, skin_id: string|null }
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

    // --- Discord SDK Setup ---
    async function initDiscordSDK() {
        const module = await import('../libs/embedded-app-sdk/index.mjs');
        const { DiscordSDK } = module;
        if (typeof DiscordSDK === 'undefined') {
            console.error("Discord SDK not loaded. Please add the script to index.html");
            return;
        }

        // get query param
        const urlParams = new URLSearchParams(window.location.search);
        const instanceParam = urlParams.get('instance_id');
        if (!instanceParam) {
            console.warn("No instance_id query param provided");
            return;
        }
        const guildIdParam = urlParams.get('guild_id');
        if (guildIdParam) {
            currentGuildId = guildIdParam;
            isWorldMap = false;
            console.log("Guild ID from query param:", currentGuildId);
        } else {
            isWorldMap = true;
            currentGuildId = 'world';
            console.log("No Guild ID provided, loading World Map");
        }

        console.log("Fetching Client ID...");
        try {
            const statusRes = await fetch('/api/status');
            const statusData = await statusRes.json();
            clientId = statusData.id;
            console.log("Client ID fetched:", clientId);
        } catch (e) {
            console.error("Failed to fetch Client ID from /api/status", e);
            return;
        }

        console.log("Initializing Discord SDK...");
        discordSdk = new DiscordSDK(clientId);

        try {
            await discordSdk.ready();
            console.log("Discord SDK Ready");

            // Authorize
            const { code } = await discordSdk.commands.authorize({
                client_id: clientId,
                response_type: "code",
                state: "",
                prompt: "none",
                scope: [
                    "identify",
                    "guilds",
                    "rpc.activities.write",
                ],
            });

            // Exchange OAuth code -> Discord access token (legacy route still exists)
            const response = await fetch(`/api/explore/authenticate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });

            auth = await response.json();
            console.log("Authenticated with backend (discord token)", auth);

            await discordSdk.commands.authenticate({ access_token: auth.token });

            // Exchange Discord token -> Explore auth_token (new API)
            const tokenRes = await fetch(`/api/explore/auth/discord-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ discord_token: auth.token }),
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.auth_token) {
                console.error("Failed to get explore auth_token", tokenData);
                return;
            }
            exploreAuthToken = tokenData.auth_token;
            console.log("Explore auth_token ready");

            // Fetch my profile (name/skin)
            try {
                const meRes = await fetch('/api/explore/me', {
                    headers: { "Authorization": `Bearer ${exploreAuthToken}` }
                });
                const me = await meRes.json();
                if (meRes.ok) {
                    myName = me.name;
                }
            } catch (e) {
                console.warn("Failed to fetch /api/explore/me", e);
            }

            // Connect Socket (auth required)
            connectSocket();

            // Boot map
            decideMapToLoad();

        } catch (e) {
            console.error("Failed to initialize Discord SDK", e);
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
            socket.emit('join', {
                guild_id: currentGuildId
            });
        });

        socket.on('joined', (data) => {
            myUserId = data.user_id;
        });

        socket.on('room_state', (data) => {
            // data: { guild_id, players: [...] }
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            clearOtherPlayers();
            const players = Array.isArray(data.players) ? data.players : [];
            for (const p of players) spawnPlayer(p);
        });

        socket.on('user_joined', (data) => {
            console.log("User joined:", data);
            spawnPlayer(data);
        });

        socket.on('user_left', (data) => {
            console.log("User left:", data);
            const uid = data && (data.user_id ?? data.id);
            if (uid != null) removePlayer(String(uid));
        });

        socket.on('user_moved', (data) => {
            movePlayer(data);
        });

        socket.on('skin_changed', (data) => {
            // data: { guild_id, user_id, skin_id }
            if (!data || String(data.guild_id) !== String(currentGuildId)) return;
            const uid = String(data.user_id);
            if (!uid || (myUserId && uid === String(myUserId))) return;
            const entry = otherPlayers[uid];
            if (!entry) return;
            entry.skin_id = data.skin_id != null ? String(data.skin_id) : null;
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

    function leaveSpace() {
        // Leave current room (space) but keep the socket connection alive for quick re-join.
        if (socket && socket.connected && currentGuildId) {
            socket.emit('leave', { guild_id: currentGuildId });
        }

        // Switch to world
        currentGuildId = 'world';
        isWorldMap = true;
        pendingSpaceTiles = null;

        // Transfer back to MAP001
        if ($gamePlayer) {
            $gamePlayer.reserveTransfer(MAP_WORLD, 8, 6, 2, 0);
            $gamePlayer.requestMapReload();
        }

        // Refresh world data
        fetchMapData();

        // Join world room for presence (optional)
        if (socket && socket.connected) {
            socket.emit('join', { guild_id: currentGuildId });
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

    function detachSpriteForUserId(userId) {
        const entry = otherPlayers[userId];
        if (!entry || !entry.sprite) return;

        const sprite = entry.sprite;
        entry.sprite = null;

        try {
            if (sprite.parent) sprite.parent.removeChild(sprite);
        } catch (_) { }

        const scene = SceneManager._scene;
        const spriteset = scene && scene._spriteset;
        if (spriteset && Array.isArray(spriteset._characterSprites)) {
            const idx = spriteset._characterSprites.indexOf(sprite);
            if (idx >= 0) spriteset._characterSprites.splice(idx, 1);
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
            if (!entry) continue;
            if ($gameMap._events[entry.character['_eventId']] === undefined) {
                continue;
            }
            $gameMap.eraseEvent(entry.character['_eventId']);
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
                socket.emit('move', {
                    guild_id: currentGuildId,
                    direction: direction,
                    x: this.x,
                    y: this.y,
                    moveSpeed: this.realMoveSpeed(),
                    moveFrequency: this.moveFrequency()
                });
            }
        }
    };

    function spawnPlayer(user) {
        if (!user) return;
        const uid = user.user_id ?? user.id;
        if (uid == null) return;
        const userId = String(uid);
        if (myUserId && userId === String(myUserId)) return; // Don't spawn self

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

        // 確保玩家存在
        if (!otherPlayers[userId]) {
            spawnPlayer(data);
        }
        const entry = otherPlayers[userId];
        if (!entry) return;

        // 取得目標座標與方向
        // const targetX = Number(data.x);
        // const targetY = Number(data.y);
        // const targetDir = data.direction != null ? Number(data.direction) : null;

        // if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

        // // --- 核心邏輯修正 ---

        // // 1. 計算與當前位置的距離
        // // RPG Maker 的 x/y 是邏輯座標，會在 moveStraight 瞬間更新
        // const dx = targetX - entry.character.x;
        // const dy = targetY - entry.character.y;
        // const distance = Math.abs(dx) + Math.abs(dy);

        // // 2. 距離為 0：表示邏輯上已經到達，或收到重複封包
        // if (distance === 0) {
        //     // 雖然位置一樣，但如果方向變了，還是要轉頭
        //     if (targetDir) {
        //         console.log("Correcting direction for", userId, "to", targetDir);
        //         entry.character.setDirection(targetDir);
        //     }
        //     // 絕對不要在這裡呼叫 locate，否則正在走路的動畫會被切斷，看起來像「少走一格」
        //     return;
        // }

        // // 3. 距離為 1：應該平滑移動
        // if (distance === 1) {
        //     // 計算正確的移動方向，而不是依賴 data.direction
        //     // 因為 data.direction 可能是玩家停下來時的朝向，不一定是移動向量
        //     let moveDir = 0;
        //     if (dy > 0) moveDir = 2;      // 向下
        //     else if (dx < 0) moveDir = 4; // 向左
        //     else if (dx > 0) moveDir = 6; // 向右
        //     else if (dy < 0) moveDir = 8; // 向上
        //     console.log("Moving player", userId, "towards", targetX, targetY, "using direction", moveDir);

        //     // ★關鍵修正：暫時開啟「穿透模式」
        //     // 避免其他玩家因為撞到你本地的 NPC 或牆壁而導致 moveStraight 失敗
        //     const originalThrough = entry.character.isThrough();
        //     entry.character.setThrough(true);

        //     // 執行移動
        //     entry.character.moveStraight(moveDir);

        //     // 如果你是嚴格要保持碰撞，可以在這裡設回去，但建議聯機玩家保持穿透
        //     // entry.character.setThrough(originalThrough);

        //     // 補正：如果移動後，最後的朝向跟封包不同，強制修正朝向 (例如螃蟹走路)
        //     if (targetDir && entry.character.direction() !== targetDir) {
        //         entry.character.setDirection(targetDir);
        //     }
        // }
        // // 4. 距離 > 1：落後太多，強制瞬移 (Locate)
        // else {
        //     console.log("Teleporting player", userId, "to", targetX, targetY);
        //     entry.character.locate(targetX, targetY);
        //     if (targetDir) {
        //         entry.character.setDirection(targetDir);
        //     }
        // }

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
        entry = otherPlayers[userId];
        if ($gameMap._events[entry.character['_eventId']] === undefined) {
            return;
        }
        $gameMap.eraseEvent(entry.character['_eventId']);
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
                    if (socket && socket.connected) {
                        socket.emit('skin_change', { guild_id: currentGuildId, skin_id: skin.id });
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
        if (socket && socket.connected && currentGuildId) {
            socket.emit('leave', { guild_id: currentGuildId });
        }
        currentGuildId = String(guildId);
        isWorldMap = false;

        // Transfer to MAP002 then load tiles
        if ($gamePlayer) {
            $gamePlayer.reserveTransfer(MAP_SPACE, 11, 11, 8, 0);
            $gamePlayer.requestMapReload();
        }
        fetchMapData();
        if (socket && socket.connected) {
            socket.emit('join', { guild_id: currentGuildId });
        }
    }

    // --- Initialization ---

    const _Scene_Boot_start = Scene_Boot.prototype.start;
    Scene_Boot.prototype.start = function () {
        _Scene_Boot_start.call(this);
        initDiscordSDK();
    };

    const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
    Scene_Map.prototype.onMapLoaded = function () {
        _Scene_Map_onMapLoaded.call(this);

        // Apply space tiles if any
        applySpaceTiles();

        // Reattach remote player sprites on new spriteset
        refreshRemotePlayerSprites();
    };

    // --- Input Handling for Editor ---
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);

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

        // Emit (align with backend event name)
        if (socket) {
            socket.emit('edit_map', {
                guild_id: currentGuildId,
                x: x,
                y: y,
                z: currentZ,
                tile_id: currentTileId
            });
        }
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
