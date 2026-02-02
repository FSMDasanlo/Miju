document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN DE FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyDCfhS1tgrQrdlBSLRw8WtXaI6a--xyWm0",
        authDomain: "miju-d79ce.firebaseapp.com",
        projectId: "miju-d79ce",
        storageBucket: "miju-d79ce.firebasestorage.app",
        messagingSenderId: "982594739405",
        appId: "1:982594739405:web:150d302d4cddb99c075d84",
        measurementId: "G-6S3L4RTVC9"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();
    const playersCollection = db.collection('jugadores');

    // --- REFERENCIAS DEL DOM ---
    const addPlayerForm = document.getElementById('add-player-form');
    const playerNameInput = document.getElementById('player-name');
    const playerEmailInput = document.getElementById('player-email');
    const playersList = document.getElementById('players-list');
    
    let editingPlayerId = null; // Variable para saber si estamos editando
    const submitBtn = addPlayerForm.querySelector('button');
    const originalSubmitText = submitBtn ? submitBtn.textContent : 'Añadir';
    
    // Inyectar campo de teléfono si no existe (ya que no editamos el HTML directamente)
    let playerPhoneInput = document.getElementById('player-phone');
    if (!playerPhoneInput && playerEmailInput) {
        playerPhoneInput = document.createElement('input');
        playerPhoneInput.type = 'tel';
        playerPhoneInput.id = 'player-phone';
        playerPhoneInput.placeholder = 'Teléfono (con prefijo)';
        playerEmailInput.parentNode.insertBefore(playerPhoneInput, playerEmailInput.nextSibling);
    }

    // Inyectar campo de Foto (URL)
    let playerPhotoInput = document.getElementById('player-photo');
    if (!playerPhotoInput && playerEmailInput) {
        playerPhotoInput = document.createElement('input');
        playerPhotoInput.type = 'url';
        playerPhotoInput.id = 'player-photo';
        playerPhotoInput.placeholder = 'URL Foto';
        // Insertar después del teléfono si existe, si no después del email
        const refNode = playerPhoneInput ? playerPhoneInput.nextSibling : playerEmailInput.nextSibling;
        playerEmailInput.parentNode.insertBefore(playerPhotoInput, refNode);
    }

    // Inyectar botón de Cancelar Edición
    let cancelBtn = document.getElementById('btn-cancel-edit');
    if (!cancelBtn && submitBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-cancel-edit';
        cancelBtn.textContent = '✖';
        cancelBtn.title = 'Cancelar edición';
        cancelBtn.type = 'button';
        cancelBtn.style.display = 'none'; // Oculto por defecto
        cancelBtn.style.background = '#555';
        cancelBtn.style.color = '#fff';
        cancelBtn.style.border = 'none';
        cancelBtn.style.padding = '0 15px';
        cancelBtn.style.borderRadius = '5px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.marginLeft = '5px';
        
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
        
        cancelBtn.addEventListener('click', () => {
            resetForm();
        });
    }

    // --- FUNCIONES ---

    const resetForm = () => {
        addPlayerForm.reset();
        editingPlayerId = null;
        if (submitBtn) submitBtn.textContent = originalSubmitText;
        if (cancelBtn) cancelBtn.style.display = 'none';
    };

    /**
     * Obtiene los jugadores de Firestore y los muestra en la lista.
     */
    const renderPlayers = async () => {
        playersList.innerHTML = ''; // Limpiar la lista antes de renderizar

        try {
            const snapshot = await playersCollection.orderBy('name').get();

            if (snapshot.empty) {
                playersList.innerHTML = '<li class="info-item">No hay jugadores registrados.</li>';
                return;
            }

            snapshot.forEach(doc => {
                const player = doc.data();
                const li = document.createElement('li');
                
                li.innerHTML = `
                    <div style="display: flex; align-items: center; flex-grow: 1;">
                        ${player.photo ? `<img src="${player.photo}" class="player-avatar-small" onerror="this.style.display='none'">` : ''}
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: bold;">${player.name}</span>
                            <span style="font-size: 0.8rem; color: #aaa;">${player.email || ''} ${player.phone ? ' | 📞 ' + player.phone : ''}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-icon-small btn-edit-player" title="Editar">✏️</button>
                        <button class="btn-icon-small btn-danger btn-delete-player" title="Eliminar">🗑️</button>
                    </div>
                `;

                // Evento Editar
                li.querySelector('.btn-edit-player').addEventListener('click', () => {
                    editingPlayerId = doc.id;
                    playerNameInput.value = player.name;
                    playerEmailInput.value = player.email || '';
                    if (playerPhoneInput) playerPhoneInput.value = player.phone || '';
                    if (playerPhotoInput) playerPhotoInput.value = player.photo || '';
                    
                    if (submitBtn) submitBtn.textContent = 'Guardar';
                    if (cancelBtn) cancelBtn.style.display = 'block';
                    playerNameInput.focus();
                });

                // Evento para eliminar
                li.querySelector('.btn-delete-player').addEventListener('click', async () => {
                    if (confirm(`¿Eliminar a ${player.name}?`)) {
                        await playersCollection.doc(doc.id).delete();
                        renderPlayers(); // Recargar la lista
                    }
                });

                playersList.appendChild(li);
            });
        } catch (error) {
            console.error("Error al obtener jugadores: ", error);
            if (error.code === 'permission-denied') {
                playersList.innerHTML = '<li class="error-item" style="color: #ff5555;">Faltan permisos en Firebase (Revisa las Reglas).</li>';
            } else {
                playersList.innerHTML = '<li class="error-item">Error al cargar los jugadores.</li>';
            }
        }
    };

    // --- EVENT LISTENERS ---

    // Añadir un nuevo jugador
    addPlayerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const playerName = playerNameInput.value.trim();
        const playerEmail = playerEmailInput.value.trim();
        const playerPhone = playerPhoneInput ? playerPhoneInput.value.trim() : '';
        const playerPhoto = playerPhotoInput ? playerPhotoInput.value.trim() : '';

        if (playerName) {
            // Verificar si el nombre ya existe
            const snapshot = await playersCollection.where('name', '==', playerName).get();
            
            if (!snapshot.empty) {
                // Si estamos editando, el duplicado es válido solo si es otro ID distinto al actual
                if (editingPlayerId) {
                    const duplicate = snapshot.docs.find(doc => doc.id !== editingPlayerId);
                    if (duplicate) {
                        alert(`El nombre "${playerName}" ya está en uso por otro jugador.\nPor favor, elige otro.`);
                        return;
                    }
                } else {
                    // Si es nuevo y existe, es duplicado
                    alert(`El nombre "${playerName}" ya existe.\nPor favor, elige otro.`);
                    return;
                }
            }

            const playerData = {
                name: playerName,
                email: playerEmail,
                phone: playerPhone,
                photo: playerPhoto
            };

            if (editingPlayerId) {
                // MODO EDICIÓN
                await playersCollection.doc(editingPlayerId).update(playerData);
            } else {
                // MODO CREACIÓN
                await playersCollection.add(playerData);
            }
            
            resetForm();
            renderPlayers(); // Volver a renderizar la lista actualizada
        }
    });

    // Carga inicial de jugadores al entrar en la página
    renderPlayers();
});