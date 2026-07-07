# -*- coding: utf-8 -*-
"""Inject silly-quest NPC events into Map011.json + name switches/variables in System.json."""
import json

MAP_PATH = 'D:/useless-script/discord/Explore/data/Map011.json'
SYS_PATH = 'D:/useless-script/discord/Explore/data/System.json'
PLUGIN = "DiscordExplore"


def text(speaker, lines, indent=0):
    cmds = [{"code": 101, "indent": indent, "parameters": ["", 0, 0, 2, speaker]}]
    for line in lines:
        cmds.append({"code": 401, "indent": indent, "parameters": [line]})
    return cmds


def plugin_complete_quest(quest_id, indent=0):
    return [{
        "code": 357, "indent": indent,
        "parameters": [PLUGIN, "CompleteQuest", "完成任務", {"questId": quest_id}],
    }]


def branch_if_switch(switch_id, inner, indent=0):
    cmds = [{"code": 111, "indent": indent, "parameters": [0, switch_id, 0]}]
    cmds += inner
    cmds.append({"code": 0, "indent": indent + 1, "parameters": []})
    cmds.append({"code": 412, "indent": indent, "parameters": []})
    return cmds


def balloon(balloon_id, target=0, wait=True, indent=0):
    return [{"code": 213, "indent": indent, "parameters": [target, balloon_id, wait]}]


def end(indent=0):
    return [{"code": 0, "indent": indent, "parameters": []}]


def conditions(switch1=None):
    c = {
        "actorId": 1, "actorValid": False, "itemId": 1, "itemValid": False,
        "selfSwitchCh": "A", "selfSwitchValid": False,
        "switch1Id": 1, "switch1Valid": False,
        "switch2Id": 1, "switch2Valid": False,
        "variableId": 1, "variableValid": False, "variableValue": 0,
    }
    if switch1 is not None:
        c["switch1Id"] = switch1
        c["switch1Valid"] = True
    return c


def page(cond, image_name, image_index, commands, direction=2, priority=1, trigger=0):
    return {
        "conditions": cond,
        "directionFix": False,
        "image": {
            "tileId": 0, "characterName": image_name, "direction": direction,
            "pattern": 1, "characterIndex": image_index,
        },
        "list": commands,
        "moveFrequency": 3,
        "moveRoute": {"list": [{"code": 0, "parameters": []}], "repeat": True, "skippable": False, "wait": False},
        "moveSpeed": 3,
        "moveType": 0,
        "priorityType": priority,
        "stepAnime": False,
        "through": False,
        "trigger": trigger,
        "walkAnime": True,
    }


def event(eid, name, x, y, pages):
    return {"id": eid, "name": name, "note": "", "pages": pages, "x": x, "y": y}


# ---- EV019 村長:哲學鼠患 (vill_rat, switch 11) ----
ev19_quest = (
    balloon(1)
    + text("村長", ["勇者啊!救救我!我家有一隻老鼠!"])
    + text("村長", ["牠不偷吃東西也不咬家具,", "牠只是每天半夜用氣音背莎士比亞,", "還會在高潮段落停頓等掌聲!"])
    + text("村長", ["拜託你去跟牠談談,", "圖書館白天有開,請牠去那邊表演!"])
    + plugin_complete_quest("vill_rat")
    + branch_if_switch(11,
        text("", ["你跟老鼠進行了一場莎翁級的深度對談。", "牠表示自己「懷才不遇」,但同意轉戰圖書館。"], indent=1)
        + text("村長", ["太感謝了!這是謝禮!", "\\C[6]獲得 \\V[11] 全域幣、\\V[12] XP!\\C[0]"], indent=1))
    + end()
)
ev19_done = text("村長", ["昨晚終於睡了個好覺……", "不過說真的,我有點想念牠的《哈姆雷特》。"]) + end()

ev19 = event(19, "村長(鼠患)", 16, 17, [
    page(conditions(), "People1", 6, ev19_quest),
    page(conditions(switch1=11), "People1", 6, ev19_done),
])

# ---- EV020 快遞員:極速快遞(步行) (vill_delivery, switch 12) ----
ev20_quest = (
    balloon(1)
    + text("快遞員", ["站住!你看起來腿很快!", "這裡有一封\\C[2]十萬火急的超急件\\C[0]!"])
    + text("快遞員", ["收件人是隔壁攤的老王。", "距離大概……十步。"])
    + text("快遞員", ["但我的合約寫明「本人只負責收件」,", "送件不歸我管。幫我送一下,拜託!"])
    + plugin_complete_quest("vill_delivery")
    + branch_if_switch(12,
        text("", ["你走了十步,把信交給老王。", "老王:「喔,是水電費帳單。」"], indent=1)
        + text("快遞員", ["使命必達!你是物流業之光!", "\\C[6]獲得 \\V[11] 全域幣、\\V[12] XP!\\C[0]"], indent=1))
    + end()
)
ev20_done = text("快遞員", ["多虧了你,本公司的準時率終於突破 1% 了!", "下次有十步快遞再找你!"]) + end()

