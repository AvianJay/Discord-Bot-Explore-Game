/*:
 * @target MZ
 * @plugindesc Some utility commands.
 * @author AvianJay
 * 
 * @command waitForClick
 * @text Wait for Click
 * @desc Set switch ON when the player clicks the screen
 * 
 * @arg switchId
 * @type switch
 *
 * @help MyUtils.js
 * This plugin provides some utility functions for RPG Maker MZ.
*/

(() => {
    const PLUGIN_NAME = "MyUtils";
    PluginManager.registerCommand(PLUGIN_NAME, "waitForClick", (args) => {
        return new Promise((resolve) => {
            const onClick = () => {
                document.removeEventListener("click", onClick);
                $gameSwitches.setValue(Number(args.switchId), true);
                resolve();
            };
            document.addEventListener("click", onClick);
        });
    });
})();