document.addEventListener('DOMContentLoaded', () => {
    // Initial data or load from localStorage
    let tasks = JSON.parse(localStorage.getItem('pmo-tasks')) || [];

    // Automatically remove duplicates based on title if any exist from before
    const uniqueTasks = [];
    const titlesSeen = new Set();
    tasks.forEach(t => {
        const titleLower = t.title.toLowerCase().trim();
        if (!titlesSeen.has(titleLower)) {
            titlesSeen.add(titleLower);
            uniqueTasks.push(t);
        }
    });
    if (uniqueTasks.length !== tasks.length) {
        tasks = uniqueTasks;
        localStorage.setItem('pmo-tasks', JSON.stringify(tasks));
    }

    // DOM Elements
    const addTaskBtn = document.getElementById('add-task-btn');
    const modalOverlay = document.getElementById('task-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const taskForm = document.getElementById('task-form');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const modalTitle = document.getElementById('modal-title');

    // Form inputs
    const idInput = document.getElementById('task-id');
    const titleInput = document.getElementById('task-title');
    const stakeholderInput = document.getElementById('task-stakeholder');
    const assigneeInput = document.getElementById('task-assignee');
    const priorityInput = document.getElementById('task-priority');
    const datePlannedInput = document.getElementById('task-date-planned');
    const etaInput = document.getElementById('task-eta');
    const statusInput = document.getElementById('task-status');
    const typeInput = document.getElementById('task-type');
    const sprintInput = document.getElementById('task-sprint');
    
    // Filter Elements
    const filterAssignee = document.getElementById('filter-assignee');
    const filterDate = document.getElementById('filter-date');
    const filterSprint = document.getElementById('filter-sprint');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // Import/Export Elements
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    // GitHub Settings Elements
    const githubSettingsBtn = document.getElementById('github-settings-btn');
    const githubModal = document.getElementById('github-modal');
    const closeGithubModalBtn = document.getElementById('close-github-modal-btn');
    const githubForm = document.getElementById('github-form');
    const ghOrgInput = document.getElementById('gh-org');
    const ghProjectNumInput = document.getElementById('gh-project-num');
    const ghTokenInput = document.getElementById('gh-token');
    const pullGithubBtn = document.getElementById('pull-github-btn');
    
    // Load existing settings
    const ghSettings = JSON.parse(localStorage.getItem('gh-settings') || '{}');
    if (ghSettings.org) ghOrgInput.value = ghSettings.org;
    if (ghSettings.projectNum) ghProjectNumInput.value = ghSettings.projectNum;
    if (ghSettings.token) ghTokenInput.value = ghSettings.token;

    // Init Board
    renderBoard();

    // Event Listeners
    addTaskBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    taskForm.addEventListener('submit', saveTask);
    deleteTaskBtn.addEventListener('click', deleteTask);

    // Import/Export Event Listeners
    exportBtn.addEventListener('click', exportTasks);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importTasks);

    // Filters Event Listeners
    filterAssignee.addEventListener('input', renderBoard);
    filterDate.addEventListener('input', renderBoard);
    filterSprint.addEventListener('input', renderBoard);
    clearFiltersBtn.addEventListener('click', () => {
        filterAssignee.value = '';
        filterDate.value = '';
        filterSprint.value = '';
        renderBoard();
    });

    // GitHub Event Listeners
    githubSettingsBtn.addEventListener('click', () => { githubModal.classList.add('active'); });
    closeGithubModalBtn.addEventListener('click', () => { githubModal.classList.remove('active'); });
    githubForm.addEventListener('submit', (e) => {
        e.preventDefault();
        fetchFromGitHub();
    });
    pullGithubBtn.addEventListener('click', () => {
        fetchFromGitHub();
    });

    // Close modal on outside click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    
    // Close GH modal on outside click
    githubModal.addEventListener('click', (e) => {
        if (e.target === githubModal) githubModal.classList.remove('active');
    });

    function renderBoard() {
        // Clear all columns
        document.querySelectorAll('.kanban-cards').forEach(container => {
            container.innerHTML = '';
        });

        const counts = {
            'backlog': 0,
            'todo': 0,
            'in-progress': 0,
            'in-qe': 0,
            'on-hold': 0,
            'live': 0
        };

        const fAssignee = filterAssignee.value.toLowerCase().trim();
        const fDate = filterDate.value;
        const fSprint = filterSprint.value.toLowerCase().trim();

        const filteredTasks = tasks.filter(t => {
            if (fAssignee && (!t.assignee || !t.assignee.toLowerCase().includes(fAssignee))) return false;
            if (fDate && t.eta !== fDate) return false;
            // Support partial or exact match for Sprint numbers string
            if (fSprint && (!t.sprint || !t.sprint.toLowerCase().includes(fSprint))) return false;
            return true;
        });

        filteredTasks.forEach(task => {
            const card = createTaskCard(task);
            const column = document.querySelector(`#col-${task.status} .kanban-cards`);
            if (column) {
                column.appendChild(card);
                counts[task.status]++;
            }
        });

        // Update counts
        for (const [status, count] of Object.entries(counts)) {
            const countEl = document.querySelector(`#col-${status} .task-count`);
            if (countEl) countEl.textContent = count;
        }
    }

    function createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.draggable = true;
        card.id = `task-${task.id}`;
        
        // Setup Drag events
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', task.id);
            setTimeout(() => card.style.opacity = '0.5', 0);
        });
        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
        });

        // Card Click opens edit
        card.addEventListener('click', () => openModal(task));

        const getInitials = (name) => {
            if (!name) return '?';
            return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        };

        const formatDate = (dateString) => {
            if (!dateString) return '--';
            // Parse date assuming it's in YYYY-MM-DD format
            const [year, month, day] = dateString.split('-');
            if (!year || !month || !day) return '--';
            const options = { month: 'short', day: 'numeric' };
            const date = new Date(year, month - 1, day);
            return date.toLocaleDateString(undefined, options);
        };

        card.innerHTML = `
            <div class="card-title">${task.title}</div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                <span class="priority-badge ${task.priority ? task.priority.toLowerCase() : 'medium'}">${task.priority || 'Medium'}</span>
                <span class="type-badge">${task.type || 'New feature'}</span>
                ${task.sprint ? `<span class="type-badge" style="background-color: #3b82f6; color: white;">Sprint ${task.sprint}</span>` : ''}
            </div>
            <div class="card-stakeholder">From: ${task.stakeholder || 'Unknown'}</div>
            <div class="card-footer">
                <div class="card-footer-top" style="justify-content: flex-end;">
                    <div class="card-assignee" title="${task.assignee || 'Unassigned'}">
                        ${task.assignee ? `<div class="card-assignee-avatar">${getInitials(task.assignee)}</div><span>${task.assignee}</span>` : 'Unassigned'}
                    </div>
                </div>
                <div class="card-dates">
                    <span title="Planned to Dev: ${formatDate(task.datePlanned)}">Plan: ${formatDate(task.datePlanned)}</span>
                    <span title="ETA: ${formatDate(task.eta)}">ETA: ${formatDate(task.eta)}</span>
                </div>
            </div>
        `;

        return card;
    }

    function openModal(task = null) {
        if (task) {
            modalTitle.textContent = 'Edit Task';
            idInput.value = task.id;
            titleInput.value = task.title;
            stakeholderInput.value = task.stakeholder || '';
            assigneeInput.value = task.assignee || '';
            priorityInput.value = task.priority || 'Medium';
            datePlannedInput.value = task.datePlanned || '';
            etaInput.value = task.eta || '';
            statusInput.value = task.status;
            typeInput.value = task.type || 'New feature';
            sprintInput.value = task.sprint || '';
            deleteTaskBtn.classList.remove('hidden');
        } else {
            modalTitle.textContent = 'Add New Task';
            taskForm.reset();
            idInput.value = '';
            statusInput.value = 'backlog';
            typeInput.value = 'New feature';
            sprintInput.value = '146';
            deleteTaskBtn.classList.add('hidden');
        }
        
        modalOverlay.classList.add('active');
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    function saveTask(e) {
        e.preventDefault();
        
        const taskData = {
            id: idInput.value || Date.now().toString(),
            title: titleInput.value.trim(),
            stakeholder: stakeholderInput.value.trim(),
            assignee: assigneeInput.value.trim(),
            priority: priorityInput.value,
            datePlanned: datePlannedInput.value,
            eta: etaInput.value,
            status: statusInput.value,
            type: typeInput.value,
            sprint: sprintInput.value.trim()
        };

        if (idInput.value) {
            // Update
            const index = tasks.findIndex(t => t.id === taskData.id);
            if (index !== -1) {
                // Check if editing causes a duplicate
                const isDuplicate = tasks.some(t => t.id !== taskData.id && t.title.toLowerCase().trim() === taskData.title.toLowerCase());
                if (isDuplicate) {
                    alert('A task with this title already exists!');
                    return;
                }
                tasks[index] = taskData;
            }
        } else {
            // Add
            // Prevent adding a new duplicate
            const isDuplicate = tasks.some(t => t.title.toLowerCase().trim() === taskData.title.toLowerCase());
            if (isDuplicate) {
                alert('A task with this title already exists!');
                return;
            }
            tasks.push(taskData);
        }

        saveAndRender();
        closeModal();
    }

    function deleteTask() {
        const id = idInput.value;
        if (id && confirm('Are you sure you want to delete this task?')) {
            tasks = tasks.filter(t => t.id !== id);
            saveAndRender();
            closeModal();
        }
    }

    function saveAndRender() {
        localStorage.setItem('pmo-tasks', JSON.stringify(tasks));
        renderBoard();
    }

    // Drag and Drop Global Functions
    window.allowDrop = function(ev) {
        ev.preventDefault();
        ev.currentTarget.classList.add('drag-over');
    }

    window.drop = function(ev) {
        ev.preventDefault();
        
        document.querySelectorAll('.kanban-cards').forEach(el => {
            el.classList.remove('drag-over');
        });

        const id = ev.dataTransfer.getData("text/plain");
        const column = ev.currentTarget.closest('.kanban-column');
        if (column && id) {
            const newStatus = column.getAttribute('data-status');
            
            const taskIndex = tasks.findIndex(t => t.id === id);
            if (taskIndex !== -1 && tasks[taskIndex].status !== newStatus) {
                tasks[taskIndex].status = newStatus;
                saveAndRender();
            }
        }
    };
    
    document.querySelectorAll('.kanban-cards').forEach(cardContainer => {
        cardContainer.addEventListener('dragleave', (e) => {
            e.currentTarget.classList.remove('drag-over');
        });
    });

    // --- IMPORT/EXPORT LOGIC ---
    function exportTasks() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "pmo_dashboard_tasks.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    function importTasks(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedTasks = JSON.parse(event.target.result);
                if (!Array.isArray(importedTasks)) {
                    throw new Error("Invalid format");
                }
                
                if (confirm('Import successful! Do you want to wipe your current board clear before loading these tasks? (Click Cancel to just merge them together)')) {
                    tasks = importedTasks;
                } else {
                    // Merge and deduplicate by title
                    const seenTitles = new Set();
                    const merged = [];
                    [...tasks, ...importedTasks].forEach(t => {
                        const lower = t.title.toLowerCase().trim();
                        if (!seenTitles.has(lower)) {
                            seenTitles.add(lower);
                            merged.push(t);
                        }
                    });
                    tasks = merged;
                }
                
                saveAndRender();
                alert(`Successfully loaded ${importedTasks.length} tasks!`);
            } catch (err) {
                alert("Error importing file! Make sure it is a valid PMO JSON backup.");
            }
            importFile.value = ''; // Reset file input so you can re-import same file if needed
        };
        reader.readAsText(file);
    }

    // --- GITHUB SYNC LOGIC ---

    function saveGithubSettings() {
        const settings = {
            org: ghOrgInput.value.trim(),
            projectNum: parseInt(ghProjectNumInput.value),
            token: ghTokenInput.value.trim()
        };
        localStorage.setItem('gh-settings', JSON.stringify(settings));
        return settings;
    }

    async function fetchFromGitHub() {
        const settings = saveGithubSettings();
        if (!settings.org || !settings.projectNum || !settings.token) return;
        
        pullGithubBtn.textContent = 'Syncing...';
        
        const query = `
        query($org: String!, $num: Int!) {
          organization(login: $org) {
            projectV2(number: $num) {
              items(first: 100) {
                nodes {
                  id
                  fieldValues(first: 20) {
                    nodes {
                      __typename
                      ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
                      ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
                    }
                  }
                  content { ... on Issue { title assignees(first: 1) { nodes { login } } } }
                }
              }
            }
          }
        }`;

        try {
            const res = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { org: settings.org, num: settings.projectNum } })
            });
            const data = await res.json();
            
            if (data.errors) {
                alert("GitHub API Error: " + data.errors[0].message);
                pullGithubBtn.textContent = 'Manual Sync';
                return;
            }
            
            const projectItems = data.data.organization.projectV2.items.nodes;
            let addedCount = 0;
            
            projectItems.forEach(item => {
                if (!item.content || !item.content.title) return;
                
                let issueTitle = item.content.title;
                let assignee = (item.content.assignees && item.content.assignees.nodes.length > 0) ? item.content.assignees.nodes[0].login : '';
                
                let fields = item.fieldValues.nodes;
                // Defaults
                let statusVal = 'backlog';
                let priorityVal = 'Medium';
                
                // Read custom fields from V2 Project
                fields.forEach(f => {
                    const fieldName = f.field?.name?.toLowerCase() || '';
                    if (fieldName === 'status') {
                        let text = (f.name || '').toLowerCase();
                        if (text.includes('todo') || text.includes('to do')) statusVal = 'todo';
                        else if (text.includes('progress')) statusVal = 'in-progress';
                        else if (text.includes('qe') || text.includes('qa')) statusVal = 'in-qe';
                        else if (text.includes('live') || text.includes('done') || text.includes('completed')) statusVal = 'live';
                        else if (text.includes('hold')) statusVal = 'on-hold';
                    }
                    if (fieldName === 'priority') {
                        if (f.name) priorityVal = f.name;
                    }
                });
                
                // Detect if task already exists on board by matching title
                const existingIndex = tasks.findIndex(t => t.title.toLowerCase().trim() === issueTitle.toLowerCase().trim());
                if (existingIndex >= 0) {
                    tasks[existingIndex].status = statusVal;
                    tasks[existingIndex].priority = priorityVal;
                    tasks[existingIndex].assignee = assignee || tasks[existingIndex].assignee;
                } else {
                    tasks.push({
                        id: 'gh-' + Date.now() + Math.random(),
                        title: issueTitle,
                        stakeholder: 'GitHub Sync',
                        assignee: assignee,
                        priority: priorityVal,
                        datePlanned: '',
                        eta: '',
                        status: statusVal,
                        type: 'New feature'
                    });
                    addedCount++;
                }
            });
            
            saveAndRender();
            alert(`Sync complete! Pulled ${projectItems.length} issues and added ${addedCount} brand new tasks to the board.`);
            githubModal.classList.remove('active');
            
        } catch (e) {
            alert("Error syncing with GitHub: " + e.message);
            console.error(e);
        }
        pullGithubBtn.textContent = 'Manual Sync';
    }
});
