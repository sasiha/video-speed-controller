document.addEventListener('DOMContentLoaded', function() {
  const speedBtns = document.querySelectorAll('.speed-btn[data-speed]');
  const customSpeedInput = document.getElementById('customSpeed');
  const applyCustomBtn = document.getElementById('applyCustom');
  const currentSpeedDisplay = document.getElementById('currentSpeed');
  const errorMsg = document.getElementById('errorMsg');
  
  let currentSpeed = 1.0;
  
  // ページURLをチェックして対応サイトかどうか確認
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const url = tabs[0].url;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
      showError('この拡張機能はこのページでは動作しません');
      return;
    }
    
    // 対応サイトかチェック
    const supportedSites = ['youtube.com', 'amazon.com', 'amazon.co.jp', 'primevideo.com', 'amazon.de', 'amazon.co.uk'];
    const isSupported = supportedSites.some(site => url.includes(site));
    
    if (!isSupported) {
      showError('このサイトは対応していません');
      return;
    }
    
    // 現在の速度を取得
    getCurrentSpeed();
  });
  
  // 速度ボタンのクリックイベント
  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      setVideoSpeed(speed);
    });
  });
  
  // カスタム速度の適用
  applyCustomBtn.addEventListener('click', () => {
    const speed = parseFloat(customSpeedInput.value);
    if (speed >= 0.1 && speed <= 10) {
      setVideoSpeed(speed);
      customSpeedInput.value = '';
    } else {
      showError('速度は0.1〜10の範囲で入力してください');
    }
  });
  
  // Enterキーでカスタム速度適用
  customSpeedInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyCustomBtn.click();
    }
  });
  
  // 動画の速度を設定
  function setVideoSpeed(speed) {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      // chrome:// URLやextension:// URLをチェック
      if (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('chrome-extension://') || tabs[0].url.startsWith('edge://') || tabs[0].url.startsWith('about:')) {
        showError('この拡張機能はこのページでは動作しません');
        return;
      }
      
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: changeVideoSpeed,
        args: [speed]
      }, (results) => {
        // エラーハンドリングを追加
        if (chrome.runtime.lastError) {
          showError('スクリプトの実行に失敗しました: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (results && results[0] && results[0].result) {
          currentSpeed = speed;
          updateSpeedDisplay(speed);
          updateActiveButton(speed);
          hideError();
        } else {
          showError('動画が見つかりませんでした');
        }
      });
    });
  }
  
  // 現在の速度を取得
  function getCurrentSpeed() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      // chrome:// URLやextension:// URLをチェック
      if (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('chrome-extension://') || tabs[0].url.startsWith('edge://') || tabs[0].url.startsWith('about:')) {
        showError('この拡張機能はこのページでは動作しません');
        return;
      }
      
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: getVideoSpeed
      }, (results) => {
        // エラーハンドリングを追加
        if (chrome.runtime.lastError) {
          showError('現在の速度を取得できませんでした');
          return;
        }
        
        if (results && results[0] && results[0].result) {
          currentSpeed = results[0].result;
          updateSpeedDisplay(currentSpeed);
          updateActiveButton(currentSpeed);
        }
      });
    });
  }
  
  // 速度表示を更新
  function updateSpeedDisplay(speed) {
    currentSpeedDisplay.textContent = `Speed: ${speed.toFixed(1)}x`;
  }
  
  // アクティブボタンを更新
  function updateActiveButton(speed) {
    speedBtns.forEach(btn => {
      btn.classList.remove('active');
      if (parseFloat(btn.dataset.speed) === speed) {
        btn.classList.add('active');
      }
    });
  }
  
  // エラーメッセージを表示
  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    setTimeout(() => {
      hideError();
    }, 3000);
  }
  
  // エラーメッセージを非表示
  function hideError() {
    errorMsg.style.display = 'none';
  }
});

// Content scriptで実行される関数
function changeVideoSpeed(speed) {
  // 複数のセレクターを試行して動画要素を見つける
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
        try {
          element.playbackRate = speed;
          // 変更が実際に適用されたかチェック
          setTimeout(() => {
            return Math.abs(element.playbackRate - speed) < 0.01;
          }, 100);
          return true;
        } catch (error) {
          console.error('速度変更エラー:', error);
          return false;
        }
      }
    }
  }
  return false;
}

function getVideoSpeed() {
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
        return element.playbackRate;
      }
    }
  }
  return 1.0;
}