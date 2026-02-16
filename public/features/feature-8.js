// Feature 8: 对于每个首次进入该网站的用户，都会出现一个选择昵称的弹窗。昵称生成规则：随机按照”形容词+水果/蔬菜/动物名“的格式生成，用户可选择重新生成，确定后不可修改，之后用户每次进入网站都绑定昵称。
// Generated with Kimi Code API at 2026-02-16T11:15:56.916Z
(function() {
  const moduleType = 'custom-8';
  
  const adjectives = ["快乐的", "聪明的", "勇敢的", "温柔的", "可爱的", "神秘的", "调皮的", "优雅的", "幸运的", "酷酷的"];
  const fruits = ["苹果", "香蕉", "橙子", "葡萄", "西瓜", "草莓", "樱桃", "柠檬", "桃子", "梨子"];
  const vegetables = ["胡萝卜", "番茄", "黄瓜", "土豆", "洋葱", "白菜", "菠菜", "茄子", "辣椒", "南瓜"];
  const animals = ["猫咪", "狗狗", "兔子", "熊猫", "老虎", "狮子", "大象", "猴子", "狐狸", "小熊"];
  
  function generateNickname() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const useAnimal = Math.random() > 0.5;
    let noun;
    if (useAnimal) {
      noun = animals[Math.floor(Math.random() * animals.length)];
    } else {
      const combined = fruits.concat(vegetables);
      noun = combined[Math.floor(Math.random() * combined.length)];
    }
    return adj + noun;
  }
  
  function createCard() {
    const card = document.createElement("div");
    card.className = "card";
    
    const timestamp = document.createElement("small");
    timestamp.textContent = new Date().toLocaleString();
    card.appendChild(timestamp);
    
    const container = document.createElement("div");
    container.style.marginTop = "8px";
    
    const savedNickname = localStorage.getItem("userNickname");
    
    if (savedNickname) {
      const greeting = document.createElement("div");
      greeting.innerHTML = "欢迎回来，" + window.escapeHTML(savedNickname) + "！";
      container.appendChild(greeting);
    } else {
      let currentNickname = generateNickname();
      
      const title = document.createElement("div");
      title.textContent = "首次访问，请设置你的昵称：";
      title.style.marginBottom = "8px";
      container.appendChild(title);
      
      const nameDisplay = document.createElement("div");
      nameDisplay.style.fontWeight = "bold";
      nameDisplay.style.marginBottom = "12px";
      nameDisplay.innerHTML = window.escapeHTML(currentNickname);
      container.appendChild(nameDisplay);
      
      const btnWrap = document.createElement("div");
      
      const refreshBtn = document.createElement("button");
      refreshBtn.textContent = "重新生成";
      refreshBtn.style.marginRight = "8px";
      refreshBtn.onclick = function() {
        currentNickname = generateNickname();
        nameDisplay.innerHTML =

if (typeof window.registerFeature === 'function') {
  window.registerFeature('custom-8', createCard);
}

