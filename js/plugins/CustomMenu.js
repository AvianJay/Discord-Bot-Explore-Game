/*:
 * @target MZ
 * @plugindesc v1.1.2 — CustomMenu.js: Customizable menu system with icon buttons, layouts, and transitions for RPG Maker MZ.
 * @author BitQuest Studio
 *
 * @help
 * CustomMenu.js (Version 1.1.2)
 * Developed by BitQuest Studio
 *
 * This plugin provides customizable menu enhancements for RPG Maker MZ:
 *
 * - Frame toggle mode (hide default window frame)
 * - Image-based menu buttons (replace buttons with custom images)
 * - Multiple menu layouts: vertical and horizontal
 * - Animated menu transitions (slide, zoom, fade)
 * - Custom menu images (from /img/pictures/)
 * - Plugin command to get available menu commands
 *
 * ========================
 * Plugin Commands
 * ========================
 * GetAvailableCommands
 * - Description: Gets a list of all available menu commands
 * - Parameters: None
 * - Usage: Use this command in an event to see all available menu commands in the console
 *
 * ========================
 * Important Usage Notes
 * ========================
 * If "Hide Actor Status in Main Menu" is enabled, you must disable the following
 * menu commands in Database → System 2 → Menu Commands:
 *   - Skill
 *   - Equip
 *   - Status
 *   - Formation
 *
 *
 * ========================
 * Plugin Parameters
 * ========================
 * @param EnableAudioSubmenu
 * @type boolean
 * @default true
 *
 * @param RemoveCommandRemember
 * @type boolean
 * @default true
 *
 * @param HideActorMenu
 * @type boolean
 * @default true
 *
 * @param CenterMenuWindow
 * @type boolean
 * @default true
 *
 * @param MenuWidth
 * @type number
 * @default 240
 *
 * @param MenuHeight
 * @type number
 * @default 288
 *
 * @param CustomizeSaveUI
 * @type boolean
 * @default true
 *
 * @param AudioSubmenuWidth
 * @type number
 * @default 400
 *
 * @param AudioSubmenuHeight
 * @type number
 * @default 200
 *
 * @param AudioSubmenuLabel
 * @type string
 * @desc Label text shown for the Audio submenu entry in Options.
 * @default Audio
 *
 * @param OptionsMenuWidth
 * @type number
 * @default 340
 *
 * @param OptionsMenuHeight
 * @type number
 * @default 240
 *
 * @param EnableDebugLogs
 * @type boolean
 * @desc If true, prints extra debug info to the console.
 * @default false
 *
 * @param SaveWindowWidth
 * @type number
 * @default 540
 *
 * @param SaveWindowHeight
 * @type number
 * @default 360
 *
 * @param ShowTopRightBackButton
 * @type boolean
 * @default true
 *
 * @param BackButtonScope
 * @type select
 * @option all
 * @option menuOnly
 * @desc Choose where to hide the top-right back button when disabled: in all scenes or only the main menu.
 * @default all
 *
 * @param ShowGoldWindow
 * @type boolean
 * @default true
 *
 * @param FrameToggleMode
 * @type boolean
 * @desc If true, disables the default window frame for menu only
 * @default false
 *
 * @param MenuCommandIcons
 * @type struct<MenuCommandIcon>[]
 * @desc List of menu command icons. Each entry maps a command symbol to an icon/image filename (relative to /img/system/). If set, the entire button is replaced by the image.
 * @default []
 *
 * @param MenuLayoutMode
 * @type select
 * @option vertical
 * @option horizontal
 * @desc Layout mode for the main menu: vertical (default) or horizontal toolbar
 * @default vertical
 *
 * @param MenuTransitionType
 * @type select
 * @option none
 * @option slide
 * @option zoom
 * @option fade
 * @desc Animation for menu open/close: none, slide, zoom, or fade
 * @default none
 *
 * @param ButtonWidth
 * @type number
 * @min 1
 * @desc Width of menu buttons (for horizontal layout)
 * @default 64
 *
 * @param ButtonHeight
 * @type number
 * @min 1
 * @desc Height of menu buttons (for horizontal layout)
 * @default 64
 *
 * @param MenuImages
 * @type struct<MenuImage>[]
 * @desc List of menu images to display (scalable, with position/size). Each entry is a menu image.
 * @default []
 *
 * @param AudioMasterVolumeEnabled
 * @type boolean
 * @desc Adds a master volume control that scales all other volumes.
 * @default true
 *
 * @param AudioResetLabel
 * @type string
 * @desc Label for the button that resets all audio settings to defaults.
 * @default Reset to Defaults
 *
 * @param AudioPreviewEnabled
 * @type boolean
 * @desc If true, plays a short preview when adjusting each audio volume.
 * @default true
 *
 * @param AudioPreviewBgm
 * @type file
 * @dir audio/bgm/
 * @desc OGG filename to preview for BGM changes (without extension).
 * @default
 *
 * @param AudioPreviewBgs
 * @type file
 * @dir audio/bgs/
 * @desc OGG filename to preview for BGS changes (without extension).
 * @default
 *
 * @param AudioPreviewMe
 * @type file
 * @dir audio/me/
 * @desc OGG filename to preview for ME changes (without extension).
 * @default
 *
 * @param AudioPreviewSe
 * @type file
 * @dir audio/se/
 * @desc OGG filename to preview for SE changes (without extension).
 * @default
 *
 * @param EnableDimOverlay
 * @type boolean
 * @desc If true, dims the background behind menus with a tinted overlay.
 * @default false
 *
 * @param DimColor
 * @type string
 * @desc Hex color for the dim overlay (e.g. #000000).
 * @default #000000
 *
 * @param DimOpacity
 * @type number
 * @min 0
 * @max 255
 * @desc Opacity for the dim overlay (0-255).
 * @default 96
 *
 * @param EnableBlur
 * @type boolean
 * @desc If true, applies a subtle blur to the background behind menus.
 * @default false
 *
 * @param BlurStrength
 * @type number
 * @desc Strength of blur (implementation-dependent).
 * @default 4
 *
 * @param ThemeHeadingFontSize
 * @type number
 * @desc Font size (px) for headings in menu windows.
 * @default 20
 *
 * @param ThemeTextColor
 * @type string
 * @desc Default text color for menu windows (hex).
 * @default #ffffff
 *
 * @param ThemeAccentColor
 * @type string
 * @desc Accent color used for highlights (hex).
 * @default #ffd700
 *
 * @param FocusEffectType
 * @type select
 * @option none
 * @option underline
 * @desc Visual focus effect for selected commands.
 * @default underline
 *
 * @param FocusUnderlineHeight
 * @type number
 * @desc Pixel height of the underline focus effect.
 * @default 2
 *
 */

