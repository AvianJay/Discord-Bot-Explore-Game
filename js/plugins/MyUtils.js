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

    PluginManager.registerCommand(PLUGIN_NAME, "waitForInput", (args) => {
        _waitingSwitch = Number(args.switchId);
    });

    // 在 Scene_Map.update 中偵測輸入
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (_waitingSwitch != null) {
            if (TouchInput.isTriggered() || Input._latestButton || _anyKeyPressed) {
                const sw = _waitingSwitch;
                _waitingSwitch = null;
                _anyKeyPressed = false;
                $gameSwitches.setValue(sw, true);
            }
        }
    };

    // 捕捉任意鍵盤按鍵
    let _anyKeyPressed = false;
    document.addEventListener("keydown", () => {
        if (_waitingSwitch != null) {
            _anyKeyPressed = true;
        }
    });
})();