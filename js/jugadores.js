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

    // Inyectar campo de Foto (URL) con botón de subida
    let playerPhotoInput = document.getElementById('player-photo');
    if (!playerPhotoInput && playerEmailInput) {
        // Contenedor para agrupar input y botón
        const photoContainer = document.createElement('div');
        photoContainer.style.display = 'flex';
        photoContainer.style.gap = '5px';

        playerPhotoInput = document.createElement('input');
        playerPhotoInput.type = 'url';
        playerPhotoInput.id = 'player-photo';
        playerPhotoInput.placeholder = 'URL Foto (o sube una)';
        playerPhotoInput.style.flexGrow = '1';

        // Input file oculto y botón
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        const uploadBtn = document.createElement('button');
        uploadBtn.type = 'button';
        uploadBtn.innerHTML = '📁';
        uploadBtn.title = "Subir imagen";
        uploadBtn.className = 'btn-secondary';
        uploadBtn.style.padding = '0 10px';
        uploadBtn.style.cursor = 'pointer';

        uploadBtn.addEventListener('click', () => {
            if (typeof firebase.storage !== 'function') {
                alert("⚠️ Para subir fotos necesitas habilitar Firebase Storage.\n\nAsegúrate de incluir el script de storage en tu HTML:\n<script src='https://www.gstatic.com/firebasejs/9.6.7/firebase-storage-compat.js'></script>");
                return;
            }
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            uploadBtn.innerHTML = '⏳';
            uploadBtn.disabled = true;
            try {
                const storageRef = firebase.storage().ref();
                const fileRef = storageRef.child(`jugadores/${Date.now()}_${file.name}`);
                await fileRef.put(file);
                const url = await fileRef.getDownloadURL();
                playerPhotoInput.value = url;
                uploadBtn.innerHTML = '✅';
            } catch (error) {
                console.error(error);
                alert("Error al subir imagen.");
                uploadBtn.innerHTML = '❌';
            } finally {
                setTimeout(() => { uploadBtn.disabled = false; uploadBtn.innerHTML = '📁'; }, 3000);
            }
        });

        photoContainer.appendChild(playerPhotoInput);
        photoContainer.appendChild(uploadBtn);
        photoContainer.appendChild(fileInput);

        // Insertar después del teléfono si existe, si no después del email
        const refNode = playerPhoneInput ? playerPhoneInput.nextSibling : playerEmailInput.nextSibling;
        playerEmailInput.parentNode.insertBefore(photoContainer, refNode);
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

    // --- MEJORA DE INTERFAZ (REDISEÑO) ---
    
    // 1. Agrupar botones en un contenedor para el Grid
    // Esto evita que los botones sean celdas gigantes en el grid
    if (submitBtn && addPlayerForm) {
        const actionGroup = document.createElement('div');
        actionGroup.className = 'form-actions-group';
        // Movemos los botones dentro de este grupo
        addPlayerForm.appendChild(actionGroup);
        actionGroup.appendChild(submitBtn);
        if (cancelBtn) actionGroup.appendChild(cancelBtn);
    }

    // 2. Ocultar el formulario inicialmente y ponerle título
    const formContainer = addPlayerForm.closest('.form-container') || addPlayerForm.parentElement;
    if (formContainer) {
        formContainer.classList.add('hidden');
        
        // Añadir un título bonito al formulario si no lo tiene
        if (!formContainer.querySelector('h2')) {
            const formTitle = document.createElement('h2');
            formTitle.textContent = "Nuevo Jugador";
            formTitle.style.color = "#00ffff";
            formTitle.style.borderBottom = "1px solid #333";
            formTitle.style.paddingBottom = "10px";
            formContainer.insertBefore(formTitle, addPlayerForm);
        }
    }

    // 3. Inyectar botón "+" en la cabecera de la lista
    const listContainer = playersList.closest('.list-container') || playersList.parentElement;
    if (listContainer) {
        // Buscamos el H2 existente o creamos uno
        let listHeader = listContainer.querySelector('h2');
        if (!listHeader) {
            listHeader = document.createElement('h2');
            listHeader.textContent = "Jugadores Registrados";
            listContainer.insertBefore(listHeader, playersList);
        }

        // Crear el botón "+"
        const btnShowAdd = document.createElement('button');
        btnShowAdd.innerHTML = '➕';
        btnShowAdd.className = 'btn-icon-medium'; // Reutilizamos estilo
        btnShowAdd.style.background = 'linear-gradient(90deg, #00ffff, #0077ff)';
        btnShowAdd.style.border = 'none';
        btnShowAdd.style.color = '#000';
        btnShowAdd.style.fontWeight = 'bold';
        btnShowAdd.style.marginLeft = '15px';
        btnShowAdd.style.display = 'inline-flex';
        btnShowAdd.title = "Añadir Nuevo Jugador";

        // Ajustar el header para que quepan el texto y el botón
        listHeader.style.display = 'flex';
        listHeader.style.alignItems = 'center';
        listHeader.appendChild(btnShowAdd);

        // --- BUSCADOR EN TIEMPO REAL ---
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '🔍 Buscar jugador...';
        searchInput.style.width = '100%';
        searchInput.style.padding = '10px';
        searchInput.style.marginBottom = '15px';
        searchInput.style.marginTop = '10px';
        searchInput.style.background = 'rgba(255, 255, 255, 0.05)';
        searchInput.style.border = '1px solid #333';
        searchInput.style.borderRadius = '5px';
        searchInput.style.color = '#fff';
        
        listContainer.insertBefore(searchInput, playersList);

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = playersList.querySelectorAll('li');
            items.forEach(li => {
                const text = li.textContent.toLowerCase();
                li.style.display = text.includes(term) ? '' : 'none';
            });
        });

        // Evento para mostrar/ocultar formulario
        btnShowAdd.addEventListener('click', () => {
            formContainer.classList.toggle('hidden');
            if (!formContainer.classList.contains('hidden')) {
                // Pequeña animación y foco
                formContainer.animate([
                    { opacity: 0, transform: 'translateY(-10px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { duration: 300 });
                playerNameInput.focus();
            }
        });
    }

    // --- FUNCIONES ---

    const resetForm = () => {
        addPlayerForm.reset();
        editingPlayerId = null;
        if (submitBtn) submitBtn.textContent = originalSubmitText;
        if (cancelBtn) cancelBtn.style.display = 'none';
        // Opcional: Ocultar formulario al cancelar/resetear si se prefiere
        // formContainer.classList.add('hidden'); 
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

                    // Mostrar el formulario si está oculto
                    if (formContainer) {
                        formContainer.classList.remove('hidden');
                        formContainer.scrollIntoView({ behavior: 'smooth' });
                    }
                    
                    playerNameInput.focus();
                });

                // Evento para eliminar
                li.querySelector('.btn-delete-player').addEventListener('click', async () => {
                    if (confirm(`¿Eliminar a ${player.name}?`)) {
                        // Si tiene foto y está en Firebase Storage, la borramos para ahorrar espacio
                        if (player.photo && player.photo.includes('firebasestorage') && typeof firebase.storage === 'function') {
                            try {
                                await firebase.storage().refFromURL(player.photo).delete();
                            } catch (err) {
                                console.warn("No se pudo borrar la imagen asociada:", err);
                            }
                        }

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
                alert("¡Jugador actualizado correctamente!");
            } else {
                // MODO CREACIÓN
                await playersCollection.add(playerData);
                alert("¡Jugador añadido con éxito!");
            }
            
            resetForm();
            // Cerrar formulario automáticamente
            if (formContainer) formContainer.classList.add('hidden');
            renderPlayers(); // Volver a renderizar la lista actualizada
        }
    });

    // Carga inicial de jugadores al entrar en la página
    renderPlayers();
});