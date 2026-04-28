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
    const filterSearch = document.getElementById('filter-search');
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
    populateDropdowns();
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
    filterSearch.addEventListener('input', renderBoard);
    clearFiltersBtn.addEventListener('click', () => {
        filterAssignee.value = '';
        filterDate.value = '';
        filterSprint.value = '';
        filterSearch.value = '';
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
        const fSearch = filterSearch.value.toLowerCase().trim();

        const filteredTasks = tasks.filter(t => {
            if (fAssignee && (!t.assignee || !t.assignee.toLowerCase().includes(fAssignee))) return false;
            if (fDate && t.eta !== fDate) return false;
            // Support partial or exact match for Sprint numbers string
            if (fSprint && (!t.sprint || !t.sprint.toLowerCase().includes(fSprint))) return false;

            // Search all text fields
            if (fSearch) {
                const searchString = `${t.title} ${t.stakeholder} ${t.assignee} ${t.sprint} ${t.type}`.toLowerCase();
                if (!searchString.includes(fSearch)) return false;
            }

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

    async function saveTask(e) {
        e.preventDefault();

        const saveBtn = document.getElementById('save-task-btn');
        const origText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        let existingTask = idInput.value ? tasks.find(t => t.id === idInput.value) : null;

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
            sprint: sprintInput.value.trim(),
            ghItemId: existingTask ? existingTask.ghItemId : null,
            ghContentId: existingTask ? existingTask.ghContentId : null
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
                    saveBtn.textContent = origText;
                    saveBtn.disabled = false;
                    return;
                }
                tasks[index] = taskData;
                await syncTaskToGitHub(tasks[index]);
            }
        } else {
            // Add
            // Prevent adding a new duplicate
            const isDuplicate = tasks.some(t => t.title.toLowerCase().trim() === normalizedTaskData.title.toLowerCase());
            if (isDuplicate) {
                alert('A task with this title already exists!');
                saveBtn.textContent = origText;
                saveBtn.disabled = false;
                return;
            }
            tasks.push(taskData);
            await syncTaskToGitHub(taskData);
        }

        saveAndRender();
        closeModal();
        saveBtn.textContent = origText;
        saveBtn.disabled = false;
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
    window.allowDrop = function (ev) {
        ev.preventDefault();
        ev.currentTarget.classList.add('drag-over');
    }

    window.drop = async function (ev) {
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
                // Sync status to GitHub in the background
                syncTaskToGitHub(tasks[taskIndex]).then(() => saveAndRender());
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
        reader.onload = function (event) {
            try {
                const importedPayload = JSON.parse(event.target.result);
                const importedTasks = Array.isArray(importedPayload)
                    ? importedPayload
                    : (Array.isArray(importedPayload.tasks) ? importedPayload.tasks : null);
                if (!importedTasks) {
                    throw new Error("Invalid format");
                }

                if (confirm('Import successful! Do you want to wipe your current board clear before loading these tasks? (Click Cancel to just merge them together)')) {
                    tasks = importedTasks;
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

    async function getUserId(login, token) {
        if (!login) return null;
        let cache = JSON.parse(localStorage.getItem('gh-users') || '{}');
        if (cache[login]) return cache[login];

        const query = `query($login: String!) { user(login: $login) { id } }`;
        try {
            const res = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { login } })
            });
            const data = await res.json();
            if (data.data?.user?.id) {
                cache[login] = data.data.user.id;
                localStorage.setItem('gh-users', JSON.stringify(cache));
                return data.data.user.id;
            }
        } catch (e) { }
        return null;
    }

    async function fetchGitHubMeta(settings) {
        const query = `
        query($org: String!, $num: Int!) {
          organization(login: $org) {
            projectV2(number: $num) {
              id
              fields(first: 20) {
                nodes {
                  ... on ProjectV2FieldCommon { id name }
                  ... on ProjectV2SingleSelectField { id name options { id name } }
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
            const project = data.data?.organization?.projectV2;
            if (!project) return null;

            let meta = { id: project.id, statusFieldId: null, statusOptions: {}, fields: {} };
            project.fields.nodes.forEach(f => {
                if (f.options) {
                    meta.fields[f.name.toLowerCase()] = {
                        id: f.id,
                        name: f.name,
                        options: f.options.map(o => ({ id: o.id, name: o.name }))
                    };
                }
                if (f.name && f.name.toLowerCase() === 'status') {
                    meta.statusFieldId = f.id;
                    if (f.options) {
                        f.options.forEach(opt => {
                            let text = opt.name.toLowerCase();
                            let key = 'backlog';
                            if (text.includes('todo') || text.includes('to do')) key = 'todo';
                            else if (text.includes('progress')) key = 'in-progress';
                            else if (text.includes('qe') || text.includes('qa')) key = 'in-qe';
                            else if (text.includes('live') || text.includes('done') || text.includes('completed')) key = 'live';
                            else if (text.includes('hold')) key = 'on-hold';
                            meta.statusOptions[key] = opt.id;
                        });
                    }
                }
            });
            localStorage.setItem('gh-project-meta', JSON.stringify(meta));
            populateDropdowns();
            return meta;
        } catch (e) {
            console.error("Meta fetch error", e);
            return null;
        }
    }

    function populateDropdowns() {
        const meta = JSON.parse(localStorage.getItem('gh-project-meta') || '{}');
        if (meta.fields) {
            // Priority
            if (meta.fields['priority']) {
                const prioritySelect = document.getElementById('task-priority');
                if (prioritySelect) {
                    const currentVal = prioritySelect.value;
                    prioritySelect.innerHTML = meta.fields['priority'].options.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
                    if (currentVal) prioritySelect.value = currentVal;
                }
            }
            // Type
            const typeField = meta.fields['task type'] || meta.fields['type'] || meta.fields['task_type'];
            if (typeField) {
                const typeSelect = document.getElementById('task-type');
                if (typeSelect) {
                    const currentVal = typeSelect.value;
                    typeSelect.innerHTML = typeField.options.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
                    if (currentVal) typeSelect.value = currentVal;
                }
            }
        }

        // Assignees
        const assignees = JSON.parse(localStorage.getItem('gh-assignees') || '[]');
        const assigneeSelect = document.getElementById('task-assignee');
        if (assigneeSelect && assigneeSelect.tagName === 'SELECT') {
            const currentVal = assigneeSelect.value;
            let html = `<option value="">Unassigned</option>`;
            assignees.forEach(a => {
                html += `<option value="${a}">${a}</option>`;
            });
            assigneeSelect.innerHTML = html;
            if (currentVal) assigneeSelect.value = currentVal;
        }
    }

    async function syncTaskToGitHub(task) {
        const settings = saveGithubSettings();
        if (!settings.org || !settings.projectNum || !settings.token) return;

        let ghMeta = JSON.parse(localStorage.getItem('gh-project-meta') || 'null');
        if (!ghMeta || !ghMeta.id || !ghMeta.statusFieldId) {
            ghMeta = await fetchGitHubMeta(settings);
            if (!ghMeta) return;
        }

        // 1. Create Issue if not linked
        if (!task.ghItemId) {
            if (ghMeta.repoId) {
                // Create regular Issue
                const createMut = `
                mutation($repoId: ID!, $title: String!) {
                  createIssue(input: {repositoryId: $repoId, title: $title}) {
                    issue { id }
                  }
                }`;
                try {
                    const res = await fetch('https://api.github.com/graphql', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: createMut, variables: { repoId: ghMeta.repoId, title: task.title } })
                    });
                    const data = await res.json();
                    const newIssue = data.data?.createIssue?.issue;
                    
                    if (newIssue?.id) {
                        task.ghContentId = newIssue.id;
                        // Now add to project
                        const addMut = `
                        mutation($projectId: ID!, $contentId: ID!) {
                          addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
                            item { id }
                          }
                        }`;
                        const addRes = await fetch('https://api.github.com/graphql', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ query: addMut, variables: { projectId: ghMeta.id, contentId: newIssue.id } })
                        });
                        const addData = await addRes.json();
                        if (addData.data?.addProjectV2ItemById?.item?.id) {
                            task.ghItemId = addData.data.addProjectV2ItemById.item.id;
                        }
                    }
                } catch (e) {
                    console.error("Error creating issue", e);
                    return;
                }
            } else {
                // Fallback to Draft Issue if repo not found or not specified
                const createMut = `
                mutation($projectId: ID!, $title: String!) {
                  addProjectV2DraftIssue(input: {projectId: $projectId, title: $title}) {
                    projectItem {
                      id
                      content { ... on DraftIssue { id } }
                    }
                  }
                }`;
                try {
                    const res = await fetch('https://api.github.com/graphql', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: createMut, variables: { projectId: ghMeta.id, title: task.title } })
                    });
                    const data = await res.json();
                    const newItem = data.data?.addProjectV2DraftIssue?.projectItem;
                    if (newItem?.id) {
                        task.ghItemId = newItem.id;
                        task.ghContentId = newItem.content?.id;
                    }
                } catch (e) {
                    console.error("Error creating draft issue", e);
                    return;
                }
            }
        }

        if (!task.ghItemId) return;

        // Helper to update field
        const updateField = async (fieldId, valueObj) => {
            const mut = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId,
                itemId: $itemId,
                fieldId: $fieldId,
                value: $value
              }) { projectV2Item { id } }
            }`;
            await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: mut, variables: { projectId: ghMeta.id, itemId: task.ghItemId, fieldId: fieldId, value: valueObj } })
            });
        };

        // 2. Sync Status
        if (ghMeta.statusFieldId && task.status) {
            let optionId = ghMeta.statusOptions[task.status];
            if (optionId) await updateField(ghMeta.statusFieldId, { singleSelectOptionId: optionId });
        }

        // 3. Sync Priority
        const priorityField = ghMeta.fields['priority'];
        if (priorityField && priorityField.options && task.priority) {
            const opt = priorityField.options.find(o => o.name.toLowerCase() === task.priority.toLowerCase());
            if (opt) await updateField(priorityField.id, { singleSelectOptionId: opt.id });
        }

        // 4. Sync Task Type
        const typeField = ghMeta.fields['task type'] || ghMeta.fields['type'] || ghMeta.fields['task_type'];
        if (typeField && typeField.options && task.type) {
            const opt = typeField.options.find(o => o.name.toLowerCase() === task.type.toLowerCase());
            if (opt) await updateField(typeField.id, { singleSelectOptionId: opt.id });
        }

        // 5. Sync Sprint
        const sprintField = ghMeta.fields['sprint'];
        if (sprintField && task.sprint) {
            if (sprintField.options) {
                // If it's a single select
                const opt = sprintField.options.find(o => o.name.toLowerCase() === task.sprint.toLowerCase());
                if (opt) await updateField(sprintField.id, { singleSelectOptionId: opt.id });
            } else {
                // Assume it's an iteration or text field. For iteration/number, text works mostly, or if it's explicitly iteration we'd need iterationId.
                // Let's try sending it as text. If GitHub rejects it, it might be an Iteration field which requires iterationId or just text.
                // According to GitHub GraphQL API, text is used for text fields.
                try {
                    await updateField(sprintField.id, { text: task.sprint.toString() });
                } catch(e) { console.error("Error updating sprint", e); }
            }
        }

        // 6. Sync Assignee
        if (task.assignee && task.ghContentId) {
            let userId = await getUserId(task.assignee, settings.token);
            if (userId) {
                const assignMut = `
                mutation($assignableId: ID!, $assigneeIds: [ID!]!) {
                  addAssigneesToAssignable(input: {assignableId: $assignableId, assigneeIds: $assigneeIds}) {
                    clientMutationId
                  }
                }`;
                await fetch('https://api.github.com/graphql', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: assignMut, variables: { assignableId: task.ghContentId, assigneeIds: [userId] } })
                });
            }
        }
    }

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
        if (!settings.org || !settings.projectNum || !settings.token) return;

        pullGithubBtn.textContent = 'Syncing...';

        const query = `
        query($org: String!, $num: Int!) {
          organization(login: $org) {
            membersWithRole(first: 100) {
              nodes {
                login
              }
            }
            projectV2(number: $num) {
              id
              items(first: 100) {
                nodes {
                  id
                  fieldValues(first: 20) {
                    nodes {
                      __typename
                      ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { name } } }
                      ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
                      ... on ProjectV2ItemFieldUserValue { users(first: 1) { nodes { login } } field { ... on ProjectV2FieldCommon { name } } }
                    }
                  }
                  content { 
                    ... on Issue { id title assignees(first: 1) { nodes { login } } } 
                    ... on PullRequest { id title assignees(first: 1) { nodes { login } } }
                    ... on DraftIssue { id title assignees(first: 1) { nodes { login } } }
                  }
                }
              }
            }
          }
        }`;

        try {
            const res = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}/issues?state=all&per_page=100`, {
                headers: {
                    'Authorization': `Bearer ${settings.token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });
            const data = await res.json();

            if (data.errors) {
                alert("GitHub API Error: " + data.errors[0].message);
                pullGithubBtn.textContent = 'Manual Sync';
                return;
            }

            const projectV2 = data.data.organization.projectV2;
            const projectItems = projectV2.items.nodes;

            // Save project node ID for later mutations
            const meta = JSON.parse(localStorage.getItem('gh-project-meta') || '{}');
            meta.id = projectV2.id;
            localStorage.setItem('gh-project-meta', JSON.stringify(meta));

            let addedCount = 0;
            let uniqueAssignees = new Set(JSON.parse(localStorage.getItem('gh-assignees') || '[]'));

            // Import org members as assignees
            if (data.data.organization.membersWithRole) {
                data.data.organization.membersWithRole.nodes.forEach(member => {
                    if (member.login) uniqueAssignees.add(member.login);
                });
            }

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
                        else if (text.includes('backlog')) statusVal = 'backlog';
                    }
                    if (fieldName === 'priority') {
                        if (f.name) priorityVal = f.name;
                    }
                    if (fieldName === 'assignees' || fieldName === 'assignee') {
                        if (f.users && f.users.nodes.length > 0 && !assignee) {
                            assignee = f.users.nodes[0].login;
                        }
                    }
                });
                if (assignee) uniqueAssignees.add(assignee);

                // Detect if task already exists on board by matching title
                const existingIndex = tasks.findIndex(t => t.title.toLowerCase().trim() === issueTitle.toLowerCase().trim());
                if (existingIndex >= 0) {
                    tasks[existingIndex].status = statusVal; // Strict matching
                    tasks[existingIndex].priority = priorityVal;
                    tasks[existingIndex].assignee = assignee; // Strict matching, overrides with empty if unassigned in Git
                    tasks[existingIndex].ghItemId = item.id;
                    if (item.content.id) tasks[existingIndex].ghContentId = item.content.id;
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
                        type: 'New feature',
                        ghItemId: item.id,
                        ghContentId: item.content?.id
                    });
                    addedCount++;
                }
            });

            // Push any local tasks that don't exist in GitHub yet
            let pushedCount = 0;
            for (let i = 0; i < tasks.length; i++) {
                if (!tasks[i].ghItemId) {
                    await syncTaskToGitHub(tasks[i]);
                    pushedCount++;
                }
            }

            localStorage.setItem('gh-assignees', JSON.stringify(Array.from(uniqueAssignees)));
            populateDropdowns();
            saveAndRender();
            alert(`Sync complete! Pulled ${projectItems.length} items. Added ${addedCount} brand new tasks. Pushed ${pushedCount} local tasks to GitHub.`);
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