ev20 = event(20, "快遞員(送信)", 17, 20, [
    page(conditions(), "People1", 0, ev20_quest),
    page(conditions(switch1=12), "People1", 0, ev20_done),
])

# ---- EV021 菜農:高麗菜失蹤事件 (vill_cabbage, switch 13) ----
ev21_quest = (
    balloon(6)
    + text("菜農", ["我的高麗菜!又少一顆!", "這已經是本月第三十七顆了!!"])
    + text("菜農", ["兇手非常狡猾……", "每天都挑晚餐時間作案,", "現場只留下一股炒菜的香味。"])
    + text("菜農", ["……等等,我今天晚餐吃了什麼?", "算、算了先別管這個!幫我調查!"])
    + plugin_complete_quest("vill_cabbage")
    + branch_if_switch(13,
        text("", ["你默默指向她家廚房裡", "堆成小山的三十七個空碗。"], indent=1)
        + balloon(7, indent=1)
        + text("菜農", ["原來兇手是我自己?!", "……好吧,破案獎金還是要給你。", "\\C[6]獲得 \\V[11] 全域幣、\\V[12] XP!\\C[0]"], indent=1))
    + end()
)
ev21_done = text("菜農", ["自從案件偵破後,", "高麗菜就再也沒有失蹤過了。真是奇怪呢~"]) + end()

ev21 = event(21, "菜農(高麗菜)", 6, 20, [
    page(conditions(), "People1", 1, ev21_quest),
    page(conditions(switch1=13), "People1", 1, ev21_done),
])

# ---- EV022 迷因大魔王 (vill_boss, ready switch 14, defeat switch 15) ----
ev22_fight = (
    balloon(1)
    + text("???", ["窩草,是誰吵醒本座!!"])
    + text("迷因大魔王", ["你就是那個到處解決蠢事的傢伙?", "太天真了!本座就是這座村莊", "一切蠢事的幕後黑手!"])
    + text("迷因大魔王", ["接招!究極迷因攻擊——", "\\C[2]「你的存檔沒有保存」\\C[0]!!"])
    + text("", ["你想起你的存檔在雲端。", "攻擊無效。"])
    + text("迷因大魔王", ["可惡……那就試試這招!", "\\C[2]「你媽叫你吃飯」\\C[0]!!"])
    + text("", ["你早就吃飽了。", "攻擊再度無效。"])
    + balloon(6)
    + text("迷因大魔王", ["不可能!!本座的迷因對你完全沒用?!", "……好吧,本座認輸。回去睡覺了,晚安。"])
    + plugin_complete_quest("vill_boss")
    + branch_if_switch(15,
        text("", ["迷因大魔王被打回去睡覺了!", "村莊恢復了和平(大概)。", "\\C[6]獲得 \\V[11] 全域幣、\\V[12] XP!\\C[0]"], indent=1))
    + end()
)

ev22 = event(22, "迷因大魔王", 12, 21, [
    # Page 0:未達成前置 — 隱形無互動
    page(conditions(), "", 0, end(), priority=0),
    # Page 1:三個小任務完成(switch 14)— Boss 現身
    page(conditions(switch1=14), "Meme", 0, ev22_fight),
    # Page 2:已討伐(switch 15)— 消失
    page(conditions(switch1=15), "", 0, end(), priority=0),
])

# ---- Apply to Map011.json ----
with open(MAP_PATH, encoding='utf-8') as f:
    m = json.load(f)

assert len(m['events']) == 19, f"unexpected events length {len(m['events'])}"
m['events'] += [ev19, ev20, ev21, ev22]

with open(MAP_PATH, 'w', encoding='utf-8') as f:
    json.dump(m, f, ensure_ascii=False, separators=(',', ':'))
print('Map011.json updated: events 19-22 added')

# ---- System.json: name switches 11-15, variables 11-12 ----
with open(SYS_PATH, encoding='utf-8') as f:
    s = json.load(f)

sw = s['switches']
while len(sw) < 16:
    sw.append("")
sw[11] = "Q:鼠患"
sw[12] = "Q:快遞"
sw[13] = "Q:高麗菜"
sw[14] = "Q:Boss出現"
sw[15] = "Q:Boss討伐"

va = s['variables']
while len(va) < 13:
    va.append("")
va[11] = "任務獎勵:全域幣"
va[12] = "任務獎勵:XP"

with open(SYS_PATH, 'w', encoding='utf-8') as f:
    json.dump(s, f, ensure_ascii=False, separators=(',', ':'))
print('System.json updated: switches 11-15 + variables 11-12 named')
