//-----------------------------------------------------------------------------
// OcRam plugins - OcRam_Map_Editor.js
//=============================================================================

"use strict";

/*:
 * @target MZ
 * @plugindesc v1.01 This plugin provides autotiling in-game for your RPG Maker projects!
 * Or paint B-E tiles or any shape of any autotile! Edit and save maps in-game!
 * @author OcRam
 * @url https://ocram-codes.net
 * @
 * 
 * ----------------------------------------------------------------------------
 * PLUGIN COMMANDS
 * ============================================================================
 * -
 * 
 * ----------------------------------------------------------------------------
 * PLUGIN PARAMETERS
 * ============================================================================
 * @param Auto save/load
 * @type boolean
 * @desc Automatically save and load map data (if edited).
 * @default true
 *
 * @param Debug mode
 * @type boolean
 * @desc Write some events to console log (F8 or F12).
 * @default false
 *
 * @help
 * ----------------------------------------------------------------------------
 * Introduction                                  (Made for RPG Maker MZ and MV)
 * ============================================================================
 * This plugin provides autotiling in-game for your RPG Maker projects!
 * Enable autosave/load for edited map data with 1 plugin parameter!
 * 
 * OR just do it with custom logics and disable autosave/load.
 * Save map data with $gameMap.saveData() and load it with $gameMap.loadData()
 * 
 * This plugin offers an "API" for you to edit maps in-game.
 * All edits to the maps are made with JS calls. All data is saved per save
 * file thus allowing different map data for each save file for the same map!
 * 
 * This is very good to shape maps to reflect current game events such as:
 *  - Exploded bridges, buildings (after some event in-game)
 *    and if those exploded stuffs needs to be repaired - NO PROBLEM!
 *  - Water flow blocked by an obstacle and when it's removed water flows
 *    freely in areas it didn't flow earlier (or vice versa)
 *  - After forest has been cleared from monsters road can be built through it
 *  - Or maybe add some new building to the village at some point of game?
 *  - Edit heroes room after player gets trophies and rewards?
 *  - Only imagination is the limit for the all possibilities here!
 *  
 *    NO MORE SEVERAL MAPS for the maps which needs some edits to it!
 * 
 * NOTE: Currently only active map can be edited! If you need to edit other
 *       than active map, create switch or variable for it and autorun changes
 *       after player enters that map for the 1st time.
 * 
 * Tile ID's are following (for $gameMap.setNormalTile):
 *   B = 0 to 255
 *   C = 256 to 511
 *   D = 512 to 767
 *   E = 768 to 1023
 *   *?* 1024 - 1535 are reserved for nothing *?*
 *   A5 = 1536 to 1663
 *   A1 (Animations) = 2048 to 2815
 *   A2 (Ground) = 2816 to 4351
 *   A3 (Buildings) = 4352 to 5887
 *   A4 (Walls) = 5887 to 8191
 *
 * Autotiles            Tile index (for $gameMap.setAutoTile)
 *   A1 (Animations)    0 to 15
 *                      5, 7, 9, 11, 13 and 15 'Water fall'
 *   A2 (Ground)        16 to 47
 *   A3 (Buildings)     48 to 79 'Walls 4-dir'
 *   A4 (Walls)         80 to 127
 *                      80 to 87 'Roofs 8-dir'
 *                      88 to 95 'Walls 4-dir'
 *                      96 to 103 'Roofs 8-dir'
 *                      104 to 111 'Walls 4-dir'
 *                      112 to 119 'Roofs 8-dir'
 *                      120 to 127 'Walls 4-dir'
 *
 * Special thanks to GreenTree-Studios for the thread that inspired me!
 * https://forums.rpgmakerweb.com/index.php?threads/autotiles.151637/
 * I just couldn't resist the urge to make plugin for in-game autotiling!
 *
 * ----------------------------------------------------------------------------
 * JS calls
 * ============================================================================
 * $gameMap.setNormalTile(x, y, z, tile_id) // Just paints given tile id
 * // setNormalTile gives you full control to choose ANY tile
 * // This function will not check any surrounding tiles!
 * 
 * $gameMap.setAutoTile(x, y, z, tile_idx, d4) // Checks also tiles around
 * // d4 (true = no diagonal check, false/omitted = normal autotiling)
 * // setAutoTile function is used for tileset 'A' tiles only!
 * 
 * $gameMap.saveData() // Save current map data
 * $gameMap.loadData() // Load map data for current map - if saved earlier
 * 
 * ----------------------------------------------------------------------------
 * Terms of Use
 * ============================================================================
 * Edits are allowed as long as "Terms of Use" is not changed in any way.
 * Exception: Obfuscating and/or minifying JS, where ALL comments are removed
 * (incluging these "Terms of Use"), is allowed (won't change ToU itself).
 *
 * COMMERCIAL & NON-COMMERCIAL USE: Free to use with credits to 'OcRam'
 *
 * OcRam -plugins available at https://ocram-codes.net/plugins.aspx?engine=mz
 *
 * DO NOT COPY, RESELL OR CLAIM ANY PIECE OF THIS PLUGIN AS YOUR OWN!
 * Copyright (c) 2022, Marko Paakkunainen // mmp_81 (at) hotmail.com
 *
 * ============================================================================
 * For those who are intrested in autotile "shaping" more info below:
 * ----------------------------------------------------------------------------
 * 'Numpad Directions' for the autotile shape tables
 * ----------------------------------------------------------------------------
 * 7    8    9       // Left/Up      Up      Right/Up
 * 4    -    6       // Left         -       Right
 * 1    2    3       // Left/Down    Down    Right/Down
 *
 * ----------------------------------------------------------------------------
 * Tile shapes for 'ground' and 'roof' tiles (8-dir)
 * ----------------------------------------------------------------------------
 * Shape | 8-dir           | Shape | 8-dir           | Shape | 8-dir
 * index | (NOT connected) | index | (NOT connected) | index | (NOT connected)
 * ----------------------------------------------------------------------------
 * 0     | -               | 1     | 7               | 2     | 9
 * 3     | 4 6             | 4     | 3               | 5     | 3 7
 * 6     | 3 9             | 7     | 7 9 3           | 8     | 1
 * 9     | 1 7             | 10    | 1 9             | 11    | 1 9 7
 * 12    | 1 3             | 13    | 1 3 7           | 14    | 3 1 9
 * 15    | 1 3 7 9         | 16    | 1 4 7           | 17    | 1 4 7 9
 * 18    | 1 3 4 7         | 19    | 1 3 4 9 7       | 20    | 7 8 9
 * 21    | 7 8 9 3         | 22    | 7 8 9 1         | 23    | 7 8 9 1 3
 * 24    | 9 6 3           | 25    | 9 6 1 3         | 26    | 7 9 6 3
 * 27    | 7 9 6 1 3       | 28    | 1 2 3           | 29    | 7 1 2 3
 * 30    | 9 1 2 3         | 31    | 7 9 1 2 3       | 32    | 7 9 4 6 1 3
 * 33    | 7 8 9 1 2 3     | 34    | 7 8 9 4 1       | 35    | 7 8 9 4 1 3
 * 36    | 7 8 9 6 3       | 37    | 1 4 7 9 6 3     | 38    | 1 2 3 6 9
 * 39    | 7 9 6 3 2 1     | 40    | 7 4 1 2 3       | 41    | 3 2 1 4 7 9
 * 42    | 1 4 7 8 9 6 3   | 43    | 3 2 1 4 7 8 9   | 44    | 7 9 4 6 1 2 3
 * 45    | 7 8 9 6 3 2 1   | 46    | 1 4 7 8 9 6 3 2 | -     | -
 *
 * ----------------------------------------------------------------------------
 * Tile shapes for 'building' and 'wall' tiles (4-dir)
 * ----------------------------------------------------------------------------
 * Shape | 4-dir           | Shape | 4-dir           | Shape | 4-dir
 * index | (connected)     | index | (connected)     | index | (connected)
 * ----------------------------------------------------------------------------
 * 0     | 4 8 6 2         | 1     | 2 6 8           | 2     | 4 2 6
 * 3     | 2 6             | 4     | 2 4 8           | 5     | 2 8
 * 6     | 2 4             | 7     | 2               | 8     | 4 8 6
 * 9     | 8 6             | 10    | 4 6             | 11    | 6
 * 12    | 4 8             | 13    | 8               | 14    | 4
 * 15    | -               | -     | -               | -     | -
 *
 * ----------------------------------------------------------------------------
 * Tile shapes for 'waterfall' tiles (2-dir) (! = NOT this dir)
 * ----------------------------------------------------------------------------
 * Shape | 4-dir                    | Shape | 4-dir
 * index | (connected)              | index | (connected)
 * ----------------------------------------------------------------------------
 * 0     | 4 8 6 2                  | 1     | !4
 * 2     | !6                       | 3     | !6 && !4
 * 
 * For advanced JS: Bitflag autoshape tables documented in JS code.
 * 
 * ----------------------------------------------------------------------------
 * Version History
 * ============================================================================
 * 2022/10/02 v1.00 - Initial release
 * 2022/10/05 v1.01 - Normal '8-dir' autotiling now connects to map edges
 *                    Water autotiles now connects to waterfall tiles
 *                    Improved plugin documentation
 *                    NOTE: Z parameter now corresponds the layer in editor
 *                    meaning z-indexes starts from 1 (and 0 defaults to 1)
 *
 * ----------------------------------------------------------------------------
 * Overrides (destructive declarations) are listed here
 * ============================================================================
 * - No overrides -
 */

