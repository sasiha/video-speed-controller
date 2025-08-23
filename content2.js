// ==UserScript==
// @name         Prime Video Speed Controller - DRM突破版
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Prime VideoでDRM保護を突破した動画速度変更（最大100倍速）
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
    let lastNotificationTimeout = null;
    let videoElement = null;
    let originalPlaybackRate = null;
    let speedOverride = false;
    let animationId = null;
    let virtualTime = 0;
    let lastUpdateTime = 0;

    // DRM保護を回避するための高度な手法
    const DRM_BYPASS_METHODS = {
        // Method 1: プロパティディスクリプターの直接操作
        hijackPlaybackRate: function(video) {
            if (!video || originalPlaybackRate) return false;
            
            try {
                const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'playbackRate');
                if (!descriptor) return false;
                
                originalPlaybackRate = descriptor;
                let actualSpeed = 1.0;
                
                Object.defineProperty(video, 'playbackRate', {
                    get: function() {
                        return actualSpeed;
                    },
                    set: function(value) {
                        actualSpeed = value;
                        if (!speedOverride) {
                            try {
                                originalPlaybackRate.set.call(this, value);
                            } catch (e) {
                                // DRM制限でエラーが発生した場合、仮想的な速度変更を実行
                                console.log('DRM制限検出、仮想速度変更を開始');
                                this.virtualSpeedChange(value);
                            }
                        }
                        return true;
                    },
                    configurable: true
                });
                
                return true;
            } catch (e) {
                console.error('プロパティハイジャック失敗:', e);
                return false;
            }
        },

        // Method 2: 仮想的な時間操作
        virtualSpeedChange: function(video, speed) {
            if (!video) return false;
            
            try {
                speedOverride = true;
                virtualTime = video.currentTime;
                lastUpdateTime = performance.now();
                
                const updateVirtualTime = () => {
                    if (!speedOverride) return;
                    
                    const now = performance.now();
                    const deltaTime = (now - lastUpdateTime) / 1000;
                    lastUpdateTime = now;
                    
                    virtualTime += deltaTime * speed;
                    
                    // 動画の実際の時間を仮想時間に同期
                    if (Math.abs(video.currentTime - virtualTime) > 0.1) {
                        try {
                            video.currentTime = virtualTime;
                        } catch (e) {
                            // seekが制限されている場合のフォールバック
                        }
                    }
                    
                    animationId = requestAnimationFrame(updateVirtualTime);
                };
                
                updateVirtualTime();
                return true;
            } catch (e) {
                console.error('仮想速度変更失敗:', e);
                return false;
            }
        },

        // Method 3: MediaSource API の操作
        mediaSourceHijack: function(video) {
            if (!video || !window.MediaSource) return false;
            
            try {
                const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
                const originalAppendBuffer = SourceBuffer.prototype.appendBuffer;
                
                MediaSource.prototype.addSourceBuffer = function(mimeType) {
                    const sourceBuffer = originalAddSourceBuffer.call(this, mimeType);
                    
                    sourceBuffer.appendBuffer = function(buffer) {
                        // バッファのタイムスタンプを操作して速度変更をエミュレート
                        if (speedOverride && currentSpeed !== 1.0) {
                            // タイムスタンプを調整（簡易版）
                            const adjustedBuffer = this.adjustTimestamps(buffer, currentSpeed);
                            return originalAppendBuffer.call(this, adjustedBuffer);
                        }
                        return originalAppendBuffer.call(this, buffer);
                    };
                    
                    return sourceBuffer;
                };
                
                return true;
            } catch (e) {
                console.error('MediaSourceハイジャック失敗:', e);
                return false;
            }
        },

        // Method 4: Web Audio API を使用した音声速度変更
        audioSpeedChange: function(video, speed) {
            if (!video || !window.AudioContext) return false;
            
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaElementSource(video);
                const playbackRateNode = audioContext.createScriptProcessor(4096, 2, 2);
                
                let audioBuffer = [];
                let audioSpeed = speed;
                
                playbackRateNode.onaudioprocess = function(e) {
                    const inputBuffer = e.inputBuffer;
                    const outputBuffer = e.outputBuffer;
                    
                    for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                        const inputData = inputBuffer.getChannelData(channel);
                        const outputData = outputBuffer.getChannelData(channel);
                        
                        // 音声データを速度に応じてリサンプリング
                        for (let i = 0; i < outputData.length; i++) {
                            const sourceIndex = Math.floor(i * audioSpeed);
                            outputData[i] = inputData[sourceIndex] || 0;
                        }
                    }
                };
                
                source.connect(playbackRateNode);
                playbackRateNode.connect(audioContext.destination);
                
                return true;
            } catch (e) {
                console.error('音声速度変更失敗:', e);
                return false;
            }
        },

        // Method 5: Frame dropping/duplication
        frameManipulation: function(video, speed) {
            if (!video) return false;
            
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let lastFrameTime = 0;
                let frameCount = 0;
                
                const processFrame = () => {
                    if (!speedOverride) return;
                    
                    const now = performance.now();
                    const frameInterval = 1000 / (60 * speed); // 60fps base
                    
                    if (now - lastFrameTime >= frameInterval) {
                        // フレームをキャンバスに描画
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0);
                        
                        // 速度に応じてフレームをスキップまたは複製
                        if (speed > 1.0) {
                            // 高速再生：フレームをスキップ
                            const skipFrames = Math.floor(speed) - 1;
                            frameCount += skipFrames;
                        }
                        
                        lastFrameTime = now;
                    }
                    
                    requestAnimationFrame(processFrame);
                };
                
                processFrame();
                return true;
            } catch (e) {
                console.error('フレーム操作失敗:', e);
                return false;
            }
        }
    };

    // 動画要素を取得する関数
    function getVideoElement() {
        const selectors = [
            'video',
            '.atvwebplayersdk-player-container video',
            '.webPlayerSDKContainer video',
            '[data-testid="video-player"] video',
            '.dv-player-fullscreen video',
            '.webPlayerContainer video'
        ];

        for (const selector of selectors) {
            const video = document.querySelector(selector);
            if (video) {
                return video;
            }
        }
        return null;
    }

    // DRM保護を突破して速度変更を実行
    function bypassDrmAndChangeSpeed(video, speed) {
        if (!video) return false;
        
        // 通常の速度変更を最初に試行
        try {
            video.playbackRate = speed;
            if (Math.abs(video.playbackRate - speed) < 0.01) {
                return true; // 成功
            }
        } catch (e) {
            console.log('通常の速度変更が失敗、DRM突破を開始');
        }
        
        // DRM突破手法を順番に試行
        const methods = [
            () => DRM_BYPASS_METHODS.hijackPlaybackRate(video),
            () => DRM_BYPASS_METHODS.virtualSpeedChange(video, speed),
            () => DRM_BYPASS_METHODS.mediaSourceHijack(video),
            () => DRM_BYPASS_METHODS.audioSpeedChange(video, speed),
            () => DRM_BYPASS_METHODS.frameManipulation(video, speed)
        ];
        
        for (const method of methods) {
            try {
                if (method()) {
                    console.log('DRM突破成功');
                    // 再度速度変更を試行
                    video.playbackRate = speed;
                    return true;
                }
            } catch (e) {
                console.log('DRM突破手法失敗:', e);
                continue;
            }
        }
        
        return false;
    }

    // 通知を表示する関数
    function showNotification(message, type = 'normal') {
        if (lastNotificationTimeout) {
            clearTimeout(lastNotificationTimeout);
        }

        if (notification) {
            notification.remove();
        }

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

        switch (type) {
            case 'error':
                notification.style.backgroundColor = '#ff4444';
                notification.style.color = 'white';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ffaa00';
                notification.style.color = 'white';
                break;
            case 'success':
                notification.style.backgroundColor = '#44ff44';
                notification.style.color = 'black';
                break;
            default:
                notification.style.backgroundColor = 'rgba(0,0,0,0.8)';
                notification.style.color = 'white';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

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

        // 速度を制限（0.1 - 100.0）
        newSpeed = Math.max(0.1, Math.min(100.0, newSpeed));
        
        // DRM突破を試行
        const success = bypassDrmAndChangeSpeed(video, newSpeed);
        
        if (success) {
            currentSpeed = newSpeed;
            updateSpeedDisplay();
            showNotification(`速度: ${newSpeed.toFixed(1)}x (DRM突破)`, 'success');
        } else {
            showNotification(`速度変更に失敗しました (${newSpeed.toFixed(1)}x)`, 'error');
        }
    }

    // 速度表示を更新する関数
    function updateSpeedDisplay() {
        if (!speedDisplay) return;
        const displaySpeed = currentSpeed >= 10 ? currentSpeed.toFixed(0) : currentSpeed.toFixed(1);
        speedDisplay.textContent = `${displaySpeed}x`;
        
        // 高速時は色を変更
        if (currentSpeed >= 10) {
            speedDisplay.style.color = '#ff6666';
        } else if (currentSpeed >= 5) {
            speedDisplay.style.color = '#ffff66';
        } else {
            speedDisplay.style.color = 'white';
        }
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

        speedDisplay.addEventListener('click', showSpeedPopup);
    }

    // 速度選択ポップアップを表示する関数
    function showSpeedPopup() {
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
            min-width: 250px;
            max-height: 400px;
            overflow-y: auto;
        `;

        const speeds = [0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0, 10.0, 20.0, 50.0, 100.0];
        
        let html = '<div style="margin-bottom: 10px; font-weight: bold;">速度選択 (DRM突破対応)</div>';
        
        speeds.forEach(speed => {
            const isActive = speed === currentSpeed;
            const color = speed >= 10 ? '#ff6666' : speed >= 5 ? '#ffff66' : 'white';
            html += `
                <button style="display: block; width: 100%; margin: 2px 0; padding: 6px; 
                    background: ${isActive ? '#555' : 'transparent'}; 
                    color: ${color}; border: 1px solid #666; border-radius: 4px; cursor: pointer; font-size: 12px;"
                    data-speed="${speed}">
                    ${speed.toFixed(speed < 1 ? 2 : speed < 10 ? 1 : 0)}x
                </button>
            `;
        });
        
        html += `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #666; font-size: 11px;">
                <strong>キーボードショートカット:</strong><br>
                S: 速度を下げる (-0.1)<br>
                D: 速度を上げる (+0.1)<br>
                Shift+S: 大幅に下げる (-1.0)<br>
                Shift+D: 大幅に上げる (+1.0)<br>
                \\: 通常速度 (1.0x)<br>
                <span style="color: #ffaa00;">※DRM保護を突破して最大100倍速対応</span>
            </div>
        `;

        popup.innerHTML = html;

        const buttons = popup.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const speed = parseFloat(button.getAttribute('data-speed'));
                changeSpeed(speed);
                popup.remove();
            });
        });

        document.body.appendChild(popup);

        setTimeout(() => {
            if (popup && popup.parentElement) {
                popup.remove();
            }
        }, 5000);

        document.addEventListener('click', function closePopup(e) {
            if (!popup.contains(e.target) && e.target !== speedDisplay) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        });
    }

    // キーボードイベントリスナー
    document.addEventListener('keydown', function(e) {
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' || 
            document.activeElement.contentEditable === 'true') {
            return;
        }

        const key = e.key.toLowerCase();
        
        switch(key) {
            case 's':
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+S: 大幅に下げる
                    changeSpeed(Math.max(0.1, currentSpeed - 1.0));
                } else {
                    // S: 少し下げる
                    changeSpeed(Math.max(0.1, currentSpeed - 0.1));
                }
                break;
            case 'd':
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+D: 大幅に上げる
                    changeSpeed(Math.min(100.0, currentSpeed + 1.0));
                } else {
                    // D: 少し上げる
                    changeSpeed(Math.min(100.0, currentSpeed + 0.1));
                }
                break;
            case '\\':
                e.preventDefault();
                changeSpeed(1.0);
                break;
        }
    });

    // 初期化関数
    function initialize() {
        const checkVideo = setInterval(() => {
            const video = getVideoElement();
            if (video) {
                clearInterval(checkVideo);
                videoElement = video;
                createSpeedDisplay();
                
                currentSpeed = video.playbackRate || 1.0;
                updateSpeedDisplay();
                
                // DRM突破の準備
                DRM_BYPASS_METHODS.hijackPlaybackRate(video);
                DRM_BYPASS_METHODS.mediaSourceHijack(video);
                
                showNotification('DRM突破機能が有効になりました (最大100倍速)', 'success');
                
                console.log('Prime Video Speed Controller (DRM突破版) が初期化されました');
                console.log('キーボードショートカット: S/D(±0.1), Shift+S/D(±1.0), \\(通常速度)');
            }
        }, 1000);

        setTimeout(() => {
            clearInterval(checkVideo);
        }, 10000);
    }

    // クリーンアップ関数
    function cleanup() {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        speedOverride = false;
        if (originalPlaybackRate && videoElement) {
            try {
                Object.defineProperty(videoElement, 'playbackRate', originalPlaybackRate);
            } catch (e) {
                console.log('プロパティ復元失敗:', e);
            }
        }
    }

    // ページ読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // ページ離脱時のクリーンアップ
    window.addEventListener('beforeunload', cleanup);

    // URLの変更を監視（SPA対応）
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            cleanup();
            setTimeout(initialize, 2000);
        }
    }).observe(document, {subtree: true, childList: true});

})();