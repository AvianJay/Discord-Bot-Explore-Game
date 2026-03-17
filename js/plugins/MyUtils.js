/*:
 * @target MZ
 * @plugindesc Some utility commands.
 * @author AvianJay
 * 
 * @command waitForInput
 * @text Wait for Input
 * @desc Set switch ON when the player clicks the screen or presses any key
 * 
 * @arg switchId
 * @type switch
 *
 * @command cacheSe
 * @text Cache SE
 * @desc Preload one sound effect in audio/se for smoother first playback
 *
 * @arg seName
 * @text SE File
 * @type file
 * @dir audio/se
 * @desc File name in audio/se (without extension)
 *
 * @arg volume
 * @type number
 * @min 0
 * @max 100
 * @default 90
 *
 * @arg pitch
 * @type number
 * @min 50
 * @max 150
 * @default 100
 *
 * @arg pan
 * @type number
 * @min -100
 * @max 100
 * @default 0
 *
 * @help MyUtils.js
 * This plugin provides some utility functions for RPG Maker MZ.
*/

(() => {
    const PLUGIN_NAME = "MyUtils";
    let _waitingSwitch = null;
    let _waitFrames = 0; // 延遲幾幀再開始偵測，避免抓到觸發指令的那次輸入

    PluginManager.registerCommand(PLUGIN_NAME, "waitForInput", (args) => {
        _waitingSwitch = Number(args.switchId);
        _waitFrames = 2; // 跳過 2 幀
        _anyKeyPressed = false;
    });

    PluginManager.registerCommand(PLUGIN_NAME, "cacheSe", (args) => {
        const name = String(args.seName || "").trim();
        if (!name) return;

        const se = {
            name,
            volume: Number(args.volume || 90),
            pitch: Number(args.pitch || 100),
            pan: Number(args.pan || 0)
        };

        AudioManager.loadStaticSe(se);
    });

    let _anyKeyPressed = false;
    document.addEventListener("keydown", () => {
        if (_waitingSwitch != null && _waitFrames <= 0) {
            _anyKeyPressed = true;
        }
    });

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (_waitingSwitch == null) return;

        if (_waitFrames > 0) {
            _waitFrames--;
            return;
        }

        if (_anyKeyPressed || TouchInput.isTriggered()) {
            const sw = _waitingSwitch;
            _waitingSwitch = null;
            _anyKeyPressed = false;
            $gameSwitches.setValue(sw, true);
        }
    };
})();