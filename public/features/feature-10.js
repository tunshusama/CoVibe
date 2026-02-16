// Feature 10: 1.界面的“生成”按钮太小了，和输入框高度不匹配
2.界面有个“未知模块”，删掉
// Generated with Kimi Code API at 2026-02-16T12:35:05.028Z
(function() {
  const moduleType = 'custom-10';
  
  function createCard(data) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText = "border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);";
    
    const contentDiv = document.createElement("div");
    contentDiv.style.cssText = "margin-bottom: 8px; font-size: 14px; color: #333;";
    
    const safeContent = window.escapeHTML ? window.escapeHTML(data.content || "") : (data.content || "");
    contentDiv.textContent = safeContent;
    
    const timestamp = document.createElement("small");
    timestamp.style.cssText = "color: #666; font-size: 12px; display: block; margin-top: 8px;";
    timestamp.textContent = new Date().toLocaleString();
    
    card.appendChild(contentDiv);
    card.appendChild(timestamp);
    
    return card;
  }
  
  if (window.registerFeature) {
    window.registerFeature('custom-10', createCard);
  }
  
  function init() {
    if (document.getElementById("custom-10-app")) return;
    
    const app = document.createElement("div");
    app.id = "custom-10-app";
    app.style.cssText = "max-width: 600px; margin: 20px auto; padding: 20px; font-family: Arial, sans-serif;";
    
    const controlPanel = document.createElement("div");
    controlPanel.style.cssText = "display: flex; gap: 12px; margin-bottom: 20px; align-items: stretch;";
    
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "请输入内容...";
    input.style.cssText = "flex: 1; padding: 14px; font-size: 16px; border: 2px solid #e0e0e0; border-radius: 6px; outline: none; box-sizing: border-box;";
    
    const generateBtn = document.createElement("button");
    generateBtn.textContent = "生成";
    generateBtn.style.cssText = "padding: 14px 28px; font-size: 16px; font-weight: bold; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; min-height: 48px; box-sizing: border-box;";
    
    const cardList = document.createElement("div");
    cardList.id = "custom-10-cards";
    cardList.style.cssText = "display: flex; flex-direction: column; gap: 12px;";
    
    generateBtn.addEventListener("click", function() {
      const value = input.value.trim();
      if (value) {
        const card = createCard({ content: value });
        cardList.insertBefore(card, cardList.firstChild);
        input.value = "";
      }
    });
    
    input.addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        generateBtn.click();
      }
    });
    
    controlPanel.appendChild(input);
    controlPanel.appendChild(generateBtn);
    app.appendChild(controlPanel);
    app.appendChild(cardList);
    
    if (document.body) {
      document.body.appendChild(app);
    } else {
      window.addEventListener("load", function() {
        document.body.appendChild(app);
      });
    }
  }
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
