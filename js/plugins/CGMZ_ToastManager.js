/*:
 * @author Casper Gaming
 * @url https://www.caspergaming.com/plugins/cgmz/toastmanager/
 * @target MZ
 * @base CGMZ_Core
 * @orderAfter CGMZ_Core
 * @plugindesc Manages CGMZ toast (or pop up) windows for your game
 * @help
 * ============================================================================
 * For terms and conditions using this plugin in your game please visit:
 * https://www.caspergaming.com/terms-of-use/
 * ============================================================================
 * Become a Patron to get access to beta/alpha plugins plus other goodies!
 * https://www.patreon.com/CasperGamingRPGM
 * ============================================================================
 * Version: 1.3.0
 * ----------------------------------------------------------------------------
 * Compatibility: Only tested with my CGMZ plugins.
 * Made for RPG Maker MZ 1.6.0
 * ----------------------------------------------------------------------------
 * Description: This plugin creates up to 3 toast windows in each scene (some
 * exceptions) which will display brief information or images to the player
 * for a short amount of time. Windows will be shown as they are freed in the
 * case of a queue of more than 3 toasts.
 * ----------------------------------------------------------------------------
 * Documentation:
 * ----------------------------Plugin Commands---------------------------------
 * This plugin supports the following plugin commands:
 * • Create Text Toast
 * Creates a new text toast with options, adds it to the toast queue.
 * 
 * • Create Image Toast
 * Creates a new image toast with options, adds it to the toast queue.
 * Image dimensions should be 336x72 by default (if changing width,
 * subtract 24 from width value).
 * ------------------------------Saved Games-----------------------------------
 * This plugin is fully compatible with saved games. This means you can:
 *
 * ✓ Add this plugin to a saved game and it will work as expected
 * ✓ Change any plugin params and changes will be reflected in saved games
 * ✓ Remove the plugin with no issue to save data
 * -----------------------------Filename---------------------------------------
 * The filename for this plugin MUST remain CGMZ_ToastManager.js
 * This is what it comes as when downloaded. The filename is used to load
 * parameters and execute plugin commands. If you change it, things will begin
 * behaving incorrectly and your game will probably crash. Please do not
 * rename the js file.
 * ----------------------------Version History---------------------------------
 * Version 1.0.0 - Initial Release
 *
 * Version 1.0.1:
 * - SE are no longer mandatory on toasts
 *
 * Version 1.0.2:
 * - Toast windows no longer update if they are not visible
 * - Fix crash with VS Debugger (hopefully)
 *
 * Version 1.0.3:
 * - Fix bug with toast window custom widths not being centered
 *
 * Version 1.1.0:
 * - Added parameter for changing the display time of the toast
 *
 * Version 1.2.0:
 * - Added parameter for Window/Dim/Transparent appearance of window
 * - Added parameter to change window color
 *
 * Version 1.2.1:
 * - Update color parameter to use RMMZ 1.6.0 new color picker UI
 *
 * Version 1.3.0:
 * - Added option to use a different windowskin for each toast
 * - Added option to set the toast window's height
 * - Fixed bug when using same custom width twice in a row
 * - Optimized image loading for image toasts
 *
 * @command Create Text Toast
 * @text Create Text Toast
 * @desc Creates a text-based toast window
 *
 * @arg lineOne
 * @type text
 * @text Line 1
 * @desc Text to display in Line 1 of the toast. \v, \n, \p, and \g text codes supported.
 * @default 
 *
 * @arg lineOneAlignment
 * @type combo
 * @text Line 1 Alignment
 * @option left
 * @option center
 * @option right
 * @desc Align the text in line 1 left, center, or right
 * @default center
 *
 * @arg lineOneColor
 * @type color
 * @text Line One Color
 * @desc The color of line 1's text (same as in show text event command)
 * @default 0
 *
 * @arg lineTwo
 * @type text
 * @text Line 2
 * @desc Text to display in Line 2 of the toast. \v, \n, \p, and \g text codes supported.
 * @default 
 *
 * @arg lineTwoAlignment
 * @type combo
 * @text Line 2 Alignment
 * @option left
 * @option center
 * @option right
 * @desc Align the text in line 2 left, center, or right
 * @default center
 *
 * @arg lineTwoColor
 * @type color
 * @text Line Two Color
 * @desc The color of line 2's text (same as in show text event command)
 * @default 0
 *
 * @arg height
 * @type number
 * @min 1
 * @desc Height (in text lines) to make the toast window if not using fixed height parameter
 * @default 2
 *
 * @arg width
 * @type number
 * @min 1
 * @text Width
 * @desc Width (in pixels) to make the toast window if not using fixed width parameter
 * @default 360
 *
 * @arg SE
 * @type file
 * @dir audio/se
 * @text Sound Effect
 * @desc Sound effect to play when the toast appears
 * @default 
 *
 * @arg Display Time
 * @type number
 * @min 0
 * @desc Display time to show the toast (in frames). If 0, falls back to global Display Time param
 * @default 0
 *
 * @arg backgroundStyle
 * @type select
 * @option Window
 * @option Dim
 * @option Transparent
 * @text Background Style
 * @desc Window background style. Same as Show Text event command.
 * @default Window
 *
 * @arg windowskinTone
 * @type struct<Tone>
 * @text Windowskin Tone
 * @desc Windowskin tone (color)
 *
 * @arg windowskin
 * @type file
 * @dir img/
 * @desc The windowskin file to use for the toast window.
 *
 * @command Create Image Toast
 * @text Create Image Toast
 * @desc Creates an image-based toast window
 *
 * @arg image
 * @type file
 * @dir img/pictures
 * @text Image
 * @desc Image to display in the toast
 * @default 
 *
 * @arg showBackground
 * @type boolean
 * @text Show Background
 * @desc Whether to show the window background or not
 * @default false
 *
 * @arg width
 * @type number
 * @min 1
 * @text Width
 * @desc Width (in pixels) to make the toast window if not using fixed width plugin parameter
 * @default 360
 *
 * @arg height
 * @type number
 * @min 1
 * @desc Height (in text lines) to make the toast window if not using fixed height parameter
 * @default 2
 *
 * @arg SE
 * @type file
 * @dir audio/se
 * @text Sound Effect
 * @desc Sound effect to play when the toast appears
 * @default 
 *
 * @arg Display Time
 * @type number
 * @min 0
 * @desc Display time to show the toast (in frames). If 0, falls back to global Display Time param
 * @default 0
 *
 * @arg windowskinTone
 * @type struct<Tone>
 * @text Windowskin Tone
 * @desc Windowskin tone (color)
 *
 * @arg windowskin
 * @type file
 * @dir img/
 * @desc The windowskin file to use for the toast window.
 * 
 * @param Max Window Count
 * @type number
 * @min 1
 * @max 3
 * @desc Determines max amount of toast windows shown at once
 * @default 1
 *
 * @param Spacing
 * @type number
 * @min 0
 * @desc Determines pixels between each toast window if showing multiple.
 * @default 12
 *
 * @param Width
 * @type number
 * @min 0
 * @desc Determines default width (in pixels) of the toast windows
 * @default 360
 *
 * @param Fixed Width
 * @type boolean
 * @desc Determines if toasts should adjust width or not. If true, toasts always use the above width parameter.
 * @default false
 *
 * @param Height
 * @type number
 * @min 1
 * @desc Determines default height (in text lines) of the toast windows
 * @default 2
 *
 * @param Fixed Height
 * @type boolean
 * @desc Determines if toasts should adjust height or not. If true, toasts always use the above height parameter.
 * @default true
 *
 * @param Display Time
 * @type number
 * @min 0
 * @desc Length of time toast is displayed for (in frames)
 * @default 240
 *
 * @param Display From Bottom
 * @type boolean
 * @desc Determines if toasts should display from the bottom of the screen up, or from top down.
 * @default true
*/
/*~struct~Tone:
 * @param Red
 * @type number
 * @min -255
 * @max 255
 * @desc Amount of red in the tone
 * @default 0
 *
 * @param Green
 * @type number
 * @min -255
 * @max 255
 * @desc Amount of green in the tone
 * @default 0
 *
 * @param Blue
 * @type number
 * @min -255
 * @max 255
 * @desc Amount of blue in the tone
 * @default 0
*/
/*:zh-CN
 * @author Casper Gaming
 * @url https://www.caspergaming.com/plugins/cgmz/toastmanager/
 * @target MZ
 * @base CGMZ_Core
 * @orderAfter CGMZ_Core
 * @plugindesc 信息弹窗系统（配合作者各类插件进行提示）
 * @help
 * ============================================================================
 * 【使用条款】
 * 1、本插件可作商用或非商用。
 * 2、须注明插件作者"Casper Gaming"。
 * 3、须提供该插件的作者网站链接。
 * 4、最终使用条款以作者官网公告为准。https://www.caspergaming.com/terms-of-use/
 * ============================================================================
 * 【赞助支持】
 * 您可以登陆以下网站并对作者进行支持和赞助。
 * 然后获得作者和其插件的最新资讯，以及测试版插件的试用。
 * https://www.patreon.com/CasperGamingRPGM
 * ============================================================================
 * 【插件版本】V 1.3.0
 * ----------------------------------------------------------------------------
 * 【兼容性】仅测试作者所制作的插件
 * 【RM版本】RPG Maker MZ 1.6.0
 * ----------------------------------------------------------------------------
 * 【插件描述】
 * 在游戏中可以跳出弹窗，来提示玩家获得成就、专业升级、习得配方等。
 * 玩家需要配合使用作者对应的其他插件来获得相关的提示效果。
 * 可以设置同一时间显示最多3个弹窗、弹窗尺寸、显示时间和新旧弹窗切换效果等。
 * 本插件不是传统意义上的物品得失自动提示插件，但可以用插件指令手动制作文字或图片提示。
 *
 * 【搭配插件】
 * CGMZ Core:核心插件，运行作者插件的必须插件。
 * CGMZ Professions:专业技能插件。可提示专业技能升级等。
 * CGMZ Crafting:手工艺合成插件。可提示获得配方等。
 * CGMZ Achievements:成就系统插件。可提示成就达成等。
 * 以及其他该作者支持弹窗提示功能的插件。
 * 注：本插件在插件列表中必须置于"核心插件Core"之下，并置于其他可提示插件之上。
 * ----------------------------------------------------------------------------
 * 【使用说明】
 * 一、插件指令：
 * 1. 制作文字弹窗（Create Text Toast）
 * 2. 制作图片弹窗（Create Image Toast）
 * 注：图片弹窗尺寸为336×72像素，调整宽度请以24的倍数加减调整。
 *
 * 二、其他插件的弹窗设置
 * 作者其他插件均有不同效果的弹窗设置，具体请在其他插件的参数设置中调整。
 *
 * ---------------------------------------------------------------------------
 *【版本更新历史】
 * Version 1.0.0 - Initial Release
 * Version 1.0.1:
 * - SE are no longer mandatory on toasts
 * Version 1.0.2:
 * - Toast windows no longer update if they are not visible
 * - Fix crash with VS Debugger (hopefully)
 * Version 1.0.3:
 * - Fix bug with toast window custom widths not being centered
 * Version 1.1.0:
 * - Added parameter for changing the display time of the toast
 * Version 1.2.0:
 * - Added parameter for Window/Dim/Transparent appearance of window
 * - Added parameter to change window color
 * Version 1.2.1:
 * - Update color parameter to use RMMZ 1.6.0 new color picker UI
 * Version 1.3.0:
 * - Added option to use a different windowskin for each toast
 * - Added option to set the toast window's height
 * - Fixed bug when using same custom width twice in a row
 * - Optimized image loading for image toasts
 *
 * @command Create Text Toast
 * @text 制作文字弹窗
 * @desc 制作一个只有文字描述的弹窗。
 *
 * @arg lineOne
 * @type text
 * @text 第一行描述
 * @desc 设置弹窗第一行文字的内容。支持变量\v，角色名\n，队友序号\p和货币单位\g的文本指令。
 * @default 
 *
 * @arg lineOneAlignment
 * @type combo
 * @text 第一行文字位置
 * @option left
 * @option center
 * @option right
 * @desc 设置弹窗第一行文字位置。Left-靠左，Center-居中，Right-靠右。
 * @default center
 *
 * @arg lineOneColor
 * @type color
 * @text 第一行文字颜色
 * @desc 设置弹窗第一行文字颜色。数值参照显示文本事件的颜色序号设置。
 * @default 0
 *
 * @arg lineTwo
 * @type text
 * @text 第二行描述
 * @desc 设置弹窗第二行文字的内容。支持变量\v，角色名\n，队友序号\p和货币单位\g的文本指令。
 * @default 
 *
 * @arg lineTwoAlignment
 * @type combo
 * @text 第二行文字位置
 * @option left
 * @option center
 * @option right
 * @desc 设置弹窗第二行文字位置。Left-靠左，Center-居中，Right-靠右。
 * @default center
 *
 * @arg lineTwoColor
 * @type color
 * @text 第二行文字颜色
 * @desc 设置弹窗第二行文字颜色。数值参照显示文本事件的颜色序号设置。
 * @default 0
 *
 * @arg width
 * @type number
 * @min 1
 * @text 宽度
 * @desc 设置提示弹窗的宽度，默认为360像素。
 * @default 360
 *
 * @arg height
 * @type number
 * @min 1
 * @desc Height (in text lines) to make the toast window if not using fixed height parameter
 * @default 2
 *
 * @arg SE
 * @type file
 * @dir audio/se
 * @text 音效
 * @desc 设置一个弹窗提示时的音效。
 * @default 
 *
 * @arg Display Time
 * @type number
 * @min 0
 * @desc Display time to show the toast (in frames). If 0, falls back to global Display Time param
 * @default 0
 *
 * @arg backgroundStyle
 * @type select
 * @option Window
 * @option Dim
 * @option Transparent
 * @text Background Style
 * @desc Window background style. Same as Show Text event command.
 * @default Window
 *
 * @arg windowskinTone
 * @type struct<Tone>
 * @text Windowskin Tone
 * @desc Windowskin tone (color)
 *
 * @arg windowskin
 * @text windowskin
 * @type file
 * @dir img/
 * @desc The windowskin file to use for the toast window.
 *
 * @command Create Image Toast
 * @text 制作图片弹窗
 * @desc 制作一个只有图片的弹窗。（默认尺寸建议：336×72像素）
 *
 * @arg image
 * @type file
 * @dir img/pictures
 * @text 图片
 * @desc 选择一张作为提示用的图片。（默认尺寸建议：336×72像素）
 * @default 
 *
 * @arg showBackground
 * @type boolean
 * @text 显示边框
 * @desc 显示图片时是否显示默认UI的边框？
 * @default false
 *
 * @arg width
 * @type number
 * @min 1
 * @text 宽度
 * @desc 设置提示弹窗的宽度，默认为360像素。
 * @default 360
 *
 * @arg height
 * @type number
 * @min 1
 * @desc Height (in text lines) to make the toast window if not using fixed height parameter
 * @default 2
 *
 * @arg SE
 * @type file
 * @dir audio/se
 * @text 音效
 * @desc 选择一个弹窗提示时的音效。
 * @default 
 *
 * @arg Display Time
 * @type number
 * @min 0
 * @desc Display time to show the toast (in frames). If 0, falls back to global Display Time param
 * @default 0
 *
 * @arg windowskinTone
 * @type struct<Tone>
 * @text Windowskin Tone
 * @desc Windowskin tone (color)
 *
 * @arg windowskin
 * @text windowskin
 * @type file
 * @dir img/
 * @desc The windowskin file to use for the toast window.
 * 
 * @param Max Window Count
 * @type number
 * @min 1
 * @max 3
 * @text 弹窗数
 * @desc 设置同一时间显示的最大弹窗数。（数量1~3）
 * @default 1
 *
 * @param Spacing
 * @type number
 * @min 0
 * @text 弹窗间隔
 * @desc 同时显示多个弹窗时，设置弹窗之间的间隔。
 * @default 12
 *
 * @param Width
 * @type number
 * @min 0
 * @text 弹窗宽度
 * @desc 设置提示弹窗的宽度。
 * @default 360
 *
 * @param Fixed Width
 * @type boolean
 * @text 统一宽度
 * @desc 是否统一调整弹窗宽度？Ture-统一使用"弹窗宽度"设置的宽度。
 * @default false
 *
 * @param Height
 * @type number
 * @min 1
 * @desc Determines default height (in text lines) of the toast windows
 * @default 2
 *
 * @param Fixed Height
 * @type boolean
 * @desc Determines if toasts should adjust height or not. If true, toasts always use the above height parameter.
 * @default true
 *
 * @param Display Time
 * @type number
 * @min 0
 * @text 显示时间
 * @desc 弹窗在画面上显示的时长。（单位:帧，60帧=1秒）
 * @default 240
 *
 * @param Display From Bottom
 * @type boolean
 * @text 弹窗位置
 * @desc Ture-底部显示，False-顶部显示。
 * @default true
*/
/*~struct~Tone:zh-CN
 * @param Red
 * @type number
 * @min -255
 * @max 255
 * @desc Amount of red in the tone
 * @default 0
 *
 * @param Green
 * @type number
 * @min -255
 * @max 255
 * @desc Amount of green in the tone
 * @default 0
 *
 * @param Blue
 * @type number
 * @min -255
 * @max 255
 * @desc Amount of blue in the tone
 * @default 0
*/
var Imported = Imported || {};
Imported.CGMZ_ToastManager = true;
var CGMZ = CGMZ || {};
CGMZ.Versions = CGMZ.Versions || {};
CGMZ.Versions["Toast Manager"] = "1.3.0";
CGMZ.ToastManager = CGMZ.ToastManager || {};
CGMZ.ToastManager.parameters = PluginManager.parameters('CGMZ_ToastManager');
CGMZ.ToastManager.MaxWindowCount = Number(CGMZ.ToastManager.parameters["Max Window Count"]);
CGMZ.ToastManager.Spacing = Number(CGMZ.ToastManager.parameters["Spacing"]);
CGMZ.ToastManager.Width = Number(CGMZ.ToastManager.parameters["Width"]);
CGMZ.ToastManager.Height = Number(CGMZ.ToastManager.parameters["Height"]);
CGMZ.ToastManager.DisplayTime = Number(CGMZ.ToastManager.parameters["Display Time"]);
CGMZ.ToastManager.FixedWidth = (CGMZ.ToastManager.parameters["Fixed Width"] === "true");
CGMZ.ToastManager.FixedHeight = (CGMZ.ToastManager.parameters["Fixed Height"] === "true");
CGMZ.ToastManager.DisplayFromBottom = (CGMZ.ToastManager.parameters["Display From Bottom"] === "true");
//=============================================================================
// CGMZ_Temp
//-----------------------------------------------------------------------------
// Store data to be used for toast windows.
//=============================================================================
//-----------------------------------------------------------------------------
// Alias. Create toast window array.
//-----------------------------------------------------------------------------
const alias_CGMZ_ToastManager_createPluginData = CGMZ_Temp.prototype.createPluginData;
CGMZ_Temp.prototype.createPluginData = function() {
	alias_CGMZ_ToastManager_createPluginData.call(this);
	this._toastWindows = [];
};
//-----------------------------------------------------------------------------
// Alias. Create toast window array.
//-----------------------------------------------------------------------------
const alias_CGMZ_ToastManager_registerPluginCommands = CGMZ_Temp.prototype.registerPluginCommands;
CGMZ_Temp.prototype.registerPluginCommands = function() {
	alias_CGMZ_ToastManager_registerPluginCommands.call(this);
	PluginManager.registerCommand("CGMZ_ToastManager", "Create Text Toast", this.pluginCommandCreateTextToast);
	PluginManager.registerCommand("CGMZ_ToastManager", "Create Image Toast", this.pluginCommandCreateImageToast);
};
//-----------------------------------------------------------------------------
// Creates a text-based toast object from a plugin command
//-----------------------------------------------------------------------------
CGMZ_Temp.prototype.pluginCommandCreateTextToast = function(args) {
	let toast = {};
	toast.isText = true;
	toast.width = Number(args.width);
	if(args.height) toast.height = Number(args.height);
	toast.SE = {name: args.SE, pan: 0, pitch: 100, volume: 100};
	toast.lineOne = args.lineOne;
	toast.lineOneColor = Number(args.lineOneColor);
	toast.lineOneAlignment = args.lineOneAlignment;
	toast.lineTwo = args.lineTwo;
	toast.lineTwoColor = Number(args.lineTwoColor);
	toast.lineTwoAlignment = args.lineTwoAlignment;
	toast.displayTime = Number(args["Display Time"]);
	toast.backgroundStyle = args.backgroundStyle;
	toast.windowskinTone = args.windowskinTone;
	if(args.windowskin) toast.windowskin = CGMZ_Utils.getImageData(args.windowskin, "img");
	$cgmzTemp.createNewToast(toast);
};
//-----------------------------------------------------------------------------
// Creates an image-based toast object from a plugin command
//-----------------------------------------------------------------------------
CGMZ_Temp.prototype.pluginCommandCreateImageToast = function(args) {
	let toast = {};
	toast.isImage = true;
	toast.width = Number(args.width);
	if(args.height) toast.height = Number(args.height);
	toast.SE = {name: args.SE, pan: 0, pitch: 100, volume: 100};
	toast.showBackground = (args.showBackground === "true");
	toast.picture = args.image
	toast.displayTime = Number(args["Display Time"]);
	toast.windowskinTone = args.windowskinTone;
	if(args.windowskin) toast.windowskin = CGMZ_Utils.getImageData(args.windowskin, "img");
	$cgmzTemp.createNewToast(toast);
};
//-----------------------------------------------------------------------------
// Add new toast object to toast queue
//-----------------------------------------------------------------------------
CGMZ_Temp.prototype.createNewToast = function(toastObject) {
	this._toastWindows.push(toastObject);
};
//-----------------------------------------------------------------------------
// Get first toast from queue
//-----------------------------------------------------------------------------
CGMZ_Temp.prototype.getToast = function() {
	return this._toastWindows.shift();
};
//-----------------------------------------------------------------------------
// Look at the first toast object without removing from queue
//-----------------------------------------------------------------------------
CGMZ_Temp.prototype.peekToast = function() {
	return this._toastWindows[0];
};
//-----------------------------------------------------------------------------
// Determine if toast waiting for display exists
//-----------------------------------------------------------------------------
CGMZ_Temp.prototype.hasToast = function() {
	return this._toastWindows.length > 0;
};
//=============================================================================
// SceneManager
//-----------------------------------------------------------------------------
// Determine if the scene should have toast windows made
//=============================================================================
//-----------------------------------------------------------------------------
// Determine if the scene should make toast windows
//-----------------------------------------------------------------------------
SceneManager.CGMZ_ToastManager_canCreateToasts = function() {
	if(this._scene.constructor === Scene_File || this._scene.constructor === Scene_Boot || this._scene.constructor === Scene_Gameover ||
	   this._scene.constructor === Scene_Save || this._scene.constructor === Scene_Load || this._scene.constructor === Scene_Options ||
	   this._scene.constructor === Scene_Title) {
		return false;
	}
	return true;
};
//=============================================================================
// Scene_Base
//-----------------------------------------------------------------------------
// Modify the base scene to add handling for the toast windows.
//=============================================================================
//-----------------------------------------------------------------------------
// Alias. Initialize whether the scene has toasts to false
//-----------------------------------------------------------------------------
const alias_CGMZ_ToastManager_SceneBase_initialize = Scene_Base.prototype.initialize;
Scene_Base.prototype.initialize = function() {
    alias_CGMZ_ToastManager_SceneBase_initialize.call(this);
	this._cgmz_hasToastWindows = false;
};
//-----------------------------------------------------------------------------
// Alias. Create toast windows after scene makes the window layer (if needed)
//-----------------------------------------------------------------------------
const alias_CGMZ_ToastManager_SceneBase_createWindowLayer = Scene_Base.prototype.createWindowLayer;
Scene_Base.prototype.createWindowLayer = function() {
    alias_CGMZ_ToastManager_SceneBase_createWindowLayer.call(this);
	if(SceneManager.CGMZ_ToastManager_canCreateToasts()) {
		this._cgmz_toastLayer = new WindowLayer();
		this._cgmz_toastLayer.x = (Graphics.width - Graphics.boxWidth) / 2;
		this._cgmz_toastLayer.y = (Graphics.height - Graphics.boxHeight) / 2;
		this.addChild(this._cgmz_toastLayer);
		this.CGMZ_ToastManager_createToastWindows();
	}
};
//-----------------------------------------------------------------------------
// Alias. Remove toast window layer.
//-----------------------------------------------------------------------------
const alias_CGMZ_ToastManager_SceneBase_terminate = Scene_Base.prototype.terminate;
Scene_Base.prototype.terminate = function() {
	alias_CGMZ_ToastManager_SceneBase_terminate.call(this);
	this.removeChild(this._cgmz_toastLayer);
};
//-----------------------------------------------------------------------------
// Add toast window
//-----------------------------------------------------------------------------
Scene_Base.prototype.CGMZ_ToastManager_addToast = function(window) {
    this._cgmz_toastLayer.addChild(window);
};
//-----------------------------------------------------------------------------
// Alias. Update toast windows
//-----------------------------------------------------------------------------
const alias_CGMZ_ToastManager_SceneBase_update = Scene_Base.prototype.update;
Scene_Base.prototype.update = function() {
	alias_CGMZ_ToastManager_SceneBase_update.call(this);
	if(this._cgmz_hasToastWindows && this.isActive() && !this.isBusy()) {
        this.CGMZ_ToastManager_updateToastWindows();
    }
};
//-----------------------------------------------------------------------------
// Create amount of toast windows depending on need.
//-----------------------------------------------------------------------------
Scene_Base.prototype.CGMZ_ToastManager_createToastWindows = function() {
	const rect1 = this.CGMZ_ToastManager_toastWindowRect();
    this._cgmz_toastWindow1 = new CGMZ_Window_Toast(rect1);
    this.CGMZ_ToastManager_addToast(this._cgmz_toastWindow1);
	if(CGMZ.ToastManager.MaxWindowCount > 1) {
		const rect2 = this.CGMZ_ToastManager_toastWindowRect();
		this._cgmz_toastWindow2 = new CGMZ_Window_Toast(rect2);
		this.CGMZ_ToastManager_addToast(this._cgmz_toastWindow2);
	}
	if(CGMZ.ToastManager.MaxWindowCount > 2) {
		const rect3 = this.CGMZ_ToastManager_toastWindowRect();
		this._cgmz_toastWindow3 = new CGMZ_Window_Toast(rect3);
		this.CGMZ_ToastManager_addToast(this._cgmz_toastWindow3);
	}
	this._cgmz_hasToastWindows = true;
};
//-----------------------------------------------------------------------------
// Get the toast window's starting rect. All values set to 0 because toast
// window properties are set for each toast window.
//-----------------------------------------------------------------------------
Scene_Base.prototype.CGMZ_ToastManager_toastWindowRect = function() {
	return new Rectangle(0, 0, 0, 0);
};
//-----------------------------------------------------------------------------
// Update toast windows. Determine which ones can open and their y value.
//-----------------------------------------------------------------------------
Scene_Base.prototype.CGMZ_ToastManager_updateToastWindows = function() {
	if($cgmzTemp.hasToast()) {
		if(!this._cgmz_toastWindow1.isDisplaying() && this.CGMZ_ToastManager_canDisplayToast(1, $cgmzTemp.peekToast())) {
			const y = (CGMZ.ToastManager.DisplayFromBottom) ? Graphics.boxHeight : 0;
			this._cgmz_toastWindow1.y = y;
			this._cgmz_toastWindow1.open($cgmzTemp.getToast());
		}
		else if(CGMZ.ToastManager.MaxWindowCount > 1 && !this._cgmz_toastWindow2.isDisplaying() && this.CGMZ_ToastManager_canDisplayToast(2, $cgmzTemp.peekToast())) {
			if(CGMZ.ToastManager.DisplayFromBottom) {
				this._cgmz_toastWindow2.y = this._cgmz_toastWindow1.y - CGMZ.ToastManager.Spacing;
			} else {
				this._cgmz_toastWindow2.y = this._cgmz_toastWindow1.y + this._cgmz_toastWindow1.height + CGMZ.ToastManager.Spacing;
			}
			this._cgmz_toastWindow2.open($cgmzTemp.getToast());
		}
		else if(CGMZ.ToastManager.MaxWindowCount > 2 && !this._cgmz_toastWindow3.isDisplaying()) {
			if(CGMZ.ToastManager.DisplayFromBottom) {
				this._cgmz_toastWindow3.y = this._cgmz_toastWindow2.y - CGMZ.ToastManager.Spacing;
			} else {
				this._cgmz_toastWindow3.y = this._cgmz_toastWindow2.y + this._cgmz_toastWindow2.height + CGMZ.ToastManager.Spacing;
			}
			this._cgmz_toastWindow3.open($cgmzTemp.getToast());
		}
	}
};
//-----------------------------------------------------------------------------
// Determine if there is enough space for the toast to display
// Always true if fixed height, always true if window is 1 and max is 1,
// always true if window is 2 and max is 2. Method not called for third window
// as third window can always display.
//-----------------------------------------------------------------------------
Scene_Base.prototype.CGMZ_ToastManager_canDisplayToast = function(toastNum, toastObject) {
	if(CGMZ.ToastManager.FixedHeight) return true;
	if(toastNum === 1 && CGMZ.ToastManager.MaxWindowCount === 1) return true;
	if(toastNum === 2 && (CGMZ.ToastManager.MaxWindowCount === 2 || !this._cgmz_toastWindow3._isDisplaying)) return true;
	if(!this._cgmz_toastWindow2._isDisplaying && !this._cgmz_toastWindow3._isDisplaying) return true;
	const neededHeight = (toastObject.height) ? this.calcWindowHeight(toastObject.height, false) : this.calcWindowHeight(CGMZ.ToastManager.Height, false);
	let y = (CGMZ.ToastManager.DisplayFromBottom) ? Graphics.boxHeight : 0;
	if(toastNum === 2 && CGMZ.ToastManager.DisplayFromBottom) y = this._cgmz_toastWindow1.y - CGMZ.ToastManager.Spacing;
	if(toastNum === 2 && !CGMZ.ToastManager.DisplayFromBottom) y = this._cgmz_toastWindow1.y + this._cgmz_toastWindow1.height + CGMZ.ToastManager.Spacing;
	const line2 = (CGMZ.ToastManager.MaxWindowCount > 1) ? {y:this._cgmz_toastWindow2.y,height:this._cgmz_toastWindow2.height} : {y:0,height:0};
	const line3 = (CGMZ.ToastManager.MaxWindowCount > 2) ? {y:this._cgmz_toastWindow3.y,height:this._cgmz_toastWindow3.height} : {y:0,height:0};
	if(toastNum === 1) {
		if(CGMZ.ToastManager.MaxWindowCount > 2 && this._cgmz_toastWindow3._isDisplaying) {
			if((CGMZ.ToastManager.DisplayFromBottom)) {
				if(y > (line3.y + line3.height) && (y - neededHeight) < (line3.y + line3.height)) return false;
			} else {
				if(y < (line3.y) && (y + neededHeight) > (line3.y)) return false;
			}
		}
		if(CGMZ.ToastManager.MaxWindowCount > 1) {
			if((CGMZ.ToastManager.DisplayFromBottom)) {
				if(y > (line2.y + line2.height) && (y - neededHeight) < (line2.y + line2.height)) return false;
			} else {
				if(y < (line2.y) && (y + neededHeight) > (line2.y)) return false;
			}
		}
	}
	if(toastNum === 2 && CGMZ.ToastManager.MaxWindowCount > 2 && this._cgmz_toastWindow3._isDisplaying) {
		if(!this._cgmz_toastWindow1._isDisplaying) return false;
		if((CGMZ.ToastManager.DisplayFromBottom)) {
			if(y > (line3.y + line3.height) && (y - neededHeight) < (line3.y + line3.height)) return false;
		} else {
			if(y < (line3.y) && (y + neededHeight) > (line3.y)) return false;
		}
	}
	return true;
};
//=============================================================================
// CGMZ_Window_Toast
//-----------------------------------------------------------------------------
// The toast window, handles displaying the toast information
//=============================================================================
function CGMZ_Window_Toast() {
    this.initialize.apply(this, arguments);
}
CGMZ_Window_Toast.prototype = Object.create(Window_Base.prototype);
CGMZ_Window_Toast.prototype.constructor = CGMZ_Window_Toast;
//-----------------------------------------------------------------------------
// Initialize
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.initialize = function(rect) {
    Window_Base.prototype.initialize.call(this, rect);
    this.opacity = 0;
    this.contentsOpacity = 0;
    this._showCount = 0;
	this._isDisplaying = false;
	this._showBG = true;
	this._bgType = 2;
	this._tone = null;
	this._bitmap = ImageManager._emptyBitmap;
	this._bitmapLoading = false;
    this.contents.clear();
	this.createDimmerSprite();
	this._dimmerSprite.opacity = 0;
};
//-----------------------------------------------------------------------------
// Update for fade in/out
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.update = function() {
	if(this.isDisplaying()) {
		Window_Base.prototype.update.call(this);
		if (this._showCount > 0 && this.canDisplay()) {
			this.updateFadeIn();
			this._showCount--;
		} else {
			this.updateFadeOut();
		}
		if(this.contentsOpacity <= 0 && this._showCount <= 0) {
			this.y = 0;
			this.height = 0;
			this._isDisplaying = false;
		}
	}
};
//-----------------------------------------------------------------------------
// Check if everything is ready for displaying the toast.
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.canDisplay = function() {
	return !this._bitmapLoading;
};
//-----------------------------------------------------------------------------
// Check if this is currently displaying
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.isDisplaying = function() {
	return this._isDisplaying
};
//-----------------------------------------------------------------------------
// Load listener for after bitmap is done loading.
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.onBitmapLoaded = function() {
	this._bitmapLoading = false;
	const sx = 0;
	const sy = 0;
	const sw = this._bitmap.width;
	const sh = this._bitmap.height;
	const dx = 0;
	const dy = 0;
	const dw = this.contents.width;
	const dh = this.contents.height;
	this.contents.blt(this._bitmap, sx, sy, sw, sh, dx, dy, dw, dh);
	this._bitmap = ImageManager._emptyBitmap;
};
//-----------------------------------------------------------------------------
// Fade in
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.updateFadeIn = function() {
	this.opacity += 16 * (this._showBG);
	this._dimmerSprite.opacity += 16 * (this._bgType === 1);
    this.contentsOpacity += 16;
};
//-----------------------------------------------------------------------------
// Fade out
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.updateFadeOut = function() {
	this.opacity -= 16 * (this._showBG);
	this._dimmerSprite.opacity -= 16 * (this._bgType === 1);
    this.contentsOpacity -= 16;
};
//-----------------------------------------------------------------------------
// Open the window
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.open = function(toastObject) {
	this._isDisplaying = true;
    this.refresh(toastObject);
    this._showCount = (toastObject && toastObject.displayTime) ? toastObject.displayTime : CGMZ.ToastManager.DisplayTime;
};
//-----------------------------------------------------------------------------
// Close the window
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.close = function() {
    this._showCount = 0;
};
//-----------------------------------------------------------------------------
// Refresh the window
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.refresh = function(toastObject) {
	if(!toastObject) return;
	this._showBG = true;
	this._bgType = 2;
	this._tone = null;
	this.doCommonEffects(toastObject);
	this.refreshDimmerBitmap();
	this.contents.clear();
	this.resetTextColor();
	//Default text toast
	if(toastObject.isText) {
		const x = 0;
		let y = 0;
		const width = this.contents.width;
		this.changeTextColor(ColorManager.textColor(toastObject.lineOneColor));
		this.drawText(this.convertEscapeCharacters(toastObject.lineOne), x, y, width, toastObject.lineOneAlignment);
		y += this.lineHeight();
		this.resetTextColor();
		this.changeTextColor(ColorManager.textColor(toastObject.lineTwoColor));
		this.drawText(this.convertEscapeCharacters(toastObject.lineTwo), x, y, width, toastObject.lineTwoAlignment);
	}
	//Default image toast
	if(toastObject.isImage) {
		this._bitmapLoading = true;
		this._showBG = toastObject.showBackground;
		this._bitmap = ImageManager.loadPicture(toastObject.picture);
		this._bitmap.addLoadListener(this.onBitmapLoaded.bind(this));
	}
	this.processCustomToast(toastObject);
};
//-----------------------------------------------------------------------------
// Perform common effects for all toast types
// 1. Resize width
// 2. Resize height
// 3. Play se
// 4. Change background style
// 5. Change windowskin Tone
// 6. Change windowskin
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.doCommonEffects = function(toastObject) {
	if(toastObject.hasOwnProperty('width') && !CGMZ.ToastManager.FixedWidth) {
		this.updateWidth(toastObject.width);
	} else {
		this.updateWidth(CGMZ.ToastManager.Width);
	}
	if(toastObject.hasOwnProperty('height') && !CGMZ.ToastManager.FixedHeight) {
		this.updateHeight(toastObject.height);
	} else {
		this.updateHeight(CGMZ.ToastManager.Height);
	}
	this.createContents();
	if(toastObject.hasOwnProperty('SE')) {
		AudioManager.playSe(toastObject.SE);
	}
	if(toastObject.hasOwnProperty('backgroundStyle') && toastObject.backgroundStyle) {
		const types = ['Transparent','Dim','Window'];
		this._bgType = types.indexOf(toastObject.backgroundStyle);
		this._showBG = (this._bgType === 2);
	}
	if(toastObject.hasOwnProperty('windowskinTone') && toastObject.windowskinTone) {
		const tone = JSON.parse(toastObject.windowskinTone);
		this._tone = [Number(tone.Red), Number(tone.Green), Number(tone.Blue)];
	}
	if(toastObject.hasOwnProperty('windowskin')) {
		this.windowskin = ImageManager.loadBitmap(toastObject.windowskin.folder, toastObject.windowskin.filename);
	} else {
		this.windowskin = ImageManager.loadSystem("Window");
	}
};
//-----------------------------------------------------------------------------
// Change window width. Also changes x value to re-center based on custom width
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.updateWidth = function(width) {
	this.width = width;
	this.x = Graphics.boxWidth/2 - width/2;
};
//-----------------------------------------------------------------------------
// Change window height. Also changes y value based on height
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.updateHeight = function(height) {
	const neededHeight = this.fittingHeight(height);
	this.height = neededHeight;
	this.y -= neededHeight * CGMZ.ToastManager.DisplayFromBottom;
};
//-----------------------------------------------------------------------------
// Update the tone of the windowskin. If tone property no exist, use default
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.updateTone = function() {
	if(!this._tone) {
		Window_Base.prototype.updateTone.call(this);
		return;
	}
    this.setTone(this._tone[0], this._tone[1], this._tone[2]);
};
//-----------------------------------------------------------------------------
// Do nothing, update this in opacity update function instead
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.updateBackgroundDimmer = function() {
};
//-----------------------------------------------------------------------------
// Processing for custom toasts. To be used by other plugins for toast behavior
//-----------------------------------------------------------------------------
CGMZ_Window_Toast.prototype.processCustomToast = function(toastObject) {
	// Put toast behavior here
};