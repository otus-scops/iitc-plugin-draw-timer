// ==UserScript==
// @id             iitc-plugin-draw-timer@otusscops
// @name           IITC Plugin: Draw Timer
// @author         otusscops
// @category       Layer
// @version        0.1.0.202506041700
// @namespace      iitc-plugin-draw-timer
// @description    Automatically update draw data at specified times
// @downloadURL    https://github.com/otus-scops/iitc-plugin-draw-timer/raw/refs/heads/main/iitc-plugin-draw-timer.user.js
// @updateURL      https://github.com/otus-scops/iitc-plugin-draw-timer/raw/refs/heads/main/iitc-plugin-draw-timer.user.js
// @include        https://*.ingress.com/*
// @include        http://*.ingress.com/*
// @match          https://*.ingress.com/*
// @match          http://*.ingress.com/*
// @grant          none
// ==/UserScript==

/**
* Copyright 2025 otusscops
*
* Licensed under the Apache License, Version 2.0 (the “License”);
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an “AS IS” BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*
* See the License for the specific language governing permissions and
* limitations under the License.
*/


var wrapper = function(plugin_info) {
    if(typeof window.plugin !== 'function') window.plugin = function() {};

    plugin_info.buildName = 'iitc-ja-otusscops'; // Name of the IITC build for first-party plugins
    plugin_info.dateTimeVersion = '202506041700'; // Datetime-derived version of the plugin
    plugin_info.pluginId = 'Draw-Timer'; // ID/name of the plugin
    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== "function") window.plugin = function () { };
    // ensure plugin framework is there, even if kiwi plugin is not yet loaded
    if (typeof window.plugin.drawTimer!== "function")
        window.plugin.drawTimer = function () { };
    // use own namespace for plugin
    window.plugin.drawTimer = function () {};

    let self = window.plugin.drawTimer;


    /* プラグイン内でグローバルに用いる定数や変数の定義 */
    const STORAGE_KEY = 'draw-timer-option'; // 設定値の保存先キー
    // const myGlobalConst = 'const';
    // let myGlobalVariable = null;
    let currentColor = '#a24ac3';
    let currentMarker = null; // 現在のマーカーアイコン


    // カスタムレイヤー
    self.drawTimerLayerGroup = null;

    // 設定値の保持用
    let OptionData = {};
    let drawUpdateTimer = [];

    // エンドポイントから起動される初期処理用
    // セットアップ以外の処理で、設定変更時等に再度コールされる想定
    self.init = function(){
        self.clearDraw();
        for (let i = 0; i < drawUpdateTimer.length; i++) {
            clearTimeout(drawUpdateTimer[i]);
        }
        drawUpdateTimer = [];
        let lastDraw = "";
        for(let i=0; i<OptionData.entries.length; i++){
            let entry = OptionData.entries[i];
            if(entry.update){
                // 時間のパース
                let timeParts = entry.update.split(':');
                if(timeParts.length === 2){
                    let timming = new Date();
                    timming.setHours(parseInt(timeParts[0], 10));
                    timming.setMinutes(parseInt(timeParts[1], 10));
                    timming.setSeconds(0);

                    // 現在の日時と比較して、未来の時間であるか確認
                    let sec = Math.floor((timming.getTime() - Date.now()));
                    if(sec>0) {
                        // タイマーセット
                        let timerId = setTimeout(function() {
                            window.plugin.drawTimer.updateDraw(entry.draw);
                        }, sec);

                        drawUpdateTimer.push(timerId);
                    }else{
                        lastDraw = entry.draw;
                    }
                }
            }
        }
        if(lastDraw !== "") {
            // 最後のドローを更新
            window.plugin.drawTimer.updateDraw(lastDraw);
        }
    };

    self.setOptions = function () {
        self.lineOptions = {
            stroke: true,
            color: currentColor,
            weight: 4,
            opacity: 0.5,
            fill: false,
            interactive: true,
        };

        self.polygonOptions = L.extend({}, self.lineOptions, {
            fill: false,
            fillColor: null, // to use the same as 'color' for fill
            fillOpacity: 0.2,
            dashArray: '',
        });

        self.editOptions = L.extend({}, self.polygonOptions, {
            dashArray: '10,10',
        });
        delete self.editOptions.color;

        self.markerOptions = {
            icon: currentMarker,
            zIndexOffset: 2000,
        };
    };

    self.getMarkerIcon = function (color) {
        if (!color) {
            console.warn('Color is not set (default #a24ac3 will be used)');
        }
        // todo: refactor to get rid of getMarkerIcon
        return L.divIcon.coloredSvg(color);
    };

    self.updateDraw = function(drawData){
        self.clearDraw();
        if(!drawData || drawData === "") {
            //console.warn('No draw data provided.');
            return;
        }
        drawData = JSON.parse(drawData);
        if(self.useDrawTool()) {
            window.plugin.drawTools.clearAndDraw();
            window.plugin.drawTools.import(drawData);
        }else{
            for(let i=0; i<drawData.length; i++){
                let item = drawData[i];
                var layer = null;
                var extraOpt = {};
                if (item.color) extraOpt.color = item.color;

                switch (item.type) {
                case 'polyline':
                    layer = L.geodesicPolyline(item.latLngs, L.extend({}, self.lineOptions, extraOpt));
                    break;
                case 'polygon':
                    layer = L.geodesicPolygon(item.latLngs, L.extend({}, self.polygonOptions, extraOpt));
                    break;
                case 'circle':
                    layer = L.geodesicCircle(item.latLng, item.radius, L.extend({}, self.polygonOptions, extraOpt));
                    break;
                case 'marker':
                    var extraMarkerOpt = {};
                    if (item.color) extraMarkerOpt.icon = self.getMarkerIcon(item.color);
                    layer = L.marker(item.latLng, L.extend({}, self.markerOptions, extraMarkerOpt));
                    break;
                default:
                    console.warn('unknown layer type "' + item.type + '" when loading draw tools layer');
                    break;
                }
                if (layer) {
                    self.drawTimerLayerGroup.addLayer(layer);
                }
            }
        }
    }

    self.clearDraw = function(){
        self.drawTimerLayerGroup.clearLayers();
        if(self.useDrawTool()) {
            window.plugin.drawTools.drawnItems.clearLayers();
        }
    }

    self.getMarkerIcon = function (color) {
        if (!color) {
            console.warn('Color is not set (default #a24ac3 will be used)');
        }
        // todo: refactor to get rid of getMarkerIcon
        return L.divIcon.coloredSvg(color);
    };

    // 設定の読み込み
    self.loadOption = function(){
        let stream = localStorage.getItem(STORAGE_KEY);
        let _data = (stream === null) ? {} : JSON.parse(stream);
        OptionData = _data;
        if(!OptionData.entries){ OptionData.entries = []; }
        OptionData.entries.sort((a, b) => {
            const [hoursA, minutesA] = a.update.split(':').map(Number);
            const [hoursB, minutesB] = b.update.split(':').map(Number);

            if (hoursA !== hoursB) {
                return hoursA - hoursB;
            }
            return minutesA - minutesB;
        });
    };

    // 設定の保存
    self.saveOption = function(){
        let stream = JSON.stringify(OptionData);
        localStorage.setItem(STORAGE_KEY,stream);
    };

    self.settingDialog = function() {
        let html = `
            <div>
                <label for="useDrawToolCheck">Use draw tool(closs link checkable):</label>
                <input type="checkbox" id="useDrawToolCheck">
            </div>
            <div>
                <label for="draw-group">update time and draw:</label>
                <div id="draw-group">
                    <input type="time" id="updateTime" required="required" placeholder="update time" aria-label="set update time" >
                    <input type="text" id="drawData" placeholder="exported data from draw tool aria-label="paste exported draw data" >
                    <button onclick="window.plugin.drawTimer.drawManager.addEntry()" class="draw-add-btn" aria-label="add new entry" >[+]</button>
                </div>
                <div id="drawEntriesList"></div>
            </div>
        `;

        dialog({
            html: html,
            id: 'drawTimerOptions',
            title: 'Draw Timer Options',
            width: 500,
            focusCallback: function() {
                // ダイアログ表示時に規定値を設定
                if(OptionData.useDrawTool){ $('#useDrawToolCheck').prop('checked',true); }

                let tagEntry = OptionData.entries || [];
                self.drawManager.init(tagEntry, true);
            },
            closeCallback: function(){
                self.init();
            },
            buttons: {
                'OK' : async function() {
                    OptionData.useDrawTool = $('#useDrawToolCheck').prop('checked');
                    OptionData.entries = self.drawManager.getEntry() || [];

                    self.saveOption();

                    $(this).dialog('close');
                },
                'Cancel' : function() { $(this).dialog('close'); }
            },
        });
    };

    self.drawManager = {
        entries: [],

        init: function(savedData, doRender) {
            if (savedData) {
                this.entries = savedData;
                if(doRender){
                    this.render();
                }
            }
        },

        addEntry: function() {
            const updateTime = document.getElementById('updateTime').value;
            const drawData = document.getElementById('drawData').value;

            // 必須チェック
            if (!updateTime) {
                alert('update time is required.');
                return;
            }
            // 既存の時間との重複チェック
            const existingEntry = this.entries.find(entry => entry.update === updateTime);

            if (existingEntry) {
                // 重複時間が見つかった場合、既存のエントリーのドローを更新
                if(confirm('An entry with this update time already exists. Do you want to update the draw data?')) {
                    existingEntry.draw = drawData;
                }else{
                    return;
                }
            } else {
                // 新規エントリーを作成
                const entry = {
                    id: Date.now(),
                    update: updateTime,
                    draw: drawData
                };
                this.entries.push(entry);
            }
            document.getElementById('drawData').value = ''; // 入力フィールドをクリア

            // データを保存してUIを更新
            this.render();

            // 入力フィールドをクリア
            updateTime.value = '';
            drawData.value = '';
        },

        deleteEntry: function(id) {
            // 指定されたIDのエントリーを削除
            this.entries = this.entries.filter(entry => entry.id !== id);
            this.render();
        },

        getEntry: function(){
            return this.entries;
        },

        render: function() {
            const container = document.getElementById('drawEntriesList');
            container.innerHTML = '';
            this.entries.sort((a, b) => {
                const [hoursA, minutesA] = a.update.split(':').map(Number);
                const [hoursB, minutesB] = b.update.split(':').map(Number);

                if (hoursA !== hoursB) {
                    return hoursA - hoursB;
                }
                return minutesA - minutesB;
            });

            this.entries.forEach(entry => {
                const div = document.createElement('div');
                div.className = 'draw-entry-item';
                div.innerHTML = `
                        <span>${entry.update}</span>
                        <span>${(entry.draw!=="")?"データあり":"データなし"}</span>
                        <span id="drawData-${entry.id}" style="display:none;">${entry.draw}</span>
                        <button onclick="window.plugin.drawTimer.updateDraw(document.getElementById('drawData-${entry.id}').innerText)" class="checkData" aria-label="${entry.update} のエントリーを表示">プレビュー</button>
                        <button onclick="window.plugin.drawTimer.drawManager.deleteEntry(${entry.id})" class="draw-delete-btn" aria-label="${entry.update} のエントリーを削除">[X]</button>
                    `;
                container.appendChild(div);
            });
        }
    };

    self.useDrawTool = function() {
        return (window.plugin.drawTools && OptionData.useDrawTool) ? true : false;
    }

    // The entry point for this plugin.
    self.start = async function() {
        // 設定値の読み込み
        self.loadOption();

        // EventListener
        // https://iitc-ce.github.io/ingress-intel-total-conversion/module-hooks.html
        // addHook('publicChatDataAvailable',self.listnerFunction);

        // カスタムレイヤーの追加
        self.drawTimerLayerGroup = new L.FeatureGroup();
        window.layerChooser.addOverlay(self.drawTimerLayerGroup, 'Draw Timer');

        /* ツールボックスの項目追加 */
        $('#toolbox').append('<a onclick="javascript:window.plugin.drawTimer.settingDialog();">DrawTimer</a>');


        let cssData = `
/* CSS */
#draw-group {
    display: flex;
    justify-content: flex-start;
    gap: 2px;
    margin-bottom: 8px;
}
    #draw-group input[type="time"] {
        flex-grow: 2;
    }
    #draw-group input[type="text"] {
        flex-grow: 10;
    }
    #draw-group button {
        flex-grow: 1;
    }

    #draw-group .draw-add-btn {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 4px 4px;
        border-radius: 3px;
        cursor: pointer;
    }

    #glympseTagEntriesList .draw-entry-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #000;
        padding: 2px;
        margin-bottom: 4px;
        background-color: #f5f5f5;
        border-radius: 3px;
        border: 1px solid #ddd;
    }

    #glympseTagEntriesList .draw-delete-btn {
        background-color: #ff4444;
        color: white;
        border: none;
        padding: 4px 4px;
        border-radius: 3px;
        cursor: pointer;
    }
        `;
        let styleTag = document.createElement('style');
        styleTag.setAttribute('type', 'text/css')
        styleTag.innerText = cssData;
        document.getElementsByTagName('head')[0].insertAdjacentElement('beforeend', styleTag);


        currentMarker = self.getMarkerIcon(currentColor);
        self.setOptions();

        // 初期設定
        self.init()
    };


    const setup = self.start;
    // PLUGIN END //////////////////////////////////////////////////////////



    setup.info = plugin_info; // Add an info property for IITC's plugin system
    if (!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if (window.iitcLoaded && typeof setup === 'function') setup();
}


var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode(`(${wrapper})(${JSON.stringify(info)});`));
(document.body || document.head || document.documentElement).appendChild(script);
