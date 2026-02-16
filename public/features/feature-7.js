// Feature 7: 我要给每个访问该网站的用户赋予一个昵称，格式“形容词+水果/蔬菜/动物名”。用户可以刷新，确认后就将该昵称与该用户绑定，不可更改
// Generated with Kimi Code API at 2026-02-16T08:10:01.746Z
(function() {
  const moduleType = 'custom-7';
  
  function generateNickname() {
    const adjectives = ["快乐的", "聪明的", "勇敢的", "温柔的", "调皮的", "神秘的", "活泼的", "安静的", "可爱的", "帅气的"];
    const fruits = ["苹果", "香蕉", "橙子", "草莓", "西瓜", "葡萄", "樱桃", "柠檬", "桃子", "梨子"];
    const vegetables = ["胡萝卜", "番茄", "黄瓜", "土豆", "白菜", "茄子", "辣椒", "南瓜", "洋葱", "菠菜"];
    const animals = ["熊猫", "老虎", "兔子", "猫咪", "狗狗", "大象", "长颈鹿", "狮子", "企鹅", "考拉"];
    
    const allNouns = [...fruits, ...vegetables, ...animals];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = allNouns[Math.floor(Math.random() * allNouns.length)];
    return adj + noun;
  }
  
  function createCard() {
    const card = document.createElement("div");
    card.className = "card";
    
    const title = document.createElement("h3");
    title.textContent = "用户昵称设置";
    card.appendChild(title);
    
    const nicknameDisplay = document.createElement("div");
    nicknameDisplay.className = "nickname-display";
    nicknameDisplay.style.fontSize = "1.5em";
    nicknameDisplay.style.margin = "20px 0";
    nicknameDisplay.style.fontWeight = "bold";
    nicknameDisplay.style.color = "#333";
    
    const buttonContainer = document.createElement("div");
    buttonContainer.style.marginTop = "15px";
    
    const timestamp = document.createElement("small");
    timestamp.style.display = "block";
    timestamp.style.marginTop = "15px";
    timestamp.style.color = "#666";
    timestamp.textContent = new Date().toLocaleString();
    
    const storageKey = "confirmedNickname";
    const savedNickname = localStorage.getItem(storageKey);
    
    if (savedNickname) {
      nicknameDisplay.textContent = window.escapeHTML ? window.escapeHTML(savedNickname) : savedNickname;
      
      const status = document.createElement("p");
      status.style.color = "#28a745";
      status.textContent = "昵称已确认，无法更改";
      card.appendChild(nicknameDisplay);
      card.appendChild(status);
    } else {
      let currentNickname = generateNickname();
      nicknameDisplay.textContent = window.escapeHTML ? window.escapeHTML(currentNickname) : currentNickname;
      
      const refreshBtn = document.createElement("button");
      refreshBtn.textContent = window.escapeHTML ? window.escapeHTML("刷新昵称") : "刷新昵称";
      refreshBtn.style.marginRight = "10px";
      refreshBtn.style.padding = "8px 16px";
      refreshBtn.style.cursor = "pointer";
      refreshBtn.style.backgroundColor = "#6c757d";
      refreshBtn.style.color = "white";
      refreshBtn.style.border = "none";
      refreshBtn.style.borderRadius = "4px";
      
      const confirmBtn = document.createElement("button");
      confirmBtn.textContent = window.escapeHTML ? window.escapeHTML("确认昵称") : "确认昵称";
      confirmBtn.style.padding = "8px 16px";
      confirmBtn.style.cursor = "pointer";
      confirmBtn.style.backgroundColor = "#007bff";
      confirmBtn.style.color = "white";
      confirmBtn.style.border = "none";
      confirmBtn.style.borderRadius = "4px";
      
      refreshBtn.addEventListener("click", function() {
        currentNickname = generateNickname();
        nicknameDisplay.textContent = window.escapeHTML ? window.escapeHTML(currentNickname) : currentNickname;
      });
      
      confirmBtn.addEventListener("click", function() {
        localStorage.setItem(storageKey, currentNickname);
        refreshBtn.style.display = "none";
        confirmBtn.style.display = "none";
        
        const status = document.createElement("p");
        status.style.color = "#28a745";
        status.textContent = "昵称已确认，无法更改";
        buttonContainer.appendChild(status);
      });
      
      buttonContainer.appendChild(refreshBtn);
      buttonContainer.appendChild(confirmBtn);
      card.appendChild(nicknameDisplay);
      card.appendChild(buttonContainer);
    }
    
    card.appendChild(timestamp);
    return card;
  }
  
  if (typeof window.registerFeature === "function") {
    window.registerFeature('custom-7', createCard);
  }
})();
