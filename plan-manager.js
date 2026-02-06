// plan-manager.js - 4タイプのプラン管理と使用回数制限

const PlanManager = (() => {
  // ========== プラン設定 ==========
  const PLAN_LIMITS = {
    trainee_lite: {
      name: 'trainee ライト',
      daily_limit: 30,
      price: 980,
      features: ['30回/日', 'N5語彙', '基礎3シナリオ', 'ローマ字+ID語']
    },
    trainee_standard: {
      name: 'trainee スタンダード',
      daily_limit: 70,
      price: 1680,
      features: ['70回/日', 'N5-N4語彙', '全5シナリオ', '例文保存50件', '簡易レポート']
    },
    ssw_standard: {
      name: 'ssw スタンダード',
      daily_limit: 100,
      price: 2680,
      features: ['100回/日', 'N4-N3語彙+敬語', '高度8シナリオ', '例文保存200件', '詳細レポート']
    },
    ssw_pro: {
      name: 'ssw プロ',
      daily_limit: 150,
      price: 4980,
      features: ['150回/日', 'N3-N2語彙+謙譲語', '全12シナリオ', '例文保存無制限', 'AI分析', '優先サポート']
    },
    ssw_professional: {
      name: 'ssw プロフェッショナル',
      daily_limit: 150,
      price: 4980,
      features: ['150回/日', 'N3-N2語彙+謙譲語', '全12シナリオ', '例文保存無制限', 'AI分析', '優先サポート']
    }
  };

  // ========== ローカルストレージ管理 ==========
  const storage = {
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(key);
        if (item === null || item === undefined || item === '') return defaultValue;

        // JSONで読めるものはJSONで読む（新形式）
        try {
          return JSON.parse(item);
        } catch (parseErr) {
          // 旧形式（ただの文字列）を救済し、その場でJSON形式へ自動変換
          try { localStorage.setItem(key, JSON.stringify(item)); } catch (_) {}
          return item;
        }
      } catch (e) {
        console.error('Storage get error:', e);
        return defaultValue;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error('Storage set error:', e);
      }
    },
    remove: (key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('Storage remove error:', e);
      }
    }
  };

  // ========== プラン情報の取得 ==========
  const getCurrentPlan = () => {
    return storage.get('selected_plan', 'trainee_lite');
  };

  const setCurrentPlan = (planKey) => {
    const key = (planKey && PLAN_LIMITS[planKey]) ? planKey : 'trainee_lite';
    storage.set('selected_plan', key);

    // 表示更新
    try { updateUsageDisplay(); } catch (e) {}
    try {
      const planInfoElement = document.getElementById('planInfo');
      if (planInfoElement) {
        const config = getPlanConfig(key);
        planInfoElement.textContent = `現在のプラン: ${config.name}`;
      }
    } catch (e) {}

    return key;
  };

  const getPlanConfig = (plan = null) => {
    const currentPlan = plan || getCurrentPlan();
    return PLAN_LIMITS[currentPlan] || PLAN_LIMITS.trainee_lite;
  };

  // ========== 使用回数管理 ==========
  const getTodayKey = () => {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const getUsageData = (plan = null) => {
    const currentPlan = plan || getCurrentPlan();
    const today = getTodayKey();
    const key = `usage_${currentPlan}_${today}`;
    const usage = storage.get(key, { count: 0, date: today });
    
    // 日付が変わったらリセット
    if (usage.date !== today) {
      usage.count = 0;
      usage.date = today;
      storage.set(key, usage);
    }
    
    return usage;
  };

  const checkDailyLimit = (plan = null) => {
    const currentPlan = plan || getCurrentPlan();
    const config = getPlanConfig(currentPlan);
    const usage = getUsageData(currentPlan);
    
    // 無制限プランの場合
    if (config.daily_limit >= 999999) {
      return { allowed: true, remaining: Infinity, used: usage.count, limit: config.daily_limit };
    }
    
    // 制限に達しているか確認
    const allowed = usage.count < config.daily_limit;
    const remaining = Math.max(0, config.daily_limit - usage.count);
    
    return {
      allowed,
      remaining,
      used: usage.count,
      limit: config.daily_limit
    };
  };

  const incrementUsage = (plan = null) => {
    const currentPlan = plan || getCurrentPlan();
    const today = getTodayKey();
    const key = `usage_${currentPlan}_${today}`;
    const usage = storage.get(key, { count: 0, date: today });
    
    usage.count += 1;
    usage.date = today;
    storage.set(key, usage);
    
    return usage.count;
  };

  // ========== UI表示更新 ==========
  const updateUsageDisplay = (elementId = 'usageInfo') => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const status = checkDailyLimit();
    const config = getPlanConfig();
    
    if (status.remaining === Infinity) {
      element.textContent = `今日の利用: ${status.used}回（無制限）`;
      element.style.color = '#10b981';
    } else {
      element.textContent = `今日の残り: ${status.remaining}/${status.limit}回`;
      
      // 残り回数に応じて色を変更
      if (status.remaining === 0) {
        element.style.color = '#ef4444'; // 赤
      } else if (status.remaining <= 5) {
        element.style.color = '#f59e0b'; // 黄
      } else {
        element.style.color = '#10b981'; // 緑
      }
    }
  };

  // ========== アップグレードモーダル ==========
  const showUpgradeModal = (used, limit, currentPlan) => {
    const modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const config = getPlanConfig(currentPlan);
    const nextPlan = getNextPlan(currentPlan);
    
    modal.innerHTML = `
      <div style="background:#fff; border-radius:16px; padding:32px; max-width:480px; margin:20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h2 style="margin:0 0 16px; font-size:24px; color:#111;">今日の利用上限に達しました</h2>
        <p style="margin:0 0 8px; font-size:16px; color:#666;">
          今日は<strong>${used}回</strong>利用しました（上限: ${limit}回/日）
        </p>
        <p style="margin:0 0 24px; font-size:14px; color:#888;">
          明日0時にリセットされます。
        </p>
        
        ${nextPlan ? `
          <div style="background:#f3f4f6; padding:20px; border-radius:12px; margin-bottom:24px;">
            <h3 style="margin:0 0 12px; font-size:18px; color:#111;">
              ${nextPlan.name}にアップグレード
            </h3>
            <p style="margin:0 0 12px; font-size:14px; color:#555;">
              ¥${nextPlan.price.toLocaleString()}/月
            </p>
            <ul style="margin:0; padding-left:20px; font-size:14px; color:#555;">
              ${nextPlan.features.map(f => `<li>${f}</li>`).join('')}
            </ul>
          </div>
          <button onclick="(function(){const lock=document.getElementById('lock'); if(lock){lock.style.display='flex'; const m=document.getElementById('lockMsg'); if(m) m.textContent='上位プランで利用回数を増やせます（Stripe）。';}else{alert('プラン画面は準備中です');}})()" style="
            width:100%;
            padding:14px;
            border:none;
            border-radius:12px;
            background:#667eea;
            color:#fff;
            font-size:16px;
            font-weight:600;
            cursor:pointer;
            margin-bottom:12px;
          ">
            プランを見る
          </button>
        ` : ''}
        
        <button onclick="document.getElementById('upgradeModal').remove()" style="
          width:100%;
          padding:14px;
          border:1px solid #ddd;
          border-radius:12px;
          background:#fff;
          color:#111;
          font-size:16px;
          font-weight:600;
          cursor:pointer;
        ">
          閉じる
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  // ========== 次のプランを提案 ==========
  const getNextPlan = (currentPlan) => {
    const upgradePath = {
      'trainee_lite': 'trainee_standard',
      'trainee_standard': 'ssw_standard',
      'ssw_standard': 'ssw_professional',
      'ssw_professional': null
    };
    
    const nextPlanKey = upgradePath[currentPlan];
    return nextPlanKey ? PLAN_LIMITS[nextPlanKey] : null;
  };

  // ========== 使用前のチェック ==========
  const canUse = (showModal = true) => {
    const status = checkDailyLimit();
    
    if (!status.allowed && showModal) {
      showUpgradeModal(status.used, status.limit, getCurrentPlan());
    }
    
    return status.allowed;
  };

  // ========== 使用を記録 ==========
  const recordUsage = () => {
    const count = incrementUsage();
    updateUsageDisplay();
    return count;
  };

  // ========== シナリオアクセス制限 ==========
  const canAccessScenario = (scenarioId) => {
    const currentPlan = getCurrentPlan();
    const config = getPlanConfig(currentPlan);
    
    // プランごとのシナリオ制限
    const scenarioAccess = {
      trainee_lite: ['greeting', 'meal_basic', 'bath_basic'],
      trainee_standard: ['greeting', 'meal', 'bath', 'toilet', 'night'],
      ssw_standard: ['greeting', 'meal', 'bath', 'toilet', 'night', 'family_consultation', 'team_coordination', 'incident_reporting'],
      ssw_professional: ['all'] // 全てアクセス可能
    };
    
    const allowed = scenarioAccess[currentPlan] || ['greeting'];
    
    // 'all'の場合は全てアクセス可能
    if (allowed.includes('all')) return true;
    
    return allowed.includes(scenarioId);
  };

  // ========== 例文保存制限 ==========
  const canSaveExample = () => {
    const currentPlan = getCurrentPlan();
    const config = getPlanConfig(currentPlan);
    
    if (!config.save_examples) return { allowed: false, reason: 'このプランでは例文保存はご利用いただけません' };
    
    const saved = storage.get('saved_examples', []);
    
    if (config.save_limit >= 999999) return { allowed: true, used: saved.length, limit: Infinity };
    
    if (saved.length >= config.save_limit) {
      return {
        allowed: false,
        reason: `例文保存の上限（${config.save_limit}件）に達しました`,
        used: saved.length,
        limit: config.save_limit
      };
    }
    
    return { allowed: true, used: saved.length, limit: config.save_limit };
  };

  // ========== 初期化 ==========
  const init = () => {
    // ページ読み込み時に使用状況を表示
    updateUsageDisplay();
    
    // プラン情報を表示（オプション）
    const planInfoElement = document.getElementById('planInfo');
    if (planInfoElement) {
      const config = getPlanConfig();
      planInfoElement.textContent = `現在のプラン: ${config.name}`;
    }
  };

  // ========== 公開API ==========
  return {
    getCurrentPlan,
    setCurrentPlan,
    getPlanConfig,
    checkDailyLimit,
    incrementUsage,
    updateUsageDisplay,
    showUpgradeModal,
    canUse,
    recordUsage,
    canAccessScenario,
    canSaveExample,
    init,
    PLAN_LIMITS
  };
})();

// ページ読み込み時に初期化
if (typeof window !== 'undefined') {
  window.PlanManager = PlanManager;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PlanManager.init());
  } else {
    PlanManager.init();
  }
}


  async function openCustomerPortal() {
    try {
      const subscriptionId = localStorage.getItem('subscription_id');
      if (!subscriptionId) {
        alert('サブスクリプション情報が見つかりません。購入後に再読み込みしてください。');
        return;
      }
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: subscriptionId })
      });
      const data = await res.json();
      if (!data || !data.url) throw new Error(data?.error || 'portal url missing');
      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      alert('カスタマーポータルを開けませんでした。お手数ですが、管理者へお問い合わせください。');
    }
  }
