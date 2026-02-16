// Feature 6: 我要给每个来访的用户起一个昵称，格式是“形容词+水果/蔬菜/动物名”
// Generated with Kimi Code API at 2026-02-16T07:44:48.094Z
(function() {
  const moduleType = 'custom-6';
  
  const adjectives = ["快乐的", "忧郁的", "疯狂的", "安静的", "勇敢的", "害羞的", "聪明的", "糊涂的", "调皮的", "温柔的", "凶猛的", "可爱的", "高大的", "迷你的", "闪闪的", "酷酷的", "神秘的", "懒惰的", "勤劳的", "优雅的"];
  const fruits = ["苹果", "香蕉", "樱桃", "榴莲", "葡萄", "西瓜", "柠檬", "芒果", "橙子", "桃子", "梨子", "草莓", "蓝莓", "菠萝", "椰子", "火龙果", "猕猴桃", "石榴", "柿子", "哈密瓜"];
  const vegetables = ["胡萝卜", "土豆", "番茄", "黄瓜", "白菜", "菠菜", "茄子", "辣椒", "南瓜", "洋葱", "芹菜", "蘑菇", "玉米", "豌豆", "红薯", "芦笋", "西兰花", "卷心菜", "韭菜", "冬瓜"];
  const animals = ["猫咪", "狗狗", "兔子", "老虎", "狮子", "熊猫", "企鹅", "海豚", "长颈鹿", "大象", "猴子", "松鼠", "狐狸", "狼", "熊", "鹿", "马", "羊", "牛", "猪"];
  
  function generateNickname() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const category = Math.floor(Math.random() * 3);
    let noun;
    if (category === 0) {
      noun = fruits[Math.floor(Math.random() * fruits.length)];
    } else if (category === 1) {
      noun = vegetables[Math.floor(Math.random() * vegetables.length)];
    } else {
      noun = animals[Math.floor(Math.random() * animals.length)];
    }
    return adj + noun;
  }
  
  function createCard() {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText = "padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); background: #fff; max-width: 300px; font-family: system-ui, -apple-system, sans-serif;";
    
    const header = document.createElement("h3");
    header.textContent = "欢迎来访";
    header.style.cssText = "margin: 0 0 15px 0; color: #333; font-size: 18px;";
    card.appendChild(header);
    
    const label = document.createElement("div");
    label.textContent = "为您生成的昵称：";
    label.style.cssText = "color: #666; font-size: 14px; margin-bottom: 8px;";
    card.appendChild(label);
    
    const nicknameBox = document.createElement("div");
    nicknameBox.style.cssText = "font-size: 24px; font-weight: bold; color: #2c3e50; padding: 15px; background: #f8f9fa; border-radius: 6px; margin-bottom: 15px; text-align: center; word-break: break-all;";
    const initialNickname = generateNickname();
    nicknameBox.textContent = window.escapeHTML ? window.escapeHTML(initialNickname) : initialNickname;
    card.appendChild(nicknameBox);
    
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "换一个昵称";
    refreshBtn.style.cssText = "width: 100%; padding: 10px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-bottom: 12px;";
    refreshBtn.onmouseenter = function() { this.style.background = "#2980b9"; };
    refreshBtn.onmouseleave = function() { this.style.background = "#3498db"; };
    refreshBtn.onclick = function() {
      const newNickname = generateNickname();
      nicknameBox.textContent = window.escapeHTML ? window.escapeHTML(newNickname) : newNickname;
    };
    card.appendChild(refreshBtn);
    
    const timestamp = document.createElement("small");
    timestamp.textContent = "生成时间：" + new Date().toLocaleString("zh-CN");
    timestamp.style.cssText = "display: block; color: #999; font-size: 12px; text-align: center;";
    card.appendChild(timestamp);
    
    return card;
  }
  
  if (typeof window.registerFeature === "function") {
    window.registerFeature('custom-6', createCard);
  }
})();
