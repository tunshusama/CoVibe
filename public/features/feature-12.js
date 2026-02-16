// Feature 12: 希望网站能够有一个列表。\n第一列是发起用户（即发起该需求的用户昵称）\n第二列是需求简介（由ai简要总结）\n展示当前需求状态（评审中/生成中/已上线/已失败）
// Generated with Kimi Code API at 2026-02-16T13:56:59.930Z
(function() {
  const moduleType = 'custom-12';
  
  function escapeHtml(text) {
    if (typeof window.escapeHTML === "function") {
      return window.escapeHTML(text);
    }
    const div = document.createElement("div");
    div.textContent = String(text || "");
    return div.innerHTML;
  }
  
  function createCard(data) {
    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText = "display: flex; align-items: center; padding: 16px; border-bottom: 1px solid #e0e0e0; gap: 24px; background: #fff; font-family: system-ui, -apple-system, sans-serif;";
    
    const userCol = document.createElement("div");
    userCol.style.cssText = "flex: 0 0 120px; font-weight: 600; color: #2c3e50; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
    userCol.textContent = escapeHtml(data.user || "未知用户");
    
    const descCol = document.createElement("div");
    descCol.style.cssText = "flex: 1; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
    descCol.textContent = escapeHtml(data.description || "暂无简介");
    
    const statusCol = document.createElement("div");
    statusCol.style.cssText = "flex: 0 0 90px; text-align: center; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;";
    const status = String(data.status || "评审中");
    statusCol.textContent = escapeHtml(status);
    
    const statusMap = {
      "评审中": { bg: "#fff3cd", color: "#856404" },
      "生成中": { bg: "#cce5ff", color: "#004085" },
      "已上线": { bg: "#d4edda", color: "#155724" },
      "已失败": { bg: "#f8d7da", color: "#721c24" }
    };
    
    const style = statusMap[status] || { bg: "#e2e3e5", color: "#383d41" };
    statusCol.style.backgroundColor = style.bg;
    statusCol.style.color = style.color;
    
    const timeSmall = document.createElement("small");
    timeSmall.style.cssText = "flex: 0 0 140px; color: #999; font-size: 11px; text-align: right;";
    timeSmall.textContent = escapeHtml(data.timestamp || new Date().toLocaleString());
    
    card.appendChild(userCol);
    card.appendChild(descCol);
    card.appendChild(statusCol);
    card.appendChild(timeSmall);
    
    return card;
  }
  
  if (typeof window.registerFeature === "function") {
    window.registerFeature('custom-12', createCard);
  }
})();
