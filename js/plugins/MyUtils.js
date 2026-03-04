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