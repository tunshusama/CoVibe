// Feature 11: 在页面里新增一个表格
第一列用户昵称
第二列任务描述
第三列任务进程（评审中/生成中/已上线/未通过评审）
// Generated with Kimi Code API at 2026-02-16T12:41:22.223Z
(function() {
  const moduleType = 'custom-11';
  
  function createCard() {
    const card = document.createElement('div');
    card.className = 'card';
    
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontFamily = 'Arial, sans-serif';
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const columns = ['用户昵称', '任务描述', '任务进程'];
    columns.forEach(col => {
      const th = document.createElement('th');
      th.innerHTML = window.escapeHTML(col);
      th.style.border = '1px solid #ddd';
      th.style.padding = '12px';
      th.style.backgroundColor = '#f5f5f5';
      th.style.textAlign = 'left';
      th.style.fontWeight = 'bold';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    const sampleData = [
      { user: 'Alice_Wong', desc: '前端性能优化方案', status: '评审中' },
      { user: 'Bob_Chen', desc: '用户画像算法v2.0', status: '生成中' },
      { user: 'Charlie_Li', desc: '支付网关对接', status: '已上线' },
      { user: 'David_Zhang', desc: '数据可视化大屏', status: '未通过评审' }
    ];
    
    sampleData.forEach(item => {
      const row = document.createElement('tr');
      
      const userTd = document.createElement('td');
      userTd.innerHTML = window.escapeHTML(item.user);
      userTd.style.border = '1px solid #ddd';
      userTd.style.padding = '10px';
      
      const descTd = document.createElement('td');
      descTd.innerHTML = window.escapeHTML(item.desc);
      descTd.style.border = '1px solid #ddd';
      descTd.style.padding = '10px';
      
      const statusTd = document.createElement('td');
      statusTd.innerHTML = window.escapeHTML(item.status);
      statusTd.style.border = '1px solid #ddd';
      statusTd.style.padding = '10px';
      statusTd.style.fontWeight = 'bold';
      
      if (item.status === '已上线') {
        statusTd.style.color = '#52c41a';
      } else if (item.status === '未通过评审') {
        statusTd.style.color = '#ff4d4f';
      } else if (item.status === '生成中') {
        statusTd.style.color = '#faad14';
      } else {
        statusTd.style.color = '#1890ff';
      }
      
      row.appendChild(userTd);
      row.appendChild(descTd);
      row.appendChild(statusTd);
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    card.appendChild(table);
    
    const timestamp = document.createElement('small');
    timestamp.textContent = '更新时间: ' + new Date().toLocaleString('zh-CN');
    timestamp.style.display = 'block';
    timestamp.style.marginTop = '12px';
    timestamp.style.color = '#888';
    timestamp.style.fontSize = '12px';
    card.appendChild(timestamp);
    
    return card;
  }
  
  window.registerFeature('custom-11', createCard);
})();
