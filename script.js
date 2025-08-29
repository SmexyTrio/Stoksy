if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker: Enregistré'))
      .catch(err => console.log(`Service Worker: Erreur: ${err}`));
  });
}

document.addEventListener('DOMContentLoaded', () => {
    const state = {
        items: JSON.parse(localStorage.getItem('inventoryItems')) || [],
        currentView: 'listView',
        isEditing: false,
        editItemId: null,
    };

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
        categoriesContainer: document.getElementById('categoriesContainer'),
        houseMap: document.getElementById('houseMap'),
        statsView: document.getElementById('statsView'),
        shoppingListContainer: document.getElementById('shoppingListContainer'),
        generateListBtn: document.getElementById('generateListBtn'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
    };

    const rooms = {
        'cuisine': '🍳 Cuisine', 'salon': '🛋️ Salon', 'chambre': '🛏️ Chambre',
        'salle-bain': '🛁 Salle de bain', 'bureau': '💼 Bureau', 'garage': '🔧 Garage',
        'cave': '🍷 Cave'
    };

    const types = {
        'food': '🍎 Nourriture', 'objects': '🏠 Objets'
    };

    // Initialisation de l'état
    function init() {
        loadTheme();
        renderAll();
        addEventListeners();
    }

    // --- Logique du rendu ---
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
        } else if (view === 'shoppingListView') {
            selectors.shoppingListContainer.classList.remove('hidden');
            renderShoppingList();
        }
    }

    function renderCategories() {
        selectors.categoriesContainer.innerHTML = '';
        const filteredItems = filterItems();

        const groupedItems = filteredItems.reduce((acc, item) => {
            (acc[item.room] = acc[item.room] || []).push(item);
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
        const li = document.createElement('li');
        li.className = 'item-card';
        if (item.status) {
            li.classList.add(item.status);
        }
        li.innerHTML = `
            <img src="${item.photo || 'https://via.placeholder.com/60'}" class="item-photo" alt="${item.name}">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-details">
                    Quantité: ${item.quantity || 'N/A'} - 
                    ${item.type === 'food' ? `Expire le: ${item.expiry || 'N/A'}` : `Pièce: ${rooms[item.room]}`}
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
        const expiringItems = state.items.filter(item => {
            if (!item.expiry) return false;
            const expiryDate = new Date(item.expiry);
            const today = new Date();
            const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7;
        }).length;
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
        
        const stats = {};
        state.items.forEach(item => {
            const key = `${item.room}-${item.type}`;
            if (!stats[key]) {
                stats[key] = {
                    count: 0,
                    room: rooms[item.room],
                    type: types[item.type],
                    lowStock: 0,
                    expired: 0,
                    expiring: 0,
                };
            }
            stats[key].count++;
            const quantity = parseInt(item.quantity);
            const threshold = parseInt(item.threshold);
            if (!isNaN(quantity) && !isNaN(threshold) && quantity <= threshold) {
                stats[key].lowStock++;
            }
            if (item.status === 'expired') {
                stats[key].expired++;
            }
            if (item.status === 'expiring') {
                stats[key].expiring++;
            }
        });
        
        for (const key in stats) {
            const s = stats[key];
            const card = document.createElement('div');
            card.className = 'stat-card';
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
    
    function renderShoppingList() {
        const shoppingListEl = document.getElementById('shoppingList');
        shoppingListEl.innerHTML = '';
        
        const lowStockItems = state.items.filter(item => {
            const quantity = parseInt(item.quantity);
            const threshold = parseInt(item.threshold);
            return !isNaN(quantity) && !isNaN(threshold) && quantity <= threshold;
        });
        
        if (lowStockItems.length === 0) {
            shoppingListEl.innerHTML = '<p>Votre stock est complet ! Aucune suggestion pour le moment.</p>';
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

    // --- Logique des événements ---
    function addEventListeners() {
        // Thème
        selectors.themeToggle.addEventListener('click', toggleTheme);

        // Modale
        selectors.addItemBtn.addEventListener('click', () => showModal());
        selectors.cancelBtn.addEventListener('click', () => hideModal());
        window.addEventListener('click', (event) => {
            if (event.target === selectors.addItemModal) {
                hideModal();
            }
        });

        // Formulaire
        selectors.itemForm.addEventListener('submit', handleFormSubmit);
        selectors.itemType.addEventListener('change', (e) => {
            selectors.expiryGroup.style.display = e.target.value === 'food' ? 'block' : 'none';
        });
        selectors.itemPhotoInput.addEventListener('change', handlePhotoUpload);
        selectors.clearPhotoBtn.addEventListener('click', clearPhoto);

        // Filtrage et recherche
        selectors.searchBar.addEventListener('input', handleSearch);
        selectors.roomFilter.addEventListener('change', renderCategories);
        selectors.typeFilter.addEventListener('change', renderCategories);
        selectors.expiryFilter.addEventListener('change', renderCategories);

        // Vues
        selectors.mapViewBtn.addEventListener('click', () => displayView('mapView'));
        selectors.listViewBtn.addEventListener('click', () => displayView('listView'));
        selectors.statsViewBtn.addEventListener('click', () => displayView('statsView'));

        // Actions
        selectors.categoriesContainer.addEventListener('click', handleItemActions);
        selectors.categoriesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-item-btn')) {
                const room = e.target.dataset.room;
                showModal(room);
            }
        });
        selectors.generateListBtn.addEventListener('click', () => displayView('shoppingListView'));

        // Exporter/Importer
        selectors.exportBtn.addEventListener('click', exportData);
        selectors.importBtn.addEventListener('click', importData);
    }
    
    function handleSearch() {
        const searchTerm = selectors.searchBar.value.toLowerCase();
        const filteredItems = state.items.filter(item => 
            item.name.toLowerCase().includes(searchTerm) ||
            item.location.toLowerCase().includes(searchTerm) ||
            item.notes.toLowerCase().includes(searchTerm)
        );
        
        // Gérer les suggestions
        if (searchTerm.length > 2) {
            selectors.searchSuggestions.innerHTML = '';
            selectors.searchSuggestions.classList.remove('hidden');
            filteredItems.slice(0, 5).forEach(item => {
                const div = document.createElement('div');
                div.textContent = `${item.name} (${rooms[item.room]})`;
                div.addEventListener('click', () => {
                    selectors.searchBar.value = item.name;
                    selectors.searchSuggestions.classList.add('hidden');
                    renderCategories();
                });
                selectors.searchSuggestions.appendChild(div);
            });
        } else {
            selectors.searchSuggestions.classList.add('hidden');
        }
        
        // Rendre les catégories après la recherche
        renderCategories();
    }

    function handleFormSubmit(event) {
        event.preventDefault();
        const newItem = {
            name: document.getElementById('itemName').value,
            type: selectors.itemType.value,
            room: document.getElementById('roomSelect').value,
            barcode: document.getElementById('itemBarcode').value,
            quantity: document.getElementById('itemQuantity').value,
            location: document.getElementById('itemLocation').value,
            expiry: document.getElementById('itemExpiry').value,
            threshold: document.getElementById('itemThreshold').value,
            photo: selectors.photoPreview.src,
            notes: document.getElementById('itemNotes').value,
            id: state.isEditing ? state.editItemId : Date.now().toString(),
        };
        
        updateItemStatus(newItem);

        if (state.isEditing) {
            const itemIndex = state.items.findIndex(item => item.id === state.editItemId);
            if (itemIndex > -1) {
                state.items[itemIndex] = newItem;
            }
        } else {
            state.items.push(newItem);
        }

        saveState();
        hideModal();
        renderAll();
    }

    function handleItemActions(e) {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('delete-btn')) {
            if (confirm("Êtes-vous sûr de vouloir supprimer cet article ?")) {
                state.items = state.items.filter(item => item.id !== id);
                saveState();
                renderAll();
            }
        } else if (target.classList.contains('edit-btn')) {
            const itemToEdit = state.items.find(item => item.id === id);
            if (itemToEdit) {
                state.isEditing = true;
                state.editItemId = id;
                showModal(null, itemToEdit);
            }
        }
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

    // --- Fonctions utilitaires ---
    function showModal(room = null, item = null) {
        selectors.addItemModal.style.display = 'flex';
        selectors.itemForm.reset();
        selectors.photoPreview.style.display = 'none';
        selectors.expiryGroup.style.display = 'none';
        selectors.itemForm.querySelector('#itemId').value = '';
        state.isEditing = false;
        
        if (item) {
            selectors.addItemBtn.textContent = 'Modifier';
            document.getElementById('modalTitle').textContent = '✏️ Modifier un article';
            document.getElementById('itemName').value = item.name;
            document.getElementById('roomSelect').value = item.room;
            selectors.itemType.value = item.type;
            document.getElementById('itemBarcode').value = item.barcode;
            document.getElementById('itemQuantity').value = item.quantity;
            document.getElementById('itemLocation').value = item.location;
            document.getElementById('itemExpiry').value = item.expiry;
            document.getElementById('itemThreshold').value = item.threshold;
            document.getElementById('itemNotes').value = item.notes;
            selectors.itemForm.querySelector('#itemId').value = item.id;
            
            if (item.photo) {
                selectors.photoPreview.src = item.photo;
                selectors.photoPreview.style.display = 'block';
            }
            if (item.type === 'food') {
                selectors.expiryGroup.style.display = 'block';
            }
            state.isEditing = true;
        } else {
            document.getElementById('modalTitle').textContent = '✨ Ajouter un article';
            selectors.addItemBtn.textContent = 'Ajouter';
            if (room) {
                document.getElementById('roomSelect').value = room;
            }
        }
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
            const matchSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm) ||
                                (item.location && item.location.toLowerCase().includes(searchTerm)) ||
                                (item.notes && item.notes.toLowerCase().includes(searchTerm));
            const matchExpiry = !expiry || item.status === expiry;
            
            return matchRoom && matchType && matchSearch && matchExpiry;
        });
    }

    function updateItemStatus(item) {
        if (item.type === 'food' && item.expiry) {
            const today = new Date();
            const expiryDate = new Date(item.expiry);
            const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
                item.status = 'expired';
            } else if (diffDays <= 7) {
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
        if (savedTheme) {
            document.body.classList.add(savedTheme);
            selectors.themeToggle.textContent = savedTheme === 'dark-theme' ? '☀️' : '🌙';
        }
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark-theme' : '');
        selectors.themeToggle.textContent = isDark ? '☀️' : '🌙';
    }

    init();
});