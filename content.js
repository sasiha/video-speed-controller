// ==UserScript==
// @name         Prime Video Speed Controller - DRM対応版
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Prime VideoでDRM保護を考慮した動画速度変更（0.1倍速刻み）
// @author       You
// @match        https://www.amazon.co.jp/gp/video/*
// @match        https://www.amazon.com/gp/video/*
// @match        https://www.primevideo.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let currentSpeed = 1.0;
    let speedDisplay = null;
    let notification = null;
    let isDrmProtected = false;
    let lastNotificationTimeout = null;

    // 動画要素を取得する関数（複数のセレクターを試行）
    function getVideoElement() {
        const selectors = [
            'video',
            '.atvwebplayersdk-player-container video',
            '.webPlayerSDKContainer video',
            '[data-testid="video-player"] video',
            '.dv-player-fullscreen video'
        ];

        for (const selector of selectors) {
            const video = document.querySelector(selector);
            if (video) {
                return video;
            }
        }
        return null;
    }

    // DRM保護の検出
    function detectDrmProtection(video) {
        if (!video) return false;

        // MediaKeys APIの使用をチェック
        if (video.mediaKeys) {
            return true;
        }

        // EME (Encrypted Media Extensions) の使用をチェック
        if (video.webkitKeys || video.keys) {
            return true;
        }

        // src属性にblob:が含まれる場合はDRM保護の可能性が高い
        if (video.src && video.src.startsWith('blob:')) {
            return true;
        }

        return false;
    }

    // 通知を表示する関数
    function showNotification(message, type = 'normal') {
        // 前の通知のタイムアウトをクリア
        if (lastNotificationTimeout) {
            clearTimeout(lastNotificationTimeout);
        }

        // 既存の通知を削除
        if (notification) {
            notification.remove();
        }

        // 通知要素を作成
        notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;

        // タイプに応じてスタイルを設定
        switch (type) {
            case 'error':
                notification.style.backgroundColor = '#ff4444';
                notification.style.color = 'white';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ffaa00';
                notification.style.color = 'white';
                break;
            default:
                notification.style.backgroundColor = 'rgba(0,0,0,0.8)';
                notification.style.color = 'white';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // 表示時間を設定（エラーは4秒、その他は2秒）
        const displayTime = type === 'error' ? 4000 : 2000;
        
        lastNotificationTimeout = setTimeout(() => {
            if (notification) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification) {
                        notification.remove();
                        notification = null;
                    }
                }, 300);
            }
        }, displayTime);
    }

    // 速度を変更する関数
    function changeSpeed(newSpeed) {
        const video = getVideoElement();
        if (!video) {
            showNotification('動画が見つかりません', 'error');
            return;
        }

        // DRM保護チェック
        isDrmProtected = detectDrmProtection(video);

        // 速度を制限（0.1 - 3.0）
        newSpeed = Math.max(0.1, Math.min(3.0, newSpeed));
        
        try {
            // 速度変更を試行
            const oldSpeed = video.playbackRate;
            video.playbackRate = newSpeed;
            
            // 変更が成功したかチェック
            setTimeout(() => {
                if (Math.abs(video.playbackRate - newSpeed) > 0.01) {
                    // 速度変更に失敗した場合
                    if (isDrmProtected) {
                        showNotification(`DRM保護により速度変更が制限されています (現在: ${video.playbackRate.toFixed(1)}x)`, 'warning');
                    } else {
                        showNotification(`速度変更に失敗しました (現在: ${video.playbackRate.toFixed(1)}x)`, 'error');
                    }
                } else {
                    // 成功した場合
                    currentSpeed = newSpeed;
                    updateSpeedDisplay();
                    
                    let message = `速度: ${newSpeed.toFixed(1)}x`;
                    if (isDrmProtected) {
                        message += ' (DRM保護検出)';
                        showNotification(message, 'warning');
                    } else {
                        showNotification(message);
                    }
                }
            }, 100);
            
        } catch (error) {
            console.error('速度変更エラー:', error);
            showNotification('速度変更でエラーが発生しました', 'error');
        }
    }

    // 速度表示を更新する関数
    function updateSpeedDisplay() {
        if (!speedDisplay) return;
        speedDisplay.textContent = `${currentSpeed.toFixed(1)}x`;
    }

    // 速度表示UIを作成する関数
    function createSpeedDisplay() {
        if (speedDisplay) return;

        speedDisplay = document.createElement('div');
        speedDisplay.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            z-index: 9999;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.3s ease;
        `;

        speedDisplay.textContent = `${currentSpeed.toFixed(1)}x`;
        document.body.appendChild(speedDisplay);

        // クリックでポップアップを表示
        speedDisplay.addEventListener('click', showSpeedPopup);
    }

    // 速度選択ポップアップを表示する関数
    function showSpeedPopup() {
        // 既存のポップアップを削除
        const existingPopup = document.querySelector('.speed-popup');
        if (existingPopup) {
            existingPopup.remove();
            return;
        }

        const popup = document.createElement('div');
        popup.className = 'speed-popup';
        popup.style.cssText = `
            position: fixed;
            top: 60px;
            left: 20px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 16px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 200px;
        `;

        const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
        const speedButtons = speeds.map(speed => {
            const button = document.createElement('button');
            button.textContent = `${speed.toFixed(2)}x`;
            button.style.cssText = `
                display: block;
                width: 100%;
                margin: 2px 0;
                padding: 6px;
                background: ${speed === currentSpeed ? '#555' : 'transparent'};
                color: white;
                border: 1px solid #666;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
            button.addEventListener('click', () => {
                changeSpeed(speed);
                popup.remove();
            });
            return button;
        }).join('');

        popup.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold;">速度選択</div>
            ${speeds.map(speed => `
                <button style="display: block; width: 100%; margin: 2px 0; padding: 6px; 
                    background: ${speed === currentSpeed ? '#555' : 'transparent'}; 
                    color: white; border: 1px solid #666; border-radius: 4px; cursor: pointer; font-size: 12px;"
                    onclick="changeSpeed(${speed}); this.parentElement.remove();">
                    ${speed.toFixed(2)}x
                </button>
            `).join('')}
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #666; font-size: 11px;">
                <strong>キーボードショートカット:</strong><br>
                S: 速度を下げる (-0.1)<br>
                D: 速度を上げる (+0.1)<br>
                \\: 通常速度 (1.0x)
            </div>
        `;

        // ボタンにイベントリスナーを追加
        const buttons = popup.querySelectorAll('button');
        buttons.forEach((button, index) => {
            button.addEventListener('click', () => {
                changeSpeed(speeds[index]);
                popup.remove();
            });
        });

        document.body.appendChild(popup);

        // 3秒後に自動で閉じる
        setTimeout(() => {
            if (popup && popup.parentElement) {
                popup.remove();
            }
        }, 3000);

        // 外部クリックで閉じる
        document.addEventListener('click', function closePopup(e) {
            if (!popup.contains(e.target) && e.target !== speedDisplay) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        });
    }

    // キーボードイベントリスナー
    document.addEventListener('keydown', function(e) {
        // 入力欄にフォーカスがある場合は無視
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' || 
            document.activeElement.contentEditable === 'true') {
            return;
        }

        const key = e.key.toLowerCase();
        
        switch(key) {
            case 's': // 速度を下げる（0.1刻み）
                e.preventDefault();
                changeSpeed(Math.max(0.1, currentSpeed - 0.1));
                break;
            case 'd': // 速度を上げる（0.1刻み）
                e.preventDefault();
                changeSpeed(Math.min(3.0, currentSpeed + 0.1));
                break;
            case '\\': // 通常速度に戻す
                e.preventDefault();
                changeSpeed(1.0);
                break;
        }
    });

    // 初期化関数
    function initialize() {
        // 動画要素が読み込まれるまで待機
        const checkVideo = setInterval(() => {
            const video = getVideoElement();
            if (video) {
                clearInterval(checkVideo);
                createSpeedDisplay();
                
                // 初期速度を設定
                currentSpeed = video.playbackRate || 1.0;
                updateSpeedDisplay();
                
                // DRM保護をチェック
                isDrmProtected = detectDrmProtection(video);
                if (isDrmProtected) {
                    showNotification('DRM保護されたコンテンツです。速度変更が制限される場合があります。', 'warning');
                }
                
                console.log('Prime Video Speed Controller が初期化されました');
                console.log('キーボードショートカット: S(速度↓), D(速度↑), \\(通常速度)');
            }
        }, 1000);

        // 10秒後にタイムアウト
        setTimeout(() => {
            clearInterval(checkVideo);
        }, 10000);
    }

    // changeSpeed をグローバルに露出（ポップアップのボタンから呼び出すため）
    window.changeSpeed = changeSpeed;

    // ページ読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // URLの変更を監視（SPA対応）
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(initialize, 2000); // URL変更後に再初期化
        }
    }).observe(document, {subtree: true, childList: true});

})();