/*:
 * @target MZ
 * @plugindesc 在畫面下方顯示一條黑色漸層提示條（與文字同高，左右透明、中間最明顯）。
 * @author AvianJay
 *
 * @command showHint
 * @text 顯示提示
 * @desc 在畫面下方顯示提示文字，背景為黑色透明度漸層（中間最明顯）。
 *
 * @arg text
 * @type string
 * @text 提示文字
 * @desc 要顯示的提示內容
 *
 * @command hideHint
 * @text 隱藏提示
 * @desc 隱藏下方的提示條。
 *
 * @help HintBar.js
 *
 * 用法：
 * - 插件指令「顯示提示」並輸入文字，會在畫面最下方顯示一條與文字行同高的黑色長條，
 *   透明度為漸層：左右兩側透明，中間最明顯，文字置中顯示。
 * - 插件指令「隱藏提示」可關閉提示條。
 *
 * 腳本呼叫範例：
 *   PluginManager.callCommand('HintBar', 'showHint', { text: '按 Enter 繼續' });
 *   HintBar.hide();
 */

(() => {
    const PLUGIN_NAME = "HintBar";

    const LINE_HEIGHT = 36; // 與 Window_Base.lineHeight() 一致
    const BAR_HEIGHT = LINE_HEIGHT;
    const CENTER_OPACITY = 1;   // 中間黑色不透明度（0~1）
    const EDGE_OPACITY = 0;       // 左右邊緣透明度

    /**
     * 建立「下方黑色漸層提示條」用 Sprite
     * 寬度 = 遊戲寬度，高度 = 一行文字高，橫向漸層：左右透明、中間最明顯
     */
    function Sprite_HintBar() {
        this.initialize(...arguments);
    }
    Sprite_HintBar.prototype = Object.create(Sprite.prototype);
    Sprite_HintBar.prototype.constructor = Sprite_HintBar;

    Sprite_HintBar.prototype.initialize = function() {
        Sprite.prototype.initialize.call(this);
        this._text = "";
        this._hintBitmap = null;
        this.anchor.x = 0;
        this.anchor.y = 1;
        this.x = 0;
        this.y = Graphics.boxHeight;
        this.visible = false;
    };

    Sprite_HintBar.prototype.setText = function(text) {
        if (this._text === text) return;
        this._text = text || "";
        this.refresh();
    };

    Sprite_HintBar.prototype.refresh = function() {
        const w = Graphics.boxWidth;
        const h = BAR_HEIGHT;
        if (this._hintBitmap) this._hintBitmap.destroy();
        this._hintBitmap = new Bitmap(w, h);

        const colorEdge = `rgba(0, 0, 0, ${EDGE_OPACITY})`;
        const colorCenter = `rgba(0, 0, 0, ${CENTER_OPACITY})`;
        const half = w / 2;
        // 橫向漸層：左半 透明→中間黑，右半 中間黑→透明（中間最明顯）
        this._hintBitmap.gradientFillRect(0, 0, half, h, colorEdge, colorCenter, false);
        this._hintBitmap.gradientFillRect(half, 0, half, h, colorCenter, colorEdge, false);

        if (this._text) {
            this._hintBitmap.fontFace = $gameSystem ? $gameSystem.mainFontFace() : "GameFont";
            this._hintBitmap.fontSize = $gameSystem ? $gameSystem.mainFontSize() : 28;
            this._hintBitmap.textColor = "#ffffff";
            this._hintBitmap.outlineColor = "rgba(0, 0, 0, 0.5)";
            const ty = (h - LINE_HEIGHT) / 2;
            this._hintBitmap.drawText(this._text, 0, ty, w, LINE_HEIGHT, "center");
        }

        // 透過 setter 設定，觸發 _onBitmapChange 更新貼圖
        this.bitmap = this._hintBitmap;
        this.visible = !!this._text;
    };

    Sprite_HintBar.prototype.destroy = function(options) {
        if (this._hintBitmap) {
            this._hintBitmap.destroy();
            this._hintBitmap = null;
        }
        Sprite.prototype.destroy.call(this, options);
    };

    // --- 全域狀態（文字內容），場景各自建立 Sprite 顯示 ---
    let _hintText = "";

    /** 每個場景建立自己的 Sprite，讀取全域文字 */
    const _Scene_Base_create = Scene_Base.prototype.create;
    Scene_Base.prototype.create = function() {
        _Scene_Base_create.call(this);
        this._hintBarSprite = new Sprite_HintBar();
        this._hintBarSprite._text = _hintText;
        this._hintBarSprite.refresh();
    };

    const _Scene_Base_start = Scene_Base.prototype.start;
    Scene_Base.prototype.start = function() {
        _Scene_Base_start.call(this);
        // 確保在最上層（其他插件可能在 create 之後加東西）
        if (this._hintBarSprite) {
            this.addChild(this._hintBarSprite);
        }
    };

    /** 更新全域文字，並同步到當前場景的 Sprite */
    function setHintText(text) {
        _hintText = text || "";
        const scene = SceneManager._scene;
        if (scene && scene._hintBarSprite) {
            scene._hintBarSprite.setText(_hintText);
        }
    }

    // --- 插件指令：顯示 / 隱藏 ---
    PluginManager.registerCommand(PLUGIN_NAME, "showHint", (args) => {
        setHintText(args.text || "");
    });

    PluginManager.registerCommand(PLUGIN_NAME, "hideHint", () => {
        setHintText("");
    });

    // 供腳本用
    window.HintBar = {
        show: function(text) {
            setHintText(String(text));
        },
        hide: function() {
            setHintText("");
        }
    };
})();
