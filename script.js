if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker: Enregistré'))
      .catch(err => console.log(`Service Worker: Erreur: ${err}`));
  });
}

document.addEventListener('DOMContentLoaded', () => {

    function getInitialItems() {
        try {
            const items = localStorage.getItem('inventoryItems');
            return items ? JSON.parse(items) : [];
        } catch (e) {
            console.error("Erreur lors de la lecture de l'inventaire, réinitialisation.", e);
            localStorage.removeItem('inventoryItems');
            return [];
        }
    }

    const state = {
        items: getInitialItems(),
        currentView: 'listView',
        isEditing: false,
        editItemId: null,
    };

    let charts = {};
    let html5QrcodeScanner;

    const selectors = {
        body: document.body,
        themeToggle: document.getElementById('themeToggle'),
        addItemBtn: document.getElementById('addItemBtn'),
        addItemModal: document.getElementById('addItemModal'),
        cancelBtn: document.getElementById('cancelBtn'),
        itemForm: document.getElementById('itemForm'),
        itemType: document.getElementById('itemType'),
        expiryGroup: document.getElementById('expiryGroup'),
        itemPhotoInput: document.getElementById('itemPhoto'),
        photoPreview: document.getElementById('photoPreview'),
        clearPhotoBtn: document.getElementById('clearPhotoBtn'),
        searchBar: document.getElementById('searchBar'),
        searchSuggestions: document.getElementById('searchSuggestions'),
        roomFilter: document.getElementById('roomFilter'),
        typeFilter: document.getElementById('typeFilter'),
        expiryFilter: document.getElementById('expiryFilter'),
        mapViewBtn: document.getElementById('mapViewBtn'),
        listViewBtn: document.getElementById('listViewBtn'),
        statsViewBtn: document.getElementById('statsViewBtn'),
        mainView: document.getElementById('mainView'),
        categoriesContainer: document.getElementById('categoriesContainer'),
        houseMap: document.getElementById('houseMap'),
        statsView: document.getElementById('statsView'),
        shoppingListContainer: document.getElementById('shoppingListContainer'),
        generateListBtn: document.getElementById('generateListBtn'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
        totalItemsCard: document.getElementById('totalItemsCard'),
        expiringItemsCard: document.getElementById('expiringItemsCard'),
        totalRoomsCard: document.getElementById('totalRoomsCard'),
        lowStockItemsCard: document.getElementById('lowStockItemsCard'),
        detailedStats: document.getElementById('detailedStats'),
        colorSettings: document.getElementById('colorSettings'),
        chartTypeToggle: document.getElementById('chartTypeToggle'),
        expirySettings: document.getElementById('expirySettings'),
        scannerBtn: document.getElementById('scannerBtn'),
        scannerModal: document.getElementById('scannerModal'),
        scannerContainer: document.getElementById('scanner-container'),
        cancelScanBtn: document.getElementById('cancelScanBtn'),
    };
	
    const rooms = {
        'cuisine': '🍳 Cuisine', 'salon': '🛋️ Salon', 'chambre': '🛏️ Chambre',
        'salle-bain': '🛁 Salle de bain', 'bureau': '💼 Bureau', 'garage': '🔧 Garage',
        'cave': '🍷 Cave'
    };
	
    const types = {
        'food': '🍎 Nourriture', 'objects': '🏠 Objets'
    };

    const STATUS_MAP = {
        fresh: 'Frais',
        expiring: 'Expire bientôt',
        expired: 'Expiré'
    };

    const DEFAULT_EXPIRY_THRESHOLDS = {
        cuisine: 7, salon: 14, chambre: 365, 'salle-bain': 90,
        bureau: 365, garage: 365, cave: 60
    };
	
    function init() {
        loadTheme();
        renderColorPickers();
        renderExpirySettings();
        recalculateAllItemStatuses();
        renderAll();
        addEventListeners();
    }

    function renderAll() {
        updateStats();
        displayView(state.currentView);
    }

    function displayView(view) {
        state.currentView = view;
        selectors.categoriesContainer.classList.add('hidden');
        selectors.houseMap.classList.add('hidden');
        selectors.statsView.classList.add('hidden');
        selectors.shoppingListContainer.classList.add('hidden');
        document.querySelectorAll('.view-toggle .toggle-btn').forEach(btn => btn.classList.remove('active'));
        if (view === 'listView') {
            selectors.categoriesContainer.classList.remove('hidden');
            selectors.listViewBtn.classList.add('active');
            renderCategories();
        } else if (view === 'mapView') {
            selectors.houseMap.classList.remove('hidden');
            selectors.mapViewBtn.classList.add('active');
            updateMapCounts();
        } else if (view === 'statsView') {
            selectors.statsView.classList.remove('hidden');
            selectors.statsViewBtn.classList.add('active');
            renderDetailedStats();
            renderStatsCharts();
        } else if (view === 'shoppingListView') {
            selectors.shoppingListContainer.classList.remove('hidden');
            renderShoppingList();
        }
    }

    function renderCategories() {
        selectors.categoriesContainer.innerHTML = '';
        const filteredItems = filterItems();
        const groupedItems = filteredItems.reduce((acc, item) => {
            if (item && item.room) {
                (acc[item.room] = acc[item.room] || []).push(item);
            }
            return acc;
        }, {});
		
        for (const roomKey in rooms) {
            if (groupedItems[roomKey] && groupedItems[roomKey].length > 0) {
                const roomName = rooms[roomKey];
                const section = document.createElement('div');
                section.className = 'category-section';
                section.innerHTML = `
                    <div class="category-header">
                        <h3>${roomName}</h3>
                        <button class="add-item-btn" data-room="${roomKey}">➕ Ajouter un article</button>
                    </div>
                    <ul class="item-list" id="list-${roomKey}"></ul>
                `;
                selectors.categoriesContainer.appendChild(section);
                const list = section.querySelector('.item-list');
                groupedItems[roomKey].forEach(item => {
                    const li = createItemCard(item);
                    list.appendChild(li);
                });
            }
        }
    }

    function createItemCard(item) {
        if (!item || !item.name || !item.room) {
            const emptyLi = document.createElement('li');
            emptyLi.style.display = 'none';
            return emptyLi;
        }
        const li = document.createElement('li');
        li.className = 'item-card';
        li.setAttribute('data-id', item.id);
        if (item.status) {
            li.classList.add(item.status);
        }
        const roomName = rooms[item.room] || 'Pièce inconnue';
        li.innerHTML = `
            <img src="${item.photo || 'https://via.placeholder.com/60'}" class="item-photo" alt="${item.name || 'Article sans nom'}">
            <div class="item-info">
                <div class="item-name">${item.name || 'Article sans nom'}</div>
                <div class="item-details">
                    Quantité: ${item.quantity || 'N/A'} - 
                    ${item.type === 'food' ? `Expire le: ${item.expiry || 'N/A'}` : `Pièce: ${roomName}`}
                </div>
            </div>
            <div class="item-actions">
                <button class="edit-btn" data-id="${item.id}">✏️</button>
                <button class="delete-btn" data-id="${item.id}">🗑️</button>
            </div>
        `;
        return li;
    }

    function updateStats() {
        const totalItems = state.items.length;
        const expiringItems = state.items.filter(item => item.status === 'expiring').length;
        const lowStockItems = state.items.filter(item => {
            const quantity = parseInt(item.quantity);
            const threshold = parseInt(item.threshold);
            return !isNaN(quantity) && !isNaN(threshold) && quantity <= threshold;
        }).length;
        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('expiringItems').textContent = expiringItems;
        document.getElementById('lowStockItems').textContent = lowStockItems;
    }

    function updateMapCounts() {
        for (const roomKey in rooms) {
            const count = state.items.filter(item => item.room === roomKey).length;
            const roomCountEl = document.getElementById(`${roomKey}-count`);
            if (roomCountEl) {
                roomCountEl.textContent = count;
            }
        }
    }

    function renderDetailedStats() {
        const detailedStatsEl = document.getElementById('detailedStats');
        detailedStatsEl.innerHTML = '';
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentItems = state.items.filter(item =>
            item.dateAdded && new Date(item.dateAdded) > thirtyDaysAgo
        ).length;
        const recentCard = document.createElement('div');
        recentCard.className = 'stat-card';
        recentCard.setAttribute('data-filter-type', 'recent');
        recentCard.setAttribute('data-filter-value', '30');
        recentCard.innerHTML = `
            <div class="stat-label">Nouveaux articles</div>
            <div class="stat-value">${recentItems}</div>
            <div class="stat-details">ajoutés ces 30 derniers jours</div>
        `;
        detailedStatsEl.prepend(recentCard);
        const stats = {};
        state.items.forEach(item => {
            const key = `${item.room}-${item.type}`;
            if (!stats[key]) {
                stats[key] = { count: 0, room: rooms[item.room], type: types[item.type], roomKey: item.room, typeKey: item.type, lowStock: 0, expired: 0, expiring: 0 };
            }
            stats[key].count++;
            const quantity = parseInt(item.quantity);
            const threshold = parseInt(item.threshold);
            if (!isNaN(quantity) && !isNaN(threshold) && quantity <= threshold) {
                stats[key].lowStock++;
            }
            if (item.status === 'expired') stats[key].expired++;
            if (item.status === 'expiring') stats[key].expiring++;
        });
        for (const key in stats) {
            const s = stats[key];
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.setAttribute('data-filter-type', 'category');
            card.setAttribute('data-filter-value', `${s.roomKey}|${s.typeKey}`);
            card.innerHTML = `
                <div class="stat-label">${s.room} - ${s.type}</div>
                <div class="stat-value">${s.count} articles</div>
                <div class="stat-details">
                    ${s.lowStock > 0 ? `<span class="stat-low-stock">Stock faible: ${s.lowStock}</span>` : ''}
                    ${s.expired > 0 ? `<span class="stat-expired">Expirés: ${s.expired}</span>` : ''}
                    ${s.expiring > 0 ? `<span class="stat-expiring">Expire bientôt: ${s.expiring}</span>` : ''}
                </div>
            `;
            detailedStatsEl.appendChild(card);
        }
    }

    function getDefaultColors() {
        return {
            rooms: {
                cuisine: '#3498db', salon: '#e74c3c', chambre: '#9b59b6',
                'salle-bain': '#2ecc71', bureau: '#f1c40f', garage: '#1abc9c', cave: '#34495e'
            },
            status: {
                expired: '#e74c3c', expiring: '#f1c40f', fresh: '#2ecc71'
            }
        };
    }

    function getChartColors() {
        const savedColors = localStorage.getItem('chartColors');
        if (savedColors) {
            try {
                const defaults = getDefaultColors();
                const custom = JSON.parse(savedColors);
                return {
                    rooms: { ...defaults.rooms, ...custom.rooms },
                    status: { ...defaults.status, ...custom.status }
                };
            } catch (e) {
                return getDefaultColors();
            }
        }
        return getDefaultColors();
    }

    function renderColorPickers() {
        const colors = getChartColors();
        const roomContainer = document.getElementById('roomColorPickers');
        const statusContainer = document.getElementById('statusColorPickers');
        if (!roomContainer || !statusContainer) return;
        roomContainer.innerHTML = '';
        statusContainer.innerHTML = '';
        for (const key in rooms) {
            const item = document.createElement('div');
            item.className = 'color-picker-item';
            item.innerHTML = `
                <input type="color" value="${colors.rooms[key] || '#cccccc'}" data-type="rooms" data-key="${key}">
                <label>${rooms[key]}</label>
            `;
            roomContainer.appendChild(item);
        }
        for (const key in STATUS_MAP) {
            const item = document.createElement('div');
            item.className = 'color-picker-item';
            item.innerHTML = `
                <input type="color" value="${colors.status[key] || '#cccccc'}" data-type="status" data-key="${key}">
                <label>${STATUS_MAP[key]}</label>
            `;
            statusContainer.appendChild(item);
        }
    }
    
    function renderStatsCharts() {
        Object.values(charts).forEach(chart => chart.destroy());
        const chartColors = getChartColors();
        const preferredChartType = localStorage.getItem('chartType') || 'circle';
        if (selectors.chartTypeToggle) {
            selectors.chartTypeToggle.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.chartType === preferredChartType);
            });
        }
        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: preferredChartType === 'bar' ? 'top' : 'right',
                }
            }
        };
        const itemsByRoom = state.items.reduce((acc, item) => {
            const roomName = rooms[item.room] || 'Non classé';
            acc[roomName] = (acc[roomName] || 0) + 1;
            return acc;
        }, {});
        const roomLabels = Object.keys(itemsByRoom);
        const roomColors = roomLabels.map(label => {
            const roomKey = Object.keys(rooms).find(key => rooms[key] === label);
            return chartColors.rooms[roomKey] || '#cccccc';
        });
        const roomCtx = document.getElementById('itemsByRoomChart').getContext('2d');
        const roomChartOptions = {
            ...baseOptions,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedLabel = charts.itemsByRoom.data.labels[elements[0].index];
                    const roomKey = Object.keys(rooms).find(key => rooms[key] === clickedLabel);
                    if (roomKey) {
                        const filtered = state.items.filter(item => item.room === roomKey);
                        const container = document.getElementById('statsFilteredListContainer');
                        const list = document.getElementById('statsFilteredList');
                        const title = document.getElementById('statsFilteredListTitle');
                        title.textContent = `Articles dans : ${clickedLabel}`;
                        list.innerHTML = '';
                        filtered.forEach(item => {
                            list.appendChild(createItemCard(item));
                        });
                        container.style.display = 'block';
                        container.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
        };
        if (preferredChartType === 'bar') {
            roomChartOptions.indexAxis = 'y';
            roomChartOptions.scales = { x: { beginAtZero: true } };
        }
        charts.itemsByRoom = new Chart(roomCtx, {
            type: preferredChartType === 'circle' ? 'doughnut' : 'bar',
            data: {
                labels: roomLabels,
                datasets: [{
                    label: 'Nombre d\'articles',
                    data: Object.values(itemsByRoom),
                    backgroundColor: roomColors,
                }]
            },
            options: roomChartOptions
        });
        const expiryStatus = state.items
            .filter(item => item.type === 'food' && item.status)
            .reduce((acc, item) => {
                const statusLabel = STATUS_MAP[item.status] || 'Autre';
                acc[statusLabel] = (acc[statusLabel] || 0) + 1;
                return acc;
            }, {});
        const statusLabels = Object.keys(expiryStatus);
        const statusColors = statusLabels.map(label => {
            const statusKey = Object.keys(STATUS_MAP).find(key => STATUS_MAP[key] === label);
            return chartColors.status[statusKey] || '#cccccc';
        });
        const expiryCtx = document.getElementById('expiryStatusChart').getContext('2d');
        const expiryChartOptions = {
             ...baseOptions,
             onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedLabel = charts.expiryStatus.data.labels[elements[0].index];
                    let statusKey = Object.keys(STATUS_MAP).find(key => STATUS_MAP[key] === clickedLabel);
                    if (statusKey) {
                        const filtered = state.items.filter(item => item.status === statusKey);
                        const container = document.getElementById('statsFilteredListContainer');
                        const list = document.getElementById('statsFilteredList');
                        const title = document.getElementById('statsFilteredListTitle');
                        title.textContent = `Articles avec le statut : ${clickedLabel}`;
                        list.innerHTML = '';
                        filtered.forEach(item => {
                            list.appendChild(createItemCard(item));
                        });
                        container.style.display = 'block';
                        container.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            }
        };
        if (preferredChartType === 'bar') {
            expiryChartOptions.indexAxis = 'y';
            expiryChartOptions.scales = { x: { beginAtZero: true } };
        }
        charts.expiryStatus = new Chart(expiryCtx, {
            type: preferredChartType === 'circle' ? 'pie' : 'bar',
            data: {
                labels: statusLabels,
                datasets: [{
                    label: 'État',
                    data: Object.values(expiryStatus),
                    backgroundColor: statusColors
                }]
            },
            options: expiryChartOptions
        });
    }

    function renderShoppingList() {
        const shoppingListEl = document.getElementById('shoppingList');
        if (!shoppingListEl) return;
        shoppingListEl.innerHTML = '';
        const lowStockItems = state.items.filter(item => {
            const quantity = parseInt(item.quantity);
            const threshold = parseInt(item.threshold);
            return !isNaN(quantity) && !isNaN(threshold) && quantity <= threshold;
        });
        if (lowStockItems.length === 0) {
            shoppingListEl.innerHTML = '<p>Votre stock est complet !</p>';
            return;
        }
        const ul = document.createElement('ul');
        lowStockItems.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.name} (${item.quantity} restants)`;
            ul.appendChild(li);
        });
        shoppingListEl.appendChild(ul);
    }
    
    async function fetchProductInfo(barcode) {
        const originalTitle = document.getElementById('scannerTitle').textContent;
        document.getElementById('scannerTitle').textContent = "Recherche en cours...";
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const data = await response.json();
            if (data.status === 1 && data.product) {
                const product = data.product;
                const prefilledData = {
                    name: product.product_name || '',
                    photo: product.image_front_url || '',
                    barcode: barcode
                };
                showModal(null, prefilledData);
            } else {
                alert(`Produit non trouvé. Code-barres : ${barcode}`);
                showModal(null, { barcode: barcode });
            }
        } catch (error) {
            console.error("Erreur lors de la récupération des informations du produit:", error);
            alert("Erreur réseau. Impossible de récupérer les informations du produit. Veuillez l'ajouter manuellement.");
            showModal(null, { barcode: barcode });
        } finally {
             if(document.getElementById('scannerTitle')) document.getElementById('scannerTitle').textContent = originalTitle;
        }
    }

    function startScanner() {
        selectors.scannerModal.style.display = 'flex';
        html5QrcodeScanner = new Html5QrcodeScanner("scanner-container", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        
        function onScanSuccess(decodedText, decodedResult) {
            stopScanner();
            fetchProductInfo(decodedText);
        }
        
        html5QrcodeScanner.render(onScanSuccess);
    }

    function stopScanner() {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear().catch(error => {
                console.error("Échec de l'arrêt du scanner.", error);
            });
            html5QrcodeScanner = null;
        }
        selectors.scannerModal.style.display = 'none';
    }

    function addEventListeners() {
        selectors.scannerBtn.addEventListener('click', startScanner);
        selectors.cancelScanBtn.addEventListener('click', stopScanner);
        selectors.themeToggle.addEventListener('click', toggleTheme);
        selectors.totalItemsCard.addEventListener('click', () => {
            selectors.roomFilter.value = '';
            selectors.typeFilter.value = '';
            selectors.expiryFilter.value = '';
            displayView('listView');
        });
        selectors.expiringItemsCard.addEventListener('click', () => {
            selectors.expiryFilter.value = 'expiring';
            displayView('listView');
        });
        selectors.totalRoomsCard.addEventListener('click', () => {
            displayView('mapView');
        });
        selectors.lowStockItemsCard.addEventListener('click', () => {
            displayView('shoppingListView');
        });
        selectors.addItemBtn.addEventListener('click', () => showModal());
        selectors.cancelBtn.addEventListener('click', () => hideModal());
        window.addEventListener('click', (event) => {
            if (event.target === selectors.addItemModal) {
                hideModal();
            }
        });
        selectors.itemForm.addEventListener('submit', handleFormSubmit);
        selectors.itemType.addEventListener('change', (e) => {
            selectors.expiryGroup.style.display = e.target.value === 'food' ? 'block' : 'none';
        });
        selectors.itemPhotoInput.addEventListener('change', handlePhotoUpload);
        selectors.clearPhotoBtn.addEventListener('click', clearPhoto);
        selectors.searchBar.addEventListener('input', handleSearch);
        selectors.roomFilter.addEventListener('change', renderCategories);
        selectors.typeFilter.addEventListener('change', renderCategories);
        selectors.expiryFilter.addEventListener('change', renderCategories);
        selectors.mapViewBtn.addEventListener('click', () => displayView('mapView'));
        selectors.listViewBtn.addEventListener('click', () => displayView('listView'));
        selectors.statsViewBtn.addEventListener('click', () => displayView('statsView'));
        selectors.houseMap.addEventListener('click', handleRoomClick);
        selectors.detailedStats.addEventListener('click', handleDetailedStatClick);
        selectors.colorSettings.addEventListener('change', (e) => {
            if (e.target.type === 'color') {
                const type = e.target.dataset.type;
                const key = e.target.dataset.key;
                const newColor = e.target.value;
                const currentColors = getChartColors();
                currentColors[type][key] = newColor;
                localStorage.setItem('chartColors', JSON.stringify(currentColors));
                renderStatsCharts();
            }
        });
        selectors.chartTypeToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (btn) {
                const chartType = btn.dataset.chartType;
                localStorage.setItem('chartType', chartType);
                renderStatsCharts();
            }
        });
        selectors.expirySettings.addEventListener('input', (e) => {
            if (e.target.type === 'number') {
                const roomKey = e.target.dataset.roomKey;
                const days = parseInt(e.target.value);
                if (roomKey && !isNaN(days) && days > 0) {
                    const currentThresholds = getExpiryThresholds();
                    currentThresholds[roomKey] = days;
                    localStorage.setItem('expiryThresholds', JSON.stringify(currentThresholds));
                    recalculateAllItemStatuses();
                    renderAll();
                }
            }
        });
        selectors.mainView.addEventListener('click', (e) => {
            const target = e.target;
            const deleteBtn = target.closest('.delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const id = deleteBtn.dataset.id;
                if (id && confirm("Êtes-vous sûr de vouloir supprimer cet article ?")) {
                    state.items = state.items.filter(item => item.id !== id);
                    saveState();
                    renderAll();
                }
                return;
            }
            const addBtn = target.closest('.add-item-btn');
            if (addBtn) {
                const room = addBtn.dataset.room;
                showModal(room);
                return;
            }
            const itemCard = target.closest('.item-card');
            if (itemCard) {
                const id = itemCard.dataset.id;
                const itemToEdit = state.items.find(item => item.id === id);
                if (itemToEdit) {
                    state.isEditing = true;
                    state.editItemId = id;
                    showModal(null, itemToEdit);
                }
            }
        });
        selectors.generateListBtn.addEventListener('click', () => displayView('shoppingListView'));
        selectors.exportBtn.addEventListener('click', exportData);
        selectors.importBtn.addEventListener('click', importData);
    }
    
    function handleSearch() {
        renderCategories();
    }

    function handleFormSubmit(event) {
        event.preventDefault();
        const photoSrc = selectors.photoPreview.src.startsWith('data:') ? selectors.photoPreview.src : '';
        const newItem = {
            name: document.getElementById('itemName').value,
            type: selectors.itemType.value,
            room: document.getElementById('roomSelect').value,
            barcode: document.getElementById('itemBarcode').value,
            quantity: document.getElementById('itemQuantity').value,
            price: parseFloat(document.getElementById('itemPrice').value) || 0,
            location: document.getElementById('itemLocation').value,
            expiry: document.getElementById('itemExpiry').value,
            threshold: document.getElementById('itemThreshold').value,
            photo: photoSrc,
            notes: document.getElementById('itemNotes').value,
            id: state.isEditing ? state.editItemId : Date.now().toString(),
        };
        updateItemStatus(newItem);
        if (state.isEditing) {
            const itemIndex = state.items.findIndex(item => item.id === state.editItemId);
            if (itemIndex > -1) {
                newItem.dateAdded = state.items[itemIndex].dateAdded; 
                state.items[itemIndex] = newItem;
            }
        } else {
            newItem.dateAdded = new Date().toISOString();
            state.items.push(newItem);
        }
        saveState();
        hideModal();
        renderAll();
    }

    function handleRoomClick(e) {
        const roomElement = e.target.closest('.room');
        if (!roomElement) return;
        const roomKey = roomElement.dataset.room;
        if (roomKey) {
            selectors.roomFilter.value = roomKey;
            displayView('listView');
        }
    }

    function handleDetailedStatClick(e) {
        const card = e.target.closest('.stat-card[data-filter-type]');
        if (!card) return;
        const filterType = card.dataset.filterType;
        const filterValue = card.dataset.filterValue;
        let filteredItems = [];
        let titleText = '';
        if (filterType === 'recent') {
            const days = parseInt(filterValue);
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);
            filteredItems = state.items.filter(item => item.dateAdded && new Date(item.dateAdded) > dateLimit);
            titleText = `Nouveaux articles (${days} derniers jours)`;
        } else if (filterType === 'category') {
            const [roomKey, typeKey] = filterValue.split('|');
            filteredItems = state.items.filter(item => item.room === roomKey && item.type === typeKey);
            titleText = `Articles dans : ${rooms[roomKey]} - ${types[typeKey]}`;
        }
        const container = document.getElementById('statsFilteredListContainer');
        const list = document.getElementById('statsFilteredList');
        const title = document.getElementById('statsFilteredListTitle');
        title.textContent = titleText;
        list.innerHTML = '';
        if (filteredItems.length > 0) {
            filteredItems.forEach(item => {
                list.appendChild(createItemCard(item));
            });
        } else {
            list.innerHTML = '<p>Aucun article ne correspond à ce critère.</p>';
        }
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
    }

    function handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                selectors.photoPreview.src = e.target.result;
                selectors.photoPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    function showModal(room = null, item = null) {
        const modalTitle = document.getElementById('modalTitle');
        const submitBtn = document.getElementById('submitBtn');
        selectors.itemForm.reset();
        selectors.photoPreview.src = '';
        selectors.photoPreview.style.display = 'none';
        selectors.expiryGroup.style.display = 'none';
        selectors.itemForm.querySelector('#itemId').value = '';
        state.isEditing = false;
        
        if (item && item.id && state.items.find(i => i.id === item.id)) {
            state.isEditing = true;
            state.editItemId = item.id;
            modalTitle.textContent = '✏️ Modifier un article';
            submitBtn.textContent = 'Modifier';
            document.getElementById('itemName').value = item.name || '';
            document.getElementById('roomSelect').value = item.room || '';
            selectors.itemType.value = item.type || '';
            document.getElementById('itemBarcode').value = item.barcode || '';
            document.getElementById('itemQuantity').value = item.quantity || '';
            document.getElementById('itemPrice').value = item.price || '';
            document.getElementById('itemLocation').value = item.location || '';
            document.getElementById('itemExpiry').value = item.expiry || '';
            document.getElementById('itemThreshold').value = item.threshold || '';
            document.getElementById('itemNotes').value = item.notes || '';
            if (item.photo && item.photo !== 'https://via.placeholder.com/60') {
                selectors.photoPreview.src = item.photo;
                selectors.photoPreview.style.display = 'block';
            }
            if (item.type === 'food') {
                selectors.expiryGroup.style.display = 'block';
            }
        } else {
            modalTitle.textContent = '✨ Ajouter un article';
            submitBtn.textContent = 'Ajouter';
            if (room) {
                document.getElementById('roomSelect').value = room;
            }
            if (item) {
                document.getElementById('itemName').value = item.name || '';
                document.getElementById('itemBarcode').value = item.barcode || '';
                if (item.photo) {
                    selectors.photoPreview.src = item.photo;
                    selectors.photoPreview.style.display = 'block';
                }
            }
        }
        selectors.addItemModal.style.display = 'flex';
    }

    function hideModal() {
        selectors.addItemModal.style.display = 'none';
    }

    function clearPhoto() {
        selectors.itemPhotoInput.value = null;
        selectors.photoPreview.src = '';
        selectors.photoPreview.style.display = 'none';
    }

    function saveState() {
        localStorage.setItem('inventoryItems', JSON.stringify(state.items));
    }

    function filterItems() {
        const room = selectors.roomFilter.value;
        const type = selectors.typeFilter.value;
        const expiry = selectors.expiryFilter.value;
        const searchTerm = selectors.searchBar.value.toLowerCase();
        return state.items.filter(item => {
            const matchRoom = !room || item.room === room;
            const matchType = !type || item.type === type;
            const matchSearch = !searchTerm || (item.name && item.name.toLowerCase().includes(searchTerm)) ||
                                (item.location && item.location.toLowerCase().includes(searchTerm)) ||
                                (item.notes && item.notes.toLowerCase().includes(searchTerm));
            const matchExpiry = !expiry || item.status === expiry;
            return matchRoom && matchType && matchSearch && matchExpiry;
        });
    }

    function getExpiryThresholds() {
        const saved = localStorage.getItem('expiryThresholds');
        if (saved) {
            try {
                return { ...DEFAULT_EXPIRY_THRESHOLDS, ...JSON.parse(saved) };
            } catch (e) { return DEFAULT_EXPIRY_THRESHOLDS; }
        }
        return DEFAULT_EXPIRY_THRESHOLDS;
    }

    function renderExpirySettings() {
        const thresholds = getExpiryThresholds();
        selectors.expirySettings.innerHTML = '';
        for (const key in rooms) {
            const item = document.createElement('div');
            item.className = 'setting-item';
            item.innerHTML = `
                <label for="expiry-${key}">${rooms[key]}</label>
                <input type="number" id="expiry-${key}" data-room-key="${key}" value="${thresholds[key] || 7}" min="1">
            `;
            selectors.expirySettings.appendChild(item);
        }
    }

    function recalculateAllItemStatuses() {
        state.items.forEach(item => updateItemStatus(item));
        saveState();
    }

    function updateItemStatus(item) {
        if (item.type === 'food' && item.expiry) {
            const thresholds = getExpiryThresholds();
            const thresholdInDays = thresholds[item.room] || 7;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiryDate = new Date(item.expiry);
            const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                item.status = 'expired';
            } else if (diffDays <= thresholdInDays) {
                item.status = 'expiring';
            } else {
                item.status = 'fresh';
            }
        } else {
            item.status = 'fresh';
        }
    }

    function exportData() {
        const dataStr = JSON.stringify(state.items);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mon-inventaire.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedItems = JSON.parse(e.target.result);
                        if (Array.isArray(importedItems)) {
                            state.items = importedItems;
                            saveState();
                            renderAll();
                            alert('Importation réussie !');
                        } else {
                            alert('Fichier JSON invalide. Veuillez vérifier le format.');
                        }
                    } catch (error) {
                        alert('Erreur lors de la lecture du fichier : ' + error.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark-theme') {
            document.body.classList.add('dark-theme');
            selectors.themeToggle.textContent = '☀️';
        } else {
            selectors.themeToggle.textContent = '🌙';
        }
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark-theme' : 'light-theme');
        selectors.themeToggle.textContent = isDark ? '☀️' : '🌙';
    }

    init();
});
