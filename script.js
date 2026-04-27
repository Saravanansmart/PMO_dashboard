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


    const STATUS_FLOW = ['backlog', 'todo', 'in-progress', 'in-qe', 'on-hold', 'live'];
    const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

    function normalizeStatus(status) {
        const normalized = (status || '').toString().trim().toLowerCase();
        return STATUS_FLOW.includes(normalized) ? normalized : 'backlog';
    }

    function normalizeTask(task) {
        const normalizedTask = { ...task };
        normalizedTask.status = normalizeStatus(task.status);
        normalizedTask.priority = task.priority || 'Medium';
        normalizedTask.title = (task.title || '').trim();
        normalizedTask.stakeholder = (task.stakeholder || '').trim();
        normalizedTask.assignee = (task.assignee || '').trim();
        normalizedTask.sprint = (task.sprint || '').toString().trim();
        return normalizedTask;
    }

    function compareTasksForFlow(a, b) {
        const priorityA = PRIORITY_RANK[(a.priority || '').toLowerCase()] ?? 99;
        const priorityB = PRIORITY_RANK[(b.priority || '').toLowerCase()] ?? 99;
        if (priorityA !== priorityB) return priorityA - priorityB;

        if (a.eta && b.eta) return a.eta.localeCompare(b.eta);
        if (a.eta) return -1;
        if (b.eta) return 1;

        return a.title.localeCompare(b.title);
    }

    function isValidTransition(fromStatus, toStatus) {
        if (fromStatus === toStatus) return true;

        const fromIndex = STATUS_FLOW.indexOf(fromStatus);
        const toIndex = STATUS_FLOW.indexOf(toStatus);
        if (fromIndex === -1 || toIndex === -1) return false;

        // Allow any backward move, but only one-step forward move to keep the board flow predictable.
        return toIndex <= fromIndex || toIndex === fromIndex + 1;
    }

    tasks = tasks.map(normalizeTask).filter(task => task.title);

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
    const ghOwnerInput = document.getElementById('gh-owner');
    const ghRepoInput = document.getElementById('gh-repo');
    const ghTokenInput = document.getElementById('gh-token');
    const pullGithubBtn = document.getElementById('pull-github-btn');
    
    // Load existing settings
    const ghSettings = JSON.parse(localStorage.getItem('gh-settings') || '{}');
    if (ghSettings.owner) ghOwnerInput.value = ghSettings.owner;
    if (ghSettings.repo) ghRepoInput.value = ghSettings.repo;
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

        filteredTasks.sort(compareTasksForFlow);

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
            status: normalizeStatus(statusInput.value),
            type: typeInput.value,
            sprint: sprintInput.value.trim()
        };

        const normalizedTaskData = normalizeTask(taskData);

        if (idInput.value) {
            // Update
            const index = tasks.findIndex(t => t.id === normalizedTaskData.id);
            if (index !== -1) {
                // Check if editing causes a duplicate
                const isDuplicate = tasks.some(t => t.id !== normalizedTaskData.id && t.title.toLowerCase().trim() === normalizedTaskData.title.toLowerCase());
                if (isDuplicate) {
                    alert('A task with this title already exists!');
                    return;
                }
                tasks[index] = normalizedTaskData;
            }
        } else {
            // Add
            // Prevent adding a new duplicate
            const isDuplicate = tasks.some(t => t.title.toLowerCase().trim() === normalizedTaskData.title.toLowerCase());
            if (isDuplicate) {
                alert('A task with this title already exists!');
                return;
            }
            tasks.push(normalizedTaskData);
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
                const currentStatus = normalizeStatus(tasks[taskIndex].status);
                if (!isValidTransition(currentStatus, newStatus)) {
                    alert('Move blocked: advance tasks one stage at a time (or move backward when needed).');
                    return;
                }

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
        const payload = {
            exportedAt: new Date().toISOString(),
            version: 1,
            tasks
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `pmo_dashboard_tasks_${new Date().toISOString().slice(0, 10)}.json`);
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
                const importedPayload = JSON.parse(event.target.result);
                const importedTasks = Array.isArray(importedPayload)
                    ? importedPayload
                    : (Array.isArray(importedPayload.tasks) ? importedPayload.tasks : null);
                if (!importedTasks) {
                    throw new Error("Invalid format");
                }

                const cleanImportedTasks = importedTasks.map(normalizeTask).filter(task => task.title);

                if (confirm('Import successful! Do you want to wipe your current board clear before loading these tasks? (Click Cancel to merge)')) {
                    tasks = cleanImportedTasks;
                } else {
                    const seenKeys = new Set();
                    const merged = [];
                    [...tasks, ...cleanImportedTasks].forEach(t => {
                        const key = t.githubIssueId ? `gh-${t.githubIssueId}` : t.title.toLowerCase().trim();
                        if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            merged.push(normalizeTask(t));
                        }
                    });
                    tasks = merged;
                }
                
                saveAndRender();
                alert(`Successfully loaded ${cleanImportedTasks.length} tasks!`);
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
            owner: ghOwnerInput.value.trim(),
            repo: ghRepoInput.value.trim(),
            token: ghTokenInput.value.trim()
        };
        localStorage.setItem('gh-settings', JSON.stringify(settings));
        return settings;
    }

    function mapIssueStateToStatus(issue) {
        if (issue.state === 'closed') return 'live';

        const labels = (issue.labels || []).map(label => (label.name || '').toLowerCase());
        if (labels.some(label => label.includes('in progress') || label.includes('in-progress'))) return 'in-progress';
        if (labels.some(label => label.includes('todo') || label.includes('to do'))) return 'todo';
        if (labels.some(label => label.includes('qe') || label.includes('qa') || label.includes('testing'))) return 'in-qe';
        if (labels.some(label => label.includes('hold') || label.includes('blocked'))) return 'on-hold';
        if (labels.some(label => label.includes('done') || label.includes('live'))) return 'live';

        return 'backlog';
    }

    function mapIssuePriority(issue) {
        const labels = (issue.labels || []).map(label => (label.name || '').toLowerCase());
        if (labels.some(label => label.includes('high') || label.includes('p0') || label.includes('p1'))) return 'High';
        if (labels.some(label => label.includes('low') || label.includes('p3') || label.includes('p4'))) return 'Low';
        return 'Medium';
    }

    async function fetchFromGitHub() {
        const settings = saveGithubSettings();
        if (!settings.owner || !settings.repo || !settings.token) {
            alert('Please fill Repository Owner, Repository Name, and Token before syncing.');
            return;
        }

        pullGithubBtn.textContent = 'Syncing...';
        pullGithubBtn.disabled = true;

        try {
            const res = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}/issues?state=all&per_page=100`, {
                headers: {
                    'Authorization': `Bearer ${settings.token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `GitHub API returned ${res.status}`);
            }

            const issues = await res.json();
            const issueItems = issues.filter(issue => !issue.pull_request);
            let addedCount = 0;
            let updatedCount = 0;

            issueItems.forEach(issue => {
                const issueTitle = (issue.title || '').trim();
                if (!issueTitle) return;

                const assignee = issue.assignee?.login || '';
                const statusVal = normalizeStatus(mapIssueStateToStatus(issue));
                const priorityVal = mapIssuePriority(issue);

                const existingIndex = tasks.findIndex(t =>
                    t.githubIssueId === issue.id ||
                    t.title.toLowerCase().trim() === issueTitle.toLowerCase()
                );
                if (existingIndex >= 0) {
                    tasks[existingIndex] = normalizeTask({
                        ...tasks[existingIndex],
                        title: issueTitle,
                        stakeholder: tasks[existingIndex].stakeholder || 'GitHub Issues',
                        assignee: assignee || tasks[existingIndex].assignee,
                        priority: priorityVal,
                        status: statusVal,
                        type: 'GitHub Issue',
                        githubIssueId: issue.id,
                        githubIssueNumber: issue.number,
                        githubIssueUrl: issue.html_url
                    });
                    updatedCount++;
                } else {
                    tasks.push(normalizeTask({
                        id: `gh-${issue.id}`,
                        title: issueTitle,
                        stakeholder: 'GitHub Issues',
                        assignee: assignee,
                        priority: priorityVal,
                        datePlanned: '',
                        eta: '',
                        status: statusVal,
                        type: 'GitHub Issue',
                        sprint: '',
                        githubIssueId: issue.id,
                        githubIssueNumber: issue.number,
                        githubIssueUrl: issue.html_url
                    }));
                    addedCount++;
                }
            });
            
            saveAndRender();
            alert(`Sync complete! Processed ${issueItems.length} issues, added ${addedCount}, updated ${updatedCount}.`);
            githubModal.classList.remove('active');
        } catch (e) {
            alert("Error syncing with GitHub Issues: " + e.message);
            console.error(e);
        } finally {
            pullGithubBtn.textContent = 'Manual Sync';
            pullGithubBtn.disabled = false;
        }
    }
});