(function (parameters) {

    // ------------------------------------------------------------------------------
    // Plugin variables and parameters
    // ==============================================================================
    const getBoolean = obj => {
        if (!obj) return false; obj = obj.toString().toLowerCase();
        return (obj == "true" && obj != "0") ? true : false;
    };

    const _debug = getBoolean(parameters['Debug mode']);
    const _autoSaveLoad = getBoolean(parameters['Auto save/load']);

    /* ----------------------------------------------------------------------------
     * Direction bitflags
     * ----------------------------------------------------------------------------
     * 1    2   4       // Left/Up      Up      Right/Up
     * 8    -   16      // Left         -       Right
     * 32   64  128     // Left/Down    Down    Right/Down
     *
     * ----------------------------------------------------------------------------
     * Tile shapes for 'ground' and 'roof' tiles (8-dir)
     * ----------------------------------------------------------------------------
     * Shape | 8-dir bitflags  | Shape | 8-dir bitflags  | Shape | 8-dir bitflags
     * index | (NOT connected) | index | (NOT connected) | index | (NOT connected)
     * ----------------------------------------------------------------------------
     * 0     | 0               | 1     | 1               | 2     | 4
     * 3     | 5               | 4     | 128             | 5     | 129
     * 6     | 132             | 7     | 133             | 8     | 32
     * 9     | 33              | 10    | 36              | 11    | 37
     * 12    | 160             | 13    | 161             | 14    | 164
     * 15    | 165             | 16    | 41              | 17    | 45
     * 18    | 169             | 19    | 173             | 20    | 7
     * 21    | 135             | 22    | 39              | 23    | 167
     * 24    | 148             | 25    | 180             | 26    | 149
     * 27    | 181             | 28    | 224             | 29    | 225
     * 30    | 228             | 31    | 229             | 32    | 189
     * 33    | 231             | 34    | 47              | 35    | 175
     * 36    | 151             | 37    | 183             | 38    | 244
     * 39    | 245             | 40    | 233             | 41    | 237
     * 42    | 191             | 43    | 239             | 44    | 253
     * 45    | 247             | 46    | 255
     *
     * ----------------------------------------------------------------------------
     * Tile shapes for 'building' and 'wall' tiles (4-dir)
     * ----------------------------------------------------------------------------
     * Shape | 4-dir bitflags  | Shape | 4-dir bitflags  | Shape | 4-dir bitflags
     * index | (connected)     | index | (connected)     | index | (connected)
     * ----------------------------------------------------------------------------
     * 0     | 90              | 1     | 82              | 2     | 88
     * 3     | 80              | 4     | 74              | 5     | 66
     * 6     | 72              | 7     | 64              | 8     | 26
     * 9     | 18              | 10    | 24              | 11    | 16
     * 12    | 10              | 13    | 2               | 14    | 8
     * 15    | 0
     *
     * ----------------------------------------------------------------------------
     * Tile shapes for 'waterfall' tiles (2-dir)
     * ----------------------------------------------------------------------------
     * Shape | 4-dir bitflags           | Shape | 4-dir bitflags
     * index | (connected)              | index | (connected)
     * ----------------------------------------------------------------------------
     * 0     | 90                       | 1     | 16, 18, 80, 82
     * 2     | 8, 10, 72, 74            | 3     | 0, 2, 64, 66
     */

    // All bitflags with corresponding 'shape' indexes !!!
    const _shapeTableGroundRoof = { // '8-dir' shapes
        0: 0, 1: 1, 4: 2, 5: 3, 7: 20, 32: 8, 33: 9, 36: 10, 37: 11, 39: 22, 41: 16,
        45: 17, 47: 34, 128: 4, 129: 5, 132: 6, 133: 7, 135: 21, 148: 24, 149: 26,
        151: 36, 160: 12, 161: 13, 164: 14, 165: 15, 167: 23, 169: 18, 173: 19, 175: 35,
        180: 25, 181: 27, 183: 37, 189: 32, 191: 42, 224: 28, 225: 29, 228: 30, 229: 31,
        231: 33, 233: 40, 237: 41, 239: 43, 244: 38, 245: 39, 247: 45, 253: 44, 255: 46
    }; const _shapeTableBuildingWall = { // '4-dir' shapes
        0: 15, 2: 13, 8: 14, 10: 12, 16: 11, 18: 9, 24: 10, 26: 8,
        64: 7, 66: 5, 72: 6, 74: 4, 80: 3, 82: 1, 88: 2, 90: 0
    }; const _shapeTableWaterfall = { // '2-dir' shapes
        0: 3, 2: 3, 64: 3, 66: 3, 16: 1, 80: 1, 18: 1,
        82: 1, 8: 2, 10: 2, 72: 2, 74: 2, 90: 0
    }; let _mapEdited = false; // Map edited flag

    // ------------------------------------------------------------------------------
    // Private Utility functions - Inherited to all sub scopes here
    // ==============================================================================
    const getBitflags = int => { // This was just made to check bitflags
        const ret = []; let p = 0; // and convert 'em to "numpad" dirs...
        for (let i = 0; i < 64; i++) {
            p = Math.pow(2, i); if (int & p) ret.push(p);
        } return ret;
    };

    const add4DirBitFlags = surroundings => { // Using bit flags to check connected sides
        let bf = 0; if (surroundings[1]) bf += 2; if (surroundings[3]) bf += 8;
        if (surroundings[5]) bf += 16; if (surroundings[7]) bf += 64; return bf;
    };

    const makeShape = surroundings => { // '8-dir autotiles' / Roofs / Ground
        let bf = 0; if (!surroundings[1]) bf += 2; if (!surroundings[3]) bf += 8;
        if (!surroundings[5]) bf += 16; if (!surroundings[7]) bf += 64;
        if (!surroundings[0]) bf += 1; if (!surroundings[2]) bf += 4;
        if (!surroundings[6]) bf += 32; if (!surroundings[8]) bf += 128;
        return _shapeTableGroundRoof[bf] || 0;
    };

    const makeBShape = surroundings => { // '4-dir autotiles' / Walls / Buildings
        let bf = add4DirBitFlags(surroundings);
        if (bf & 8) {
            if (!surroundings[0] != !surroundings[1]) { bf -= 8; }
            else if (!surroundings[6] != !surroundings[7]) { bf -= 8; }
            else if (!surroundings[3] != !surroundings[4]) { bf -= 8; }
        } if (bf & 16) {
            if (!surroundings[2] != !surroundings[1]) bf -= 16;
            else if (!surroundings[8] != !surroundings[7]) bf -= 16;
            else if (!surroundings[5] != !surroundings[4]) bf -= 16;
        } return _shapeTableBuildingWall[bf] || 0;
    };

    const makeWFShape = surroundings => { // '2-dir autotiles' / Waterfalls
        let bf = add4DirBitFlags(surroundings);
        return _shapeTableWaterfall[bf] || 0;
    };

    const isBuilding = tile_idx => {
        return (tile_idx > 47 && tile_idx < 80) ||
            (tile_idx > 87 && tile_idx < 96) || 
            (tile_idx > 103 && tile_idx < 112) ||
            (tile_idx > 119 && tile_idx < 128) ||
            ((tile_idx > 4 && tile_idx < 16) && !!(tile_idx % 2));
    };

    const getAutotileKind = tile_id => ((tile_id - 2048) / 48) | 0;

    // ------------------------------------------------------------------------------
    // New methods
    // ==============================================================================
    Game_Map.prototype.setNormalTile = function (x, y, pz, tile_id) {
        x = x | 0; y = y | 0; pz = pz | 0; tile_id = tile_id | 0; // Force to 'int'
        const z = pz < 1 ? 0 : pz - 1;
        $dataMap.data[[(z * $dataMap.height + y) * $dataMap.width + x]] = tile_id;
        this.refresh(); _mapEdited = true;
        if (!SceneManager._scene._spriteset || !SceneManager._scene._spriteset._tilemap) return;
        SceneManager._scene._spriteset._tilemap.refresh();
    };

    Tilemap.isAnyWaterTile = function (tileId) {
        return this.isWaterTile(tileId) || this.isWaterfallTile(tileId);
    };

    Game_Map.prototype.setAutoTile = function (x, y, pz, tile_idx, dir4_tiling, recursive) {

        x = x | 0; y = y | 0; pz = pz | 0; tile_idx = tile_idx | 0; // Force to 'int'
        if (tile_idx > 255) { console.warn("setAutoTile: Tile index can't exceed 255!"); return; }
        if (tile_idx < 0) { console.warn("setAutoTile: Tile index can't be negative!"); return; }
        if (tile_idx > 127) { this.setNormalTile(x, y, pz, 1536 + (tile_idx - 128)); return; }

        const building = isBuilding(tile_idx); const z = pz < 1 ? 0 : pz - 1;
        const tile_id = 2048 + (tile_idx * 48); const kind = getAutotileKind(tile_id);
        const w = this.width(); const h = this.height();

        const checkSurroundings = (x, y, z, recursive) => {

            // Check if surrounding needs to be changed... If so make recursive calls
            const surroundings = [0, 0, 0, 0, tile_id, 0, 0, 0, 0];
            const edges = [false, false, false, false, false, false, false, false, false];
            const checkIdx = i => {
                if (Tilemap.isAnyWaterTile(tile_id) && Tilemap.isAnyWaterTile(surroundings[i])) return;
                if (surroundings[i] && kind != getAutotileKind(surroundings[i])) surroundings[i] = 0;
            };

            if (y > 0) { // Check top row
                if (x > 0) surroundings[0] = $dataMap.data[[(z * h + (y - 1)) * w + (x - 1)]];
                surroundings[1] = $dataMap.data[[(z * h + (y - 1)) * w + x]];
                if (x < w) surroundings[2] = $dataMap.data[[(z * h + (y - 1)) * w + (x + 1)]];
            } else if (!dir4_tiling) { // 'Normal' autotiling connects map edges
                surroundings[0] = tile_id; surroundings[1] = tile_id; surroundings[2] = tile_id;
                edges[0] = true; edges[1] = true; edges[2] = true;
            } // Check middle row
            if (x > 0) surroundings[3] = $dataMap.data[[(z * h + y) * w + (x - 1)]];
            else if (!dir4_tiling) { surroundings[3] = tile_id; edges[3] = true; } // 'Normal' autotiling connects map edges
            if (x < w) surroundings[5] = $dataMap.data[[(z * h + y) * w + (x + 1)]];
            else if (!dir4_tiling) { surroundings[5] = tile_id; edges[5] = true; } // 'Normal' autotiling connects map edges
            if (y < h) { // Check bottom row
                if (x > 0) surroundings[6] = $dataMap.data[[(z * h + (y + 1)) * w + (x - 1)]];
                surroundings[7] = $dataMap.data[[(z * h + (y + 1)) * w + x]];
                if (x < w) surroundings[8] = $dataMap.data[[(z * h + (y + 1)) * w + (x + 1)]];
            } else if (!dir4_tiling) { // 'Normal' autotiling connects map edges
                surroundings[6] = tile_id; surroundings[7] = tile_id; surroundings[8] = tile_id;
                edges[6] = true; edges[7] = true; edges[8] = true;
            }

            // We are only intrested in 'same kind of tiles'
            checkIdx(0); checkIdx(1); checkIdx(2); checkIdx(3);
            checkIdx(5); checkIdx(6); checkIdx(7); checkIdx(8);

            if (dir4_tiling) { // No diagonal connections checked :)
                surroundings[0] = 0; surroundings[2] = 0; surroundings[6] = 0; surroundings[8] = 0;
            } else { // "Normal" autotiling
                if (surroundings[0] && (!surroundings[1] || !surroundings[3])) surroundings[0] = 0; // 7
                if (surroundings[2] && (!surroundings[1] || !surroundings[5])) surroundings[2] = 0; // 9
                if (surroundings[6] && (!surroundings[7] || !surroundings[3])) surroundings[6] = 0; // 1
                if (surroundings[8] && (!surroundings[7] || !surroundings[5])) surroundings[8] = 0; // 3
            } const shape = building ? (tile_idx < 16 ? makeWFShape(surroundings) :
                makeBShape(surroundings)) : makeShape(surroundings); // Get 'shape'

            // Make 'short hand' autotile id from 'kind root tile id' and 'shape'
            //if (_debug) console.log(tile_id, shape, "x:" + x + "|y:" + y, surroundings);
            $dataMap.data[[(z * $dataMap.height + y) * $dataMap.width + x]] = tile_id + shape;

            if (edges[0]) surroundings[0] = 0; if (edges[1]) surroundings[1] = 0;
            if (edges[2]) surroundings[2] = 0; if (edges[3]) surroundings[3] = 0;
            if (edges[5]) surroundings[5] = 0; if (edges[6]) surroundings[6] = 0;
            if (edges[7]) surroundings[7] = 0; if (edges[8]) surroundings[8] = 0;

            if (Tilemap.isWaterfallTile(tile_id)) {
                if (Tilemap.isWaterTile(surroundings[0])) surroundings[0] = 0;
                if (Tilemap.isWaterTile(surroundings[1])) {
                    $gameMap.setAutoTile(x, y - 1, pz, getAutotileKind(surroundings[1]), dir4_tiling, true); surroundings[1] = 0;
                } if (Tilemap.isWaterTile(surroundings[2])) surroundings[2] = 0;
                if (Tilemap.isWaterTile(surroundings[3])) surroundings[3] = 0;
                if (Tilemap.isWaterTile(surroundings[5])) surroundings[5] = 0;
                if (Tilemap.isWaterTile(surroundings[6])) surroundings[6] = 0;
                if (Tilemap.isWaterTile(surroundings[7])) {
                    $gameMap.setAutoTile(x, y + 1, pz, getAutotileKind(surroundings[7]), dir4_tiling, true); surroundings[7] = 0;
                } if (Tilemap.isWaterTile(surroundings[8])) surroundings[8] = 0;
            } else if (Tilemap.isWaterTile(tile_id)) {
                if (Tilemap.isWaterfallTile(surroundings[0])) surroundings[0] = 0;
                if (Tilemap.isWaterfallTile(surroundings[1])) surroundings[1] = 0;
                if (Tilemap.isWaterfallTile(surroundings[2])) surroundings[2] = 0;
                if (Tilemap.isWaterfallTile(surroundings[3])) surroundings[3] = 0;
                if (Tilemap.isWaterfallTile(surroundings[5])) surroundings[4] = 0;
                if (Tilemap.isWaterfallTile(surroundings[6])) surroundings[5] = 0;
                if (Tilemap.isWaterfallTile(surroundings[7])) surroundings[6] = 0;
                if (Tilemap.isWaterfallTile(surroundings[8])) surroundings[7] = 0;
            }

            if (recursive) return; // If not 'surrounings' check >> check 'em
            if (surroundings[0]) checkSurroundings(x - 1, y - 1, z, true);
            if (surroundings[1]) checkSurroundings(x, y - 1, z, true);
            if (surroundings[2]) checkSurroundings(x + 1, y - 1, z, true);
            if (surroundings[3]) checkSurroundings(x - 1, y, z, true);
            if (surroundings[5]) checkSurroundings(x + 1, y, z, true);
            if (surroundings[6]) checkSurroundings(x - 1, y + 1, z, true);
            if (surroundings[7]) checkSurroundings(x, y + 1, z, true);
            if (surroundings[8]) checkSurroundings(x + 1, y + 1, z, true);

        }; checkSurroundings(x, y, z, recursive);

        this.refresh(); _mapEdited = true;
        if (!SceneManager._scene._spriteset || !SceneManager._scene._spriteset._tilemap) return;
        SceneManager._scene._spriteset._tilemap.refresh();

    };

    Game_Map.prototype.saveData = function () { // Save map data
        if (!$dataMap || !$gameMap || !$gameSystem) return; _mapEdited = false;
        $gameSystem["data_map" + $gameMap._mapId] = JSON.stringify($dataMap.data);
    };

    Game_Map.prototype.loadData = function () { // Load map data
        _mapEdited = false; if (!$dataMap || !$gameMap || !$gameSystem) return;
        if ($gameSystem["data_map" + $gameMap._mapId]) {
            const tmp = JSON.parse($gameSystem["data_map" + $gameMap._mapId]);
            for (let i = 0; i < tmp.length; i++) { // Only set data if it's changed!
                if (tmp[i] != $dataMap.data[[i]]) $dataMap.data[[i]] = tmp[i];
            } this.refresh();
        }
    };

    // ------------------------------------------------------------------------------
    // Aliases
    // ==============================================================================
    if (_debug) { // This is for debugging purposes only!
        const _Game_Player_refreshBushDepth = Game_Player.prototype.refreshBushDepth;
        Game_Player.prototype.refreshBushDepth = function () {
            _Game_Player_refreshBushDepth.apply(this, arguments);
            $gameMap.setAutoTile(this._x, this._y, 0, 17); // 'Outside' road
        };
    }

    if (_autoSaveLoad) {
        const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
        Scene_Map.prototype.onMapLoaded = function () {
            _Scene_Map_onMapLoaded.apply(this, arguments); $gameMap.loadData();
        }; const _Scene_Map_terminate = Scene_Map.prototype.terminate;
        Scene_Map.prototype.terminate = function () {
            if (_mapEdited) $gameMap.saveData(); _Scene_Map_terminate.apply(this, arguments);
        };
    }

})(PluginManager.parameters("OcRam_Map_Editor"));