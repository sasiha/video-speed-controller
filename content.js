// ==UserScript==
// @name         Prime Video Speed Controller - 防御型（フック版）
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  プロパティのオーバーライドによりサイト側の速度強制リセットを無効化します
// @author       You
// @match        https://www.amazon.co.jp/gp/video/*
// @match        https://www.amazon.com/gp/video/*
// @match        https://www.primevideo.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ユーザーが望む再生速度（デフォルト 1.0）
    let customSpeed = 1.0;

    // 1. HTMLMediaElement (videoタグの親クラス) の playbackRate プロパティを書き換える
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');

    if (originalDescriptor) {
        Object.defineProperty(HTMLMediaElement.prototype, 'playbackRate', {
            get: function() {
                // プレイヤー側が現在の速度を問い合わせてきたら、本来の値（または設定値）を返す
                return customSpeed;
            },
            set: function(val) {
                // プレイヤー側が 1.0 等に変更しようとしても無視し、常に customSpeed を適用する
                // （※手動変更時は customSpeed 側を更新するため問題なし）
                originalDescriptor.set.call(this, customSpeed);
            },
            configurable: true,
            enumerable: true
        });
    }

    // 2. 速度を変更するための関数
    function setSpeed(newSpeed) {
        // 0.1 ～ 3.0 の範囲に制限＆小数第1位で丸め処理
        customSpeed = Math.round(Math.max(0.1, Math.min(3.0, newSpeed)) * 10) / 10;
        
        // ページ内のすべてのvideo要素に新速度を強制適用
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            try {
                originalDescriptor.set.call(video, customSpeed);
            } catch (e) {
                console.error('速度適用エラー:', e);
            }
        });

        showNotification(`速度: ${customSpeed.toFixed(1)}x`);
    }

    // 3. 通知表示
    function showNotification(text) {
        let el = document.getElementById('pv-custom-speed-notify');
        if (!el) {
            el = document.createElement('div');
            el.id = 'pv-custom-speed-notify';
            el.style.cssText = `
                position: fixed; top: 20px; right: 20px; padding: 10px 16px;
                background: rgba(0,0,0,0.85); color: #fff; font-size: 14px; font-weight: bold;
                border-radius: 6px; z-index: 999999; pointer-events: none;
                transition: opacity 0.2s; font-family: sans-serif;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            `;
            (document.body || document.documentElement).appendChild(el);
        }
        el.textContent = text;
        el.style.opacity = '1';
        
        clearTimeout(window._pvNotifyTimer);
        window._pvNotifyTimer = setTimeout(() => { el.style.opacity = '0'; }, 1500);
    }

    // 4. キーボードショートカット設定
    window.addEventListener('keydown', (e) => {
        // テキスト入力中は動作させない
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
            return;
        }

        const key = e.key.toLowerCase();
        if (key === 's') { // 減速
            e.preventDefault();
            setSpeed(customSpeed - 0.1);
        } else if (key === 'd') { // 加速
            e.preventDefault();
            setSpeed(customSpeed + 0.1);
        } else if (key === '\\') { // 標準（1.0x）に戻す
            e.preventDefault();
            setSpeed(1.0);
        }
    }, true);

    // 5. 定期チェック（CM明けや動画切り替え対策）
    setInterval(() => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.playbackRate !== customSpeed) {
                originalDescriptor.set.call(video, customSpeed);
            }
        });
    }, 1000);

})();
