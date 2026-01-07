//=============================================================================
// StrechMode always enabled
// StrechMode_ON.js
//=============================================================================
/*:
 * @target MZ
 * @author Anybody
 * @plugindesc Force StretchMode
 *
 * @help This Plugin forces the game to start in Stretch mode
 * and disables the F3 key, to facilitate adaptation
 * in browsers and Smartphones.
 */
(function () {
    Graphics._defaultStretchMode = function() {
        Graphics._stretchEnabled = true; /*Force on WebBrowser*/
        return true;
    };
    Graphics._switchStretchMode = function() {
        this._stretchEnabled = true;
        this._updateAllElements();
    };
})();