// キーボードショートカット用のコンテンツスクリプト
(function() {
  'use strict';
  
  let currentSpeed = 1.0;
  const speedSteps = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
  
  // 動画要素を検出する関数（複数のセレクターを試行）
  function findVideoElement() {
    const selectors = [
      'video',
      'video[src]',
      '.webPlayerElement video',
      '.webPlayerContainer video',
      '[data-testid="video-player"] video',
      '.rendererContainer video',
      '.html5-video-player video',
      '#dv-web-player video',
      '.atvwebplayersdk-player-container video',
      '.webPlayerSDKContainer video'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element && element.tagName === 'VIDEO' && !element.hidden) {
          return element;
        }
      }
    }
    return null;
  }
  
  // 動画がDRM保護されているかチェック
  function isDRMProtected(video) {
    // DRM保護された動画の特徴をチェック
    if (!video.src && video.srcObject) {
      return true; // MediaSourceを使用している場合はDRM保護の可能性
    }
    
    // Widevineなどのキーシステムが使用されているかチェック
    if (video.mediaKeys) {
      return true;
    }
    
    // Prime Video特有のDRM保護チェック
    if (window.location.hostname.includes('primevideo.com') || window.location.hostname.includes('amazon.co')) {
      const playerContainer = document.querySelector('.webPlayerContainer, .atvwebplayersdk-player-container');
      if (playerContainer && playerContainer.dataset && playerContainer.dataset.drm) {
        return true;
      }
    }
    
    return false;
  }
  
  // 速度を変更する関数
  function changeVideoSpeed(speed) {
    const video = findVideoElement();
    if (video) {
      // DRM保護チェック
      if (isDRMProtected(video)) {
        showSpeedNotification(speed, true); // DRM保護警告付きで通知
        console.log('DRM保護されたコンテンツです。速度変更が制限されている可能性があります。');
      }
      
      try {
        // 速度変更を試行
        video.playbackRate = speed;
        
        // 変更が実際に適用されたかチェック
        setTimeout(() => {
          if (Math.abs(video.playbackRate - speed) > 0.01) {
            showSpeedNotification(video.playbackRate, false, 'DRM保護により速度変更が制限されています');
          } else {
            currentSpeed = speed;
            showSpeedNotification(speed);
          }
        }, 100);
        
        return true;
      } catch (error) {
        console.error('速度変更エラー:', error);
        showSpeedNotification(video.playbackRate, false, '速度変更に失敗しました');
        return false;
      }
    }
    return false;
  }
  
  // 速度通知を表示（DRM保護警告対応）
  function showSpeedNotification(speed, isDRM = false, errorMessage = '') {
    // 既存の通知を削除
    const existingNotification = document.getElementById('speed-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // 通知要素を作成
    const notification = document.createElement('div');
    notification.id = 'speed-notification';
    
    let notificationText = `Speed: ${speed.toFixed(2)}x`;
    let backgroundColor = 'rgba(0, 0, 0, 0.8)';
    
    if (errorMessage) {
      notificationText = errorMessage;
      backgroundColor = 'rgba(220, 53, 69, 0.9)';
    } else if (isDRM) {
      notificationText += ' (DRM保護)';
      backgroundColor = 'rgba(255, 193, 7, 0.9)';
    }
    
    notification.textContent = notificationText;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: ${backgroundColor};
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      font-weight: 600;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
      text-align: center;
    `;
    
    document.body.appendChild(notification);
    
    // 通知の表示時間を調整（エラーメッセージは長め）
    const displayTime = errorMessage ? 4000 : 2000;
    
    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, displayTime);
  }
  
  // 次の速度ステップを取得
  function getNextSpeed(currentSpeed, direction) {
    const currentIndex = speedSteps.findIndex(speed => Math.abs(speed - currentSpeed) < 0.01);
    
    if (direction === 'up') {
      if (currentIndex === -1) {
        // 現在の速度が配列にない場合、最も近い上位の速度を返す
        const nextSpeed = speedSteps.find(speed => speed > currentSpeed);
        return nextSpeed || speedSteps[speedSteps.length - 1];
      }
      return speedSteps[Math.min(currentIndex + 1, speedSteps.length - 1)];
    } else {
      if (currentIndex === -1) {
        // 現在の速度が配列にない場合、最も近い下位の速度を返す
        const prevSpeed = speedSteps.slice().reverse().find(speed => speed < currentSpeed);
        return prevSpeed || speedSteps[0];
      }
      return speedSteps[Math.max(currentIndex - 1, 0)];
    }
  }
  
  // 現在の速度を取得
  function getCurrentSpeed() {
    const video = findVideoElement();
    if (video) {
      return video.playbackRate;
    }
    return 1.0;
  }
  
  // 動画要素の変更を監視してリトライ
  function waitForVideoElement(callback, maxRetries = 10, delay = 1000) {
    let retries = 0;
    
    const checkVideo = () => {
      const video = findVideoElement();
      if (video) {
        callback(video);
        return;
      }
      
      retries++;
      if (retries < maxRetries) {
        setTimeout(checkVideo, delay);
      }
    };
    
    checkVideo();
  }
  
  // Prime Video専用の初期化処理
  function initializePrimeVideo() {
    // Prime Videoの動画プレイヤーが読み込まれるまで待機
    waitForVideoElement((video) => {
      currentSpeed = video.playbackRate;
      console.log('Prime Video player detected');
    });
  }
  
  // サイト別の初期化
  function initializeForSite() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('primevideo.com') || hostname.includes('amazon.co')) {
      initializePrimeVideo();
    } else {
      // 他のサイト用の汎用初期化
      setTimeout(() => {
        const video = findVideoElement();
        if (video) {
          currentSpeed = video.playbackRate;
        }
      }, 1000);
    }
  }
  
  // キーボードイベントリスナー
  document.addEventListener('keydown', function(e) {
    // 入力フィールドにフォーカスがある場合は無視
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }
    
    // 修飾キーが押されている場合は無視
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    
    const video = findVideoElement();
    if (!video) return;
    
    currentSpeed = getCurrentSpeed();
    
    switch(e.key.toLowerCase()) {
      case 's':
        // 速度を下げる（Sキー）
        e.preventDefault();
        const lowerSpeed = getNextSpeed(currentSpeed, 'down');
        changeVideoSpeed(lowerSpeed);
        break;
        
      case 'd':
        // 速度を上げる（Dキー）
        e.preventDefault();
        const higherSpeed = getNextSpeed(currentSpeed, 'up');
        changeVideoSpeed(higherSpeed);
        break;
        
      case '\\':
        // 通常速度に戻す
        e.preventDefault();
        changeVideoSpeed(1.0);
        break;
    }
  });
  
  // 動画要素の変更を監視（より堅牢な検出）
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' || mutation.type === 'attributes') {
        const video = findVideoElement();
        if (video && video.playbackRate !== currentSpeed) {
          currentSpeed = video.playbackRate;
        }
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id']
  });
  
  // 初期化処理
  initializeForSite();
  
  // ページが完全に読み込まれた後にもう一度試行
  window.addEventListener('load', () => {
    setTimeout(initializeForSite, 2000);
  });
  
  // Prime Video用の追加監視
  if (window.location.hostname.includes('primevideo.com') || window.location.hostname.includes('amazon.co')) {
    // Prime Videoの動的コンテンツ読み込みを監視
    const primeVideoObserver = new MutationObserver(() => {
      const video = findVideoElement();
      if (video && !video.hasAttribute('data-speed-controller')) {
        video.setAttribute('data-speed-controller', 'true');
        currentSpeed = video.playbackRate;
      }
    });
    
    primeVideoObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();