// Feature 9: 我希望网站能够有一个列表。第一列是发起用户（即发起该需求的用户昵称）第二列是需求简介（由ai）展示当前需求状态（评审中/生成中/已上线）
// Generated with Kimi Code API at 2026-02-16T12:04:01.047Z
(function() {
    const moduleType = 'custom-9';
    
    function createCard(data) {
        const card = document.createElement('div');
        card.className = 'card';
        
        const row = document.createElement('div');
        row.className = 'card-row';
        
        const colUser = document.createElement('div');
        colUser.className = 'col-user';
        colUser.textContent = window.escapeHTML(data.user || '');
        
        const colSummary = document.createElement('div');
        colSummary.className = 'col-summary';
        colSummary.textContent = window.escapeHTML(data.summary || '');
        
        const colStatus = document.createElement('div');
        colStatus.className = 'col-status';
        colStatus.textContent = window.escapeHTML(data.status || '');
        
        row.appendChild(colUser);
        row.appendChild(colSummary);
        row.appendChild(colStatus);
        
        const timestamp = document.createElement('small');
        timestamp.className = 'timestamp';
        timestamp.textContent = window.escapeHTML(data.timestamp || new Date().toLocaleString());
        
        card.appendChild(row);
        card.appendChild(timestamp);
        
        return card;
    }
    
    window.registerFeature('custom-9', createCard);
})();
