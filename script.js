document.addEventListener('DOMContentLoaded', () => {
    // Initial data or load from localStorage
    let tasks = JSON.parse(localStorage.getItem('pmo-tasks')) || [];
    
    // Seed requested initial data if not already seeded
    if (!localStorage.getItem('pmo-tasks-seeded')) {
        const seedTasks = [
            { id: "seed1", title: "Service group creation issue fix", stakeholder: "-", assignee: "manibharathi", priority: "High", status: "live", datePlanned: "", eta: "" },
            { id: "seed2", title: "Swapna ticket assignment", stakeholder: "-", assignee: "manibharathi", priority: "Medium", status: "live", datePlanned: "", eta: "" },
            { id: "seed3", title: "Milestone sync - TTL flow", stakeholder: "-", assignee: "manibharathi", priority: "High", status: "in-progress", datePlanned: "", eta: "" },
            { id: "seed4", title: "validity removal script", stakeholder: "-", assignee: "dharneesh", priority: "Medium", status: "in-qe", datePlanned: "", eta: "" },
            { id: "seed5", title: "talk to lawyer - need to collect email and city post payment  - in self serve page", stakeholder: "-", assignee: "austin", priority: "High", status: "todo", datePlanned: "", eta: "" },
            { id: "seed6", title: "need to enable discount for executive - till 76%. beyond 76% - require approval from manager", stakeholder: "-", assignee: "Manibharathi", priority: "Medium", status: "backlog", datePlanned: "", eta: "" },
            { id: "seed7", title: "changes in Annual Compliance - CCFS Scheme - service", stakeholder: "-", assignee: "Manibharathi", priority: "Medium", status: "backlog", datePlanned: "", eta: "" },
            { id: "seed8", title: "Consolidated Compliance dashboard", stakeholder: "-", assignee: "manibharathi", priority: "High", status: "backlog", datePlanned: "", eta: "" }
        ];
        
        tasks = [...tasks, ...seedTasks];
        localStorage.setItem('pmo-tasks', JSON.stringify(tasks));
        localStorage.setItem('pmo-tasks-seeded', 'true');
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

    // Init Board
    renderBoard();

    // Event Listeners
    addTaskBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    taskForm.addEventListener('submit', saveTask);
    deleteTaskBtn.addEventListener('click', deleteTask);

    // Close modal on outside click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
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

        tasks.forEach(task => {
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
            deleteTaskBtn.classList.remove('hidden');
        } else {
            modalTitle.textContent = 'Add New Task';
            taskForm.reset();
            idInput.value = '';
            statusInput.value = 'backlog';
            typeInput.value = 'New feature';
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
            type: typeInput.value
        };

        if (idInput.value) {
            // Update
            const index = tasks.findIndex(t => t.id === taskData.id);
            if (index !== -1) tasks[index] = taskData;
        } else {
            // Add
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
});