/*~struct~MenuCommandIcon:
 * @param symbol
 * @type string
 * @desc The command symbol (e.g. "item", "save", "options")
 *
 * @param image
 * @type file
 * @dir img/system/
 * @desc The icon or image file to use for this command (relative to /img/system/)
 */

/*~struct~MenuImage:
 * @param filename
 * @type file
 * @dir img/pictures/
 * @desc The image file to display (relative to /img/pictures/)
 *
 * @param x
 * @type number
 * @desc X position (pixels)
 * @default 0
 *
 * @param y
 * @type number
 * @desc Y position (pixels)
 * @default 0
 *
 * @param width
 * @type number
 * @desc Width to scale image to (pixels, 0 = original)
 * @default 0
 *
 * @param height
 * @type number
 * @desc Height to scale image to (pixels, 0 = original)
 * @default 0
 */



(() => {
  const PLUGIN_NAME = "CustomMenu";
  const p = PluginManager.parameters(PLUGIN_NAME);
  const debugEnabled = p["EnableDebugLogs"] === "true";
  const debugLog = (...args) => { if (debugEnabled) console.log(...args); };
  const cfg = {
    enableAudio: p["EnableAudioSubmenu"] === "true",
    removeRemember: p["RemoveCommandRemember"] === "true",
    hideActor: p["HideActorMenu"] === "true",
    centerMenu: p["CenterMenuWindow"] === "true",
    menuWidth: Number(p["MenuWidth"] || 240),
    menuHeight: Number(p["MenuHeight"] || 288),
    saveUI: p["CustomizeSaveUI"] === "true",
    audioW: Number(p["AudioSubmenuWidth"] || 400),
    audioH: Number(p["AudioSubmenuHeight"] || 200),
    optionsW: Number(p["OptionsMenuWidth"] || 340),
    optionsH: Number(p["OptionsMenuHeight"] || 240),
    saveW: Number(p["SaveWindowWidth"] || 540),
    saveH: Number(p["SaveWindowHeight"] || 360),
    showBackButton: p["ShowTopRightBackButton"] === "true",
    backButtonScope: p["BackButtonScope"] || "all",
    showGold: p["ShowGoldWindow"] === "true",
    frameToggle: p["FrameToggleMode"] === "true",
    audioLabel: p["AudioSubmenuLabel"] || "Audio",
    debug: debugEnabled,
    menuIcons: (() => {
      const icons = {};
      try {
        const iconList = JSON.parse(p["MenuCommandIcons"] || "[]");
        debugLog("MenuCommandIcons raw:", p["MenuCommandIcons"]);
        debugLog("MenuCommandIcons parsed:", iconList);
        if (Array.isArray(iconList)) {
          iconList.forEach(entry => {
            // Parse each entry if it's a string
            let parsedEntry = entry;
            if (typeof entry === 'string') {
              try {
                parsedEntry = JSON.parse(entry);
              } catch (e) {
                debugLog("Failed to parse entry:", entry);
                return;
              }
            }
            if (parsedEntry.symbol && parsedEntry.image) {
              icons[parsedEntry.symbol] = parsedEntry.image;
            }
          });
        }
      } catch (e) {
        debugLog("MenuCommandIcons parse error:", e);
      }
      debugLog("Final menuIcons:", icons);
      return icons;
    })(),
    
    menuLayout: p["MenuLayoutMode"] || "vertical",
    menuTransition: p["MenuTransitionType"] || "none",
    buttonW: Number(p["ButtonWidth"] || 64),
    buttonH: Number(p["ButtonHeight"] || 64),
    menuImages: (() => {
      const images = [];
      try {
        const imageList = JSON.parse(p["MenuImages"] || "[]");
        debugLog("MenuImages raw:", p["MenuImages"]);
        debugLog("MenuImages parsed:", imageList);
        if (Array.isArray(imageList)) {
          imageList.forEach(entry => {
            // Parse each entry if it's a string
            let parsedEntry = entry;
            if (typeof entry === 'string') {
              try {
                parsedEntry = JSON.parse(entry);
              } catch (e) {
                debugLog("Failed to parse entry:", entry);
                return;
              }
            }
            if (parsedEntry.filename) {
              images.push({
                filename: parsedEntry.filename,
                x: Number(parsedEntry.x) || 0,
                y: Number(parsedEntry.y) || 0,
                width: Number(parsedEntry.width) || 0,
                height: Number(parsedEntry.height) || 0
              });
            }
          });
        }
      } catch (e) {
        debugLog("MenuImages parse error:", e);
      }
      debugLog("Final menuImages:", images);
      return images;
    })(),
    audioMaster: p["AudioMasterVolumeEnabled"] === "true",
    audioResetLabel: p["AudioResetLabel"] || "Reset to Defaults",
    audioPreview: p["AudioPreviewEnabled"] === "true",
    previewBgm: p["AudioPreviewBgm"] || "",
    previewBgs: p["AudioPreviewBgs"] || "",
    previewMe: p["AudioPreviewMe"] || "",
    previewSe: p["AudioPreviewSe"] || "",
    dimEnabled: p["EnableDimOverlay"] === "true",
    dimColor: p["DimColor"] || "#000000",
    dimOpacity: Number(p["DimOpacity"] || 96),
    blurEnabled: p["EnableBlur"] === "true",
    blurStrength: Number(p["BlurStrength"] || 4),
    themeHeadingFontSize: Number(p["ThemeHeadingFontSize"] || 20),
    themeTextColor: p["ThemeTextColor"] || "#ffffff",
    themeAccentColor: p["ThemeAccentColor"] || "#ffd700",
    focusEffectType: p["FocusEffectType"] || "underline",
    focusUnderlineHeight: Number(p["FocusUnderlineHeight"] || 2),

  };
  debugLog("CustomMenu config:", cfg);

  // Apply theme colors globally where feasible
  try {
    if (typeof ColorManager !== "undefined" && cfg.themeTextColor) {
      const _CM_normalColor = ColorManager.normalColor;
      ColorManager.normalColor = function() {
        return cfg.themeTextColor || _CM_normalColor.call(this);
      };
    }
  } catch (_) {}

  const volumeSymbols = ["bgmVolume","bgsVolume","meVolume","seVolume"];
  let volumeItems = [];
  const audioState = {
    previewUsed: { bgm: false, bgs: false, me: false, se: false },
    savedBgm: null,
    savedBgs: null
  };
  const restorePreviewAudioIfAny = function() {
    try {
      if (audioState.previewUsed.se) AudioManager.stopSe();
      if (audioState.previewUsed.me) AudioManager.stopMe();
      if (audioState.previewUsed.bgs) {
        AudioManager.stopBgs();
        if (audioState.savedBgs && AudioManager.replayBgs) {
          AudioManager.replayBgs(audioState.savedBgs);
        }
      }
      if (audioState.previewUsed.bgm) {
        AudioManager.stopBgm();
        if (audioState.savedBgm && AudioManager.replayBgm) {
          AudioManager.replayBgm(audioState.savedBgm);
        }
      }
    } catch (e) {
      debugLog("Audio restore error:", e);
    } finally {
      audioState.savedBgm = null;
      audioState.savedBgs = null;
      audioState.previewUsed = { bgm: false, bgs: false, me: false, se: false };
    }
  };

  // Extend ConfigManager for master volume only
  if (ConfigManager.masterVolume === undefined) ConfigManager.masterVolume = 100;

  const _CM_CM_makeData = ConfigManager.makeData;
  ConfigManager.makeData = function() {
    const data = _CM_CM_makeData.call(this);
    data.masterVolume = this.masterVolume ?? 100;
    return data;
  };

  const _CM_CM_applyData = ConfigManager.applyData;
  ConfigManager.applyData = function(config) {
    _CM_CM_applyData.call(this, config);
    this.masterVolume = Number(config.masterVolume ?? 100);
  };

  // Hide back button
  if (!cfg.showBackButton) {
    if (cfg.backButtonScope === "menuOnly") {
      const _CM_SM_createButtons = Scene_Menu.prototype.createButtons;
      Scene_Menu.prototype.createButtons = function() {};
    } else {
      Scene_MenuBase.prototype.createButtons = function() {};
    }
  }

  // Hide gold window
  if (!cfg.showGold) {
    Scene_Menu.prototype.createGoldWindow = function() {};
  }

  // Hide actor status
  if (cfg.hideActor) {
    const _SM_create = Scene_Menu.prototype.create;
    Scene_Menu.prototype.create = function() {
      _SM_create.call(this);
      this._statusWindow.hide();
    };
  }

  // Center menu
  if (cfg.centerMenu) {
    Scene_Menu.prototype.commandWindowRect = function() {
      const x = (Graphics.boxWidth - cfg.menuWidth) / 2;
      const y = (Graphics.boxHeight - cfg.menuHeight) / 2;
      return new Rectangle(x, y, cfg.menuWidth, cfg.menuHeight);
    };
  }

  // Options window adjustments
  Scene_Options.prototype.optionsWindowRect = function() {
    const x = (Graphics.boxWidth - cfg.optionsW) / 2;
    const y = (Graphics.boxHeight - cfg.optionsH) / 2;
    return new Rectangle(x, y, cfg.optionsW, cfg.optionsH);
  };
  if (cfg.removeRemember || cfg.enableAudio) {
    const _WOML = Window_Options.prototype.makeCommandList;
    Window_Options.prototype.makeCommandList = function() {
      _WOML.call(this);
      volumeItems = this._list.filter(opt => volumeSymbols.includes(opt.symbol));
      this._list = this._list.filter(opt =>
        (!cfg.removeRemember || opt.symbol !== "commandRemember") &&
        (!cfg.enableAudio || !volumeSymbols.includes(opt.symbol))
      );
      if (cfg.enableAudio) {
        this._list.push({ name: cfg.audioLabel, symbol: "audioSubmenu", enabled: true, ext: null });
      }
    };
    const _WOPK = Window_Options.prototype.processOk;
    Window_Options.prototype.processOk = function() {
      if (this.commandSymbol(this.index()) === "audioSubmenu") {
        SoundManager.playOk();
        SceneManager.push(Scene_AudioOptions);
      } else {
        _WOPK.call(this);
      }
    };
    const _WODI = Window_Options.prototype.drawItem;
    Window_Options.prototype.drawItem = function(i) {
      if (this.commandSymbol(i) === "audioSubmenu") {
        const rect = this.itemLineRect(i);
        this.resetTextColor();
        this.changePaintOpacity(true);
        this.drawText(cfg.audioLabel, rect.x, rect.y, rect.width, "left");
      } else {
        _WODI.call(this, i);
      }
    };
    const _WOST = Window_Options.prototype.statusText;
    Window_Options.prototype.statusText = function(i) {
      return this.commandSymbol(i) === "audioSubmenu"
        ? ""
        : _WOST.call(this, i);
    };

    // Define Window_AudioOptions & Scene_AudioOptions here

    // Audio-only options window
    function Window_AudioOptions(rect) {
      Window_Options.call(this, rect);
    }
    Window_AudioOptions.prototype = Object.create(Window_Options.prototype);
    Window_AudioOptions.prototype.constructor = Window_AudioOptions;

    // Build audio-related options including master, volumes, and reset
    Window_AudioOptions.prototype.makeCommandList = function() {
      this._list = [];
      if (cfg.audioMaster) this.addCommand("Master Volume", "masterVolume", true, null);
      if (volumeItems && volumeItems.length > 0) volumeItems.forEach(opt => { this.addCommand(opt.name, opt.symbol, opt.enabled, opt.ext); });
      else this.addVolumeOptions();
      this.addCommand(cfg.audioResetLabel, "audioReset", true, null);
    };

    Window_AudioOptions.prototype.statusText = function(i) {
      const symbol = this.commandSymbol(i);
      if (symbol === "masterVolume") return `${ConfigManager.masterVolume}%`;
      if (symbol === "audioReset") return "";
      return Window_Options.prototype.statusText.call(this, i);
    };

    Window_AudioOptions.prototype.processOk = function() {
      const symbol = this.commandSymbol(this.index());
      if (symbol === "audioReset") {
        this._resetAudioDefaults();
        SoundManager.playOk();
        this.refresh();
        return;
      }
      Window_Options.prototype.processOk.call(this);
    };

    Window_AudioOptions.prototype.cursorRight = function(wrap) {
      const symbol = this.commandSymbol(this.index());
      if (symbol === "masterVolume") {
        this._changeMasterVolume(+1);
        this.redrawItem(this.index());
        this._previewFor("bgmVolume");
      } else {
        Window_Options.prototype.cursorRight.call(this, wrap);
        if (volumeSymbols.includes(symbol)) this._previewFor(symbol);
      }
    };

    Window_AudioOptions.prototype.cursorLeft = function(wrap) {
      const symbol = this.commandSymbol(this.index());
      if (symbol === "masterVolume") {
        this._changeMasterVolume(-1);
        this.redrawItem(this.index());
        this._previewFor("bgmVolume");
      } else {
        Window_Options.prototype.cursorLeft.call(this, wrap);
        if (volumeSymbols.includes(symbol)) this._previewFor(symbol);
      }
    };

    Window_AudioOptions.prototype.select = function(index) {
      const hasList = Array.isArray(this._list) && this._list.length > 0;
      const currentIndex = this.index();
      const prevSymbol = hasList && currentIndex >= 0 ? this.commandSymbol(currentIndex) : null;
      Window_Selectable.prototype.select.call(this, index);
      const hasListAfter = Array.isArray(this._list) && this._list.length > 0;
      const newIndex = this.index();
      const newSymbol = hasListAfter && newIndex >= 0 ? this.commandSymbol(newIndex) : null;
      if (prevSymbol && newSymbol && prevSymbol !== newSymbol && this._stopAllPreviews) {
        this._stopAllPreviews();
      }
    };

    Window_AudioOptions.prototype._changeMasterVolume = function(sign) {
      const offset = this.volumeOffset ? this.volumeOffset() : 20;
      const oldMaster = Math.max(0, Math.min(100, Number(ConfigManager.masterVolume || 100)));
      const next = Math.max(0, Math.min(100, oldMaster + sign * offset));
      if (next === oldMaster) return;
      const ratio = oldMaster > 0 ? next / oldMaster : (next > 0 ? next / 100 : 1);
      ["bgmVolume","bgsVolume","meVolume","seVolume"].forEach(k => {
        const current = Number(ConfigManager[k] || 0);
        const updated = Math.max(0, Math.min(100, Math.round(current * ratio)));
        ConfigManager[k] = updated;
      });
      ConfigManager.masterVolume = next;
    };

    Window_AudioOptions.prototype._resetAudioDefaults = function() {
      ConfigManager.masterVolume = 100;
      ["bgmVolume","bgsVolume","meVolume","seVolume"].forEach(k => ConfigManager[k] = 100);
    };

    Window_AudioOptions.prototype._previewFor = function(symbol) {
      if (!cfg.audioPreview) return;
      const master = Math.max(0, Math.min(100, Number(ConfigManager.masterVolume || 100)));
      const effVol = k => Math.round(Math.max(0, Math.min(100, Number(ConfigManager[k] || 0))) * master / 100);
      try {
        if (symbol === "bgmVolume" && cfg.previewBgm) {
          if (!audioState.savedBgm && AudioManager.saveBgm) {
            audioState.savedBgm = AudioManager.saveBgm();
          }
          audioState.previewUsed.bgm = true;
          AudioManager.playBgm({ name: cfg.previewBgm, pan: 0, pitch: 100, volume: effVol("bgmVolume") });
        } else if (symbol === "bgsVolume" && cfg.previewBgs) {
          if (!audioState.savedBgs && AudioManager.saveBgs) {
            audioState.savedBgs = AudioManager.saveBgs();
          }
          audioState.previewUsed.bgs = true;
          AudioManager.playBgs({ name: cfg.previewBgs, pan: 0, pitch: 100, volume: effVol("bgsVolume") });
        } else if (symbol === "meVolume" && cfg.previewMe) {
          if (!audioState.savedBgm && AudioManager.saveBgm) {
            audioState.savedBgm = AudioManager.saveBgm();
          }
          audioState.previewUsed.me = true;
          AudioManager.playMe({ name: cfg.previewMe, pan: 0, pitch: 100, volume: effVol("meVolume") });
        } else if (symbol === "seVolume" && cfg.previewSe) {
          audioState.previewUsed.se = true;
          AudioManager.playSe({ name: cfg.previewSe, pan: 0, pitch: 100, volume: effVol("seVolume") });
        }
      } catch (e) {
        debugLog("Audio preview error:", e);
      }
    };

    Window_AudioOptions.prototype._stopAllPreviews = function() {
      try {
        if (audioState.previewUsed.bgm) AudioManager.stopBgm();
        if (audioState.previewUsed.bgs) AudioManager.stopBgs();
        if (audioState.previewUsed.me) AudioManager.stopMe();
        if (audioState.previewUsed.se) AudioManager.stopSe();
      } catch (e) {
        debugLog("Audio stop error:", e);
      } finally {
        audioState.previewUsed = { bgm: false, bgs: false, me: false, se: false };
      }
    };

    // Audio submenu scene
    function Scene_AudioOptions() {
      Scene_MenuBase.call(this);
    }
    Scene_AudioOptions.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_AudioOptions.prototype.constructor = Scene_AudioOptions;

    Scene_AudioOptions.prototype.create = function() {
      Scene_MenuBase.prototype.create.call(this);
      this.createAudioOptionsWindow();
    };

    Scene_AudioOptions.prototype.audioOptionsWindowRect = function() {
      const w = cfg.audioW;
      const h = cfg.audioH;
      const x = (Graphics.boxWidth - w) / 2;
      const y = (Graphics.boxHeight - h) / 2;
      return new Rectangle(x, y, w, h);
    };

    Scene_AudioOptions.prototype.createAudioOptionsWindow = function() {
      const rect = this.audioOptionsWindowRect();
      this._optionsWindow = new Window_AudioOptions(rect);
      this._optionsWindow.setHandler("ok", this.onAudioOk.bind(this));
      this._optionsWindow.setHandler("cancel", this.onAudioCancel.bind(this));
      this.addWindow(this._optionsWindow);
    };

    Scene_AudioOptions.prototype.onAudioOk = function() {
      // Use the normal options behavior for applying changes
      this._optionsWindow.processOk();
    };

    Scene_AudioOptions.prototype.onAudioCancel = function() {
      if (this._optionsWindow && this._optionsWindow._stopAllPreviews) {
        this._optionsWindow._stopAllPreviews();
      }
      this.popScene();
    };

    // Apply theme line height for Options windows
    const _CM_WO_lineHeight = Window_Options.prototype.lineHeight;
    Window_Options.prototype.lineHeight = function() {
      return Number(cfg.themeHeadingFontSize) || _CM_WO_lineHeight.call(this);
    };
    Window_AudioOptions.prototype.lineHeight = function() {
      return Number(cfg.themeHeadingFontSize) || Window_Options.prototype.lineHeight.call(this);
    };
  }

  // Save UI tweaks
  if (cfg.saveUI) {
    Scene_File.prototype.helpWindowRect = () => new Rectangle(0, 0, 1, 1);
    Scene_File.prototype.createHelpWindow = function() {
      this._helpWindow = new Window_Help(this.helpWindowRect());
      this._helpWindow.hide();
      this.addWindow(this._helpWindow);
    };
    Scene_File.prototype.listWindowRect = function() {
      const w = cfg.saveW;
      const h = cfg.saveH;
      const x = (Graphics.boxWidth - w) / 2;
      const y = (Graphics.boxHeight - h) / 2;
      return new Rectangle(x, y, w, h);
    };
    Window_SavefileList.prototype.itemHeight = function() {
      return this.lineHeight() * 2;
    };
    const _WSFC = Window_SavefileList.prototype.drawContents;
    Window_SavefileList.prototype.drawContents = function(info, rect) {
      const lh = this.lineHeight();
      this.changePaintOpacity(this.isEnabled(info));
      if (info.playtime) {
        this.drawText(`Play Duration: ${info.playtime}`, rect.x + 120, rect.y, rect.width - 120, lh, "left");
      }
      if (info.timestamp) {
        const d = new Date(info.timestamp);
        const text = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
        this.drawText(text, rect.x, rect.y + lh, rect.width, lh, "right");
      }
      this.changePaintOpacity(true);
    };
  }

  // === Menu Pictures & Images Support ===
  // Only apply to Scene_Menu, not Scene_Title
  const _CM_SM_create = Scene_Menu.prototype.create;
  Scene_Menu.prototype.create = function() {
    _CM_SM_create.call(this);
    if (cfg.menuImages.length > 0) {
      this._menuPictures = [];
      cfg.menuImages.forEach(img => {
        if (img.filename) {
          const sprite = new Sprite(ImageManager.loadPicture(img.filename));
          sprite.x = Number(img.x) || 0;
          sprite.y = Number(img.y) || 0;
          if (Number(img.width) > 0) sprite.width = Number(img.width);
          if (Number(img.height) > 0) sprite.height = Number(img.height);
          this.addChild(sprite);
          this._menuPictures.push(sprite);
        }
      });
    }
  };

  // === Dim Overlay, Blur, and Decorative Overlays ===
  const _CM_SMB_create = Scene_MenuBase.prototype.create;
  Scene_MenuBase.prototype.create = function() {
    _CM_SMB_create.call(this);
    this._applyDimAndBlur();
  };

  Scene_MenuBase.prototype._applyDimAndBlur = function() {
    // Dim overlay below windows
    if (cfg.dimEnabled) {
      const overlay = new Sprite(new Bitmap(Graphics.boxWidth, Graphics.boxHeight));
      overlay.bitmap.fillRect(0, 0, Graphics.boxWidth, Graphics.boxHeight, cfg.dimColor);
      overlay.opacity = cfg.dimOpacity;
      const idx = this.children.indexOf(this._windowLayer);
      if (idx >= 0) this.addChildAt(overlay, idx);
      else this.addChild(overlay);
      this._dimOverlay = overlay;
    }
    // Background blur
    if (cfg.blurEnabled && this._backgroundSprite && PIXI && PIXI.filters && PIXI.filters.BlurFilter) {
      this._backgroundSprite.filters = [new PIXI.filters.BlurFilter(cfg.blurStrength)];
    }
  };



  // Single update override
  const _CM_SMB_update = Scene_MenuBase.prototype.update;
  Scene_MenuBase.prototype.update = function() {
    _CM_SMB_update.call(this);
    // Nothing here for underline focus; handled in window updates
    if (this._menuPictures) {
      this._menuPictures.forEach((sp, i) => {
        if (i < cfg.menuImages.length) {
          if (i === 0) { sp.x = 0; sp.y = 0; }
          else if (i === 1) { sp.x = Graphics.boxWidth - sp.bitmap.width; sp.y = 0; }
          else if (i === 2) { sp.x = 0; sp.y = Graphics.boxHeight - sp.bitmap.height; }
          else if (i === 3) { sp.x = Graphics.boxWidth - sp.bitmap.width; sp.y = Graphics.boxHeight - sp.bitmap.height; }
        }
      });
    }
  };

  // === Focus Underline Effect and Theming for Windows ===
  const _CM_WS_update = Window_Selectable.prototype.update;
  Window_Selectable.prototype.update = function() {
    _CM_WS_update.call(this);
    if (cfg.focusEffectType === "underline") {
      if (!this._focusUnderlineSprite) {
        this._focusUnderlineSprite = new Sprite(new Bitmap(1, 1));
        this._focusUnderlineSprite.visible = false;
        this._focusUnderlineLastW = 0;
        this._focusUnderlineLastH = 0;
        this.addChild(this._focusUnderlineSprite);
      }
      const idx = this.index();
      const hasItems = Array.isArray(this._list) && this._list.length > 0;
      if (hasItems && idx >= 0 && this.active && this.visible) {
        const rect = this.itemRect(idx);
        const underlineH = Math.max(1, Number(cfg.focusUnderlineHeight) || 2);
        const underlineW = Math.max(1, rect.width - 8);
        if (this._focusUnderlineLastW !== underlineW || this._focusUnderlineLastH !== underlineH) {
          this._focusUnderlineSprite.bitmap = new Bitmap(underlineW, underlineH);
          this._focusUnderlineLastW = underlineW;
          this._focusUnderlineLastH = underlineH;
        } else {
          this._focusUnderlineSprite.bitmap.clear();
        }
        this._focusUnderlineSprite.bitmap.fillAll(cfg.themeAccentColor);
        const sx = typeof this.scrollX === "function" ? this.scrollX() : (this._scrollX || 0);
        const sy = typeof this.scrollY === "function" ? this.scrollY() : (this._scrollY || 0);
        const pad = this.padding || 0;
        this._focusUnderlineSprite.x = pad + rect.x - sx + 4;
        this._focusUnderlineSprite.y = pad + rect.y - sy + rect.height - underlineH - 2;
        this._focusUnderlineSprite.visible = true;
      } else if (this._focusUnderlineSprite) {
        this._focusUnderlineSprite.visible = false;
      }
    }
  };

  // === Frame Toggle Mode Support ===
  if (cfg.frameToggle) {
    // Only affect the menu command window, not all windows
    const _CM_WMC_refreshFrame = Window_MenuCommand.prototype._refreshFrame;
    Window_MenuCommand.prototype._refreshFrame = function() {
      // Do nothing: completely disables the default window frame for menu only
    };
    const _CM_WMC_refreshBack = Window_MenuCommand.prototype._refreshBack;
    Window_MenuCommand.prototype._refreshBack = function() {
      // Do nothing: disables the background for menu only
    };
  }

  // === Menu Open/Close Transitions ===
  // Patch Scene_Menu to ensure both open and close transitions are handled
  const _CM_SM_start = Scene_Menu.prototype.start;
  Scene_Menu.prototype.start = function() {
    _CM_SM_start.call(this);
    if (cfg.menuTransition !== "none") this._applyMenuOpenTransition();
  };
  // Patch popScene for exit animation
  const _CM_SM_popScene = Scene_Menu.prototype.popScene;
  Scene_Menu.prototype.popScene = function() {
    if (cfg.menuTransition !== "none") {
      this._applyMenuExitTransition(() => _CM_SM_popScene.call(this));
    } else {
      _CM_SM_popScene.call(this);
    }
  };

  // Ensure audio previews are fully stopped/restored when exiting Options
  const _CM_SO_popScene = Scene_Options.prototype.popScene;
  Scene_Options.prototype.popScene = function() {
    try {
      restorePreviewAudioIfAny();
    } finally {
      _CM_SO_popScene.call(this);
    }
  };
  // Add the missing transition methods
  Scene_Menu.prototype._applyMenuOpenTransition = function() {
    const win = this._commandWindow;
    if (!win) return;
    if (cfg.menuTransition === "slide") {
      win.x = -win.width;
      win.opacity = 1;
      win.visible = true;
      const targetX = (Graphics.boxWidth - win.width) / 2;
      win.update = function() {
        if (this.x < targetX) {
          this.x += Math.ceil((targetX - this.x) / 4);
          if (this.x >= targetX) this.x = targetX;
        }
        Window_Selectable.prototype.update.call(this);
      };
    } else if (cfg.menuTransition === "zoom") {
      win.scale.x = win.scale.y = 0.2;
      win.opacity = 1;
      win.visible = true;
      win.update = function() {
        if (this.scale.x < 1.0) {
          this.scale.x += 0.1;
          this.scale.y += 0.1;
          if (this.scale.x > 1.0) this.scale.x = this.scale.y = 1.0;
        }
        Window_Selectable.prototype.update.call(this);
      };
    } else if (cfg.menuTransition === "fade") {
      win.opacity = 0;
      win.visible = true;
      win.update = function() {
        if (this.opacity < 255) {
          this.opacity += 32;
          if (this.opacity > 255) this.opacity = 255;
        }
        Window_Selectable.prototype.update.call(this);
      };
    }
  };
  Scene_Menu.prototype._applyMenuExitTransition = function(callback) {
    const win = this._commandWindow;
    if (!win) return callback();
    if (cfg.menuTransition === "slide") {
      const targetX = -win.width;
      win.update = function() {
        if (this.x > targetX) {
          this.x -= Math.ceil((this.x - targetX) / 4);
          if (this.x <= targetX) {
            this.x = targetX;
            callback();
          }
        } else {
          callback();
        }
        Window_Selectable.prototype.update.call(this);
      };
    } else if (cfg.menuTransition === "zoom") {
      win.update = function() {
        if (this.scale.x > 0.2) {
          this.scale.x -= 0.1;
          this.scale.y -= 0.1;
          if (this.scale.x < 0.2) {
            this.scale.x = this.scale.y = 0.2;
            callback();
          }
        } else {
          callback();
        }
        Window_Selectable.prototype.update.call(this);
      };
    } else if (cfg.menuTransition === "fade") {
      win.update = function() {
        if (this.opacity > 0) {
          this.opacity -= 32;
          if (this.opacity < 0) {
            this.opacity = 0;
            callback();
          }
        } else {
          callback();
        }
        Window_Selectable.prototype.update.call(this);
      };
    } else {
      callback();
    }
  };

  // === Layout Logic for Horizontal/Vertical Only ===
  // Patch maxCols for horizontal layout
  const _CM_WMC_maxCols = Window_MenuCommand.prototype.maxCols;
  Window_MenuCommand.prototype.maxCols = function() {
    if (!this._list) return 1;
    if (cfg.menuLayout === "horizontal") return this.maxItems();
    return _CM_WMC_maxCols.call(this);
  };
  // Patch itemRect for horizontal layout only
  const _CM_WMC_itemRect = Window_MenuCommand.prototype.itemRect;
  Window_MenuCommand.prototype.itemRect = function(index) {
    if (!this._list) return new Rectangle(0, 0, cfg.buttonW, cfg.buttonH);
    if (cfg.menuLayout === "horizontal") {
      const rect = new Rectangle();
      rect.width = cfg.buttonW;
      rect.height = cfg.buttonH;
      rect.x = index * (rect.width + this.colSpacing());
      rect.y = 0;
      return rect;
    }
    return _CM_WMC_itemRect.call(this, index);
  };
  // Ensure sizing for scroll calculations uses fixed button sizes
  const _CM_WMC_itemWidth = Window_MenuCommand.prototype.itemWidth;
  Window_MenuCommand.prototype.itemWidth = function() {
    if (cfg.menuLayout === "horizontal") return cfg.buttonW;
    return _CM_WMC_itemWidth.call(this);
  };
  const _CM_WMC_itemHeight = Window_MenuCommand.prototype.itemHeight;
  Window_MenuCommand.prototype.itemHeight = function() {
    if (cfg.menuLayout === "horizontal") return cfg.buttonH;
    return _CM_WMC_itemHeight.call(this);
  };

  // Override commandWindowRect for horizontal layout
  if (cfg.menuLayout === "horizontal") {
    const _CM_SM_commandWindowRect = Scene_Menu.prototype.commandWindowRect;
    Scene_Menu.prototype.commandWindowRect = function() {
      const rect = _CM_SM_commandWindowRect.call(this);
      // Estimate the width needed for horizontal layout
      const estimatedItems = 6; // Estimate number of menu items
      const totalWidth = estimatedItems * cfg.buttonW + (estimatedItems - 1) * 8 + 20;
      rect.width = totalWidth;
      rect.x = (Graphics.boxWidth - totalWidth) / 2;
      return rect;
    };
  }


  // === Icon-Based Menu Entries Support ===
  if (Object.keys(cfg.menuIcons).length > 0) {
    const _CM_WMC_drawItem = Window_MenuCommand.prototype.drawItem;
    Window_MenuCommand.prototype.drawItem = function(index) {
      const rect = this.itemRect(index);
      const symbol = this.commandSymbol(index);
      const iconFile = cfg.menuIcons[symbol];
      if (iconFile) {
        // Remove any previous icon sprite for this index
        if (!this._iconSprites) this._iconSprites = {};
        if (this._iconSprites[index]) {
          this.removeChild(this._iconSprites[index]);
        }
        // Draw only the image, not the button background/frame/text
        const sprite = new Sprite(ImageManager.loadSystem(iconFile));
        const positionSprite = () => {
          const bw = sprite.bitmap ? sprite.bitmap.width : 0;
          const bh = sprite.bitmap ? sprite.bitmap.height : 0;
          sprite.x = rect.x + Math.floor((rect.width - bw) / 2);
          sprite.y = rect.y + Math.floor((rect.height - bh) / 2);
        };
        if (sprite.bitmap && sprite.bitmap.isReady()) {
          positionSprite();
        } else if (sprite.bitmap && sprite.bitmap.addLoadListener) {
          sprite.bitmap.addLoadListener(positionSprite);
        }
        this.addChild(sprite);
        this._iconSprites[index] = sprite;
        // Do not call any other drawing (no background, no text)
      } else {
        _CM_WMC_drawItem.call(this, index);
      }
    };
    // Prevent drawing the button background for image-based entries
    Window_MenuCommand.prototype.drawItemBackground = function(index) {
      const symbol = this.commandSymbol(index);
      if (!cfg.menuIcons[symbol]) {
        Window_Selectable.prototype.drawItemBackground.call(this, index);
      }
      // Otherwise, do nothing (no background for image-based button)
    };
    // Only override drawText for items that have icons
    const _CM_WMC_drawText = Window_MenuCommand.prototype.drawText;
    Window_MenuCommand.prototype.drawText = function(text, x, y, maxWidth, align) {
      // Check if this is for an item with an icon
      const index = this._list.findIndex(item => item.name === text);
      if (index >= 0) {
        const symbol = this.commandSymbol(index);
        if (cfg.menuIcons[symbol]) {
          // Do nothing for image-based entries
          return;
        }
      }
      // Call original for text-based entries
      _CM_WMC_drawText.call(this, text, x, y, maxWidth, align);
    };
  }

  // === Menu Command Detection System ===
  // Function to get all available menu commands
  Window_MenuCommand.prototype.getAllAvailableCommands = function() {
    const actualCommands = [];
    
    // Only get commands from the current menu list
    if (this._list && this._list.length > 0) {
      this._list.forEach(item => {
        if (item.symbol) {
          actualCommands.push({
            symbol: item.symbol,
            name: item.name,
            enabled: item.enabled
          });
        }
      });
    }
    
    return actualCommands;
  };
  
  // Log available commands for developers
  const _CM_WMC_initialize = Window_MenuCommand.prototype.initialize;
  Window_MenuCommand.prototype.initialize = function(rect) {
    _CM_WMC_initialize.call(this, rect);
    
    // Log available commands after a short delay to ensure all plugins have loaded
    setTimeout(() => {
      const commands = this.getAllAvailableCommands();
      debugLog("=== Available Menu Commands ===");
      debugLog("Actual commands in current menu:");
      commands.forEach(cmd => {
        debugLog(`- ${cmd.symbol}: "${cmd.name}"`);
      });
      debugLog("=== End Available Commands ===");
      debugLog("To replace a button with an icon, add it to MenuCommandIcons parameter:");
      debugLog('Example: {"symbol":"item","image":"ButtonSet"}');
    }, 1000);
  };

  // === Plugin Commands ===
  // Single plugin command to get available menu commands
  // Integrate dynamic buttons into the menu system
  const _CM_WMC_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
  Window_MenuCommand.prototype.addOriginalCommands = function() {
    _CM_WMC_addOriginalCommands.call(this);
    // Add dynamic buttons
    // dynamicMenuButtons.forEach(btn => { // This line is removed as per the edit hint
    //   this.addCommand(btn.name, btn.symbol, btn.enabled, btn.ext);
    // });
  };

  // Fix horizontal layout window sizing and add dynamic button handlers
  const _CM_SM_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
  Scene_Menu.prototype.createCommandWindow = function() {
    _CM_SM_createCommandWindow.call(this);
    
    // Fix horizontal layout window sizing - delay to ensure list is populated
    if (cfg.menuLayout === "horizontal" && this._commandWindow) {
      setTimeout(() => {
        if (this._commandWindow && this._commandWindow._list && this._commandWindow._list.length > 0) {
          const spacing = this._commandWindow.colSpacing();
          const items = this._commandWindow.maxItems();
          const totalWidthAll = items * cfg.buttonW + (items - 1) * spacing + 20;
          this._commandWindow.width = totalWidthAll;
          this._commandWindow.x = (Graphics.boxWidth - totalWidthAll) / 2;
          // Refresh to apply the new size
          this._commandWindow.refresh();
          debugLog(`Horizontal layout: Resized window to ${totalWidthAll}px for ${items} buttons`);
        }
      }, 100);
    }
  };


  // Register plugin command inside the main scope
  PluginManager.registerCommand("CustomMenu", "GetAvailableCommands", {
    // No parameters needed
  }, args => {
    console.log("=== Available Menu Commands (Plugin Command) ===");
    console.log("Plugin command executed successfully!");
    
    // Try to get commands from current scene
    if (SceneManager._scene) {
      console.log("Current scene found:", SceneManager._scene.constructor.name);
      
      if (SceneManager._scene._commandWindow) {
        console.log("Command window found, getting actual commands...");
        const commands = SceneManager._scene._commandWindow.getAllAvailableCommands();
        if (commands.length > 0) {
          console.log("Actual commands in current menu:");
          commands.forEach(cmd => {
            console.log(`- ${cmd.symbol}: "${cmd.name}"`);
          });
        } else {
          console.log("No commands found in current menu.");
        }
      } else {
        console.log("Command window not found in current scene");
        console.log("Please open the menu first to see available commands.");
      }
    } else {
      console.log("No scene found");
    }
    
    console.log("=== End Available Commands ===");
  });

  // (Removed duplicate plugin command registrations to avoid double output)

  debugLog("CustomMenu plugin command registered: GetAvailableCommands");
})();
