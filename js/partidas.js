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

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const gamesCollection = db.collection('partidas');
    const playersCollection = db.collection('jugadores');

    let currentModalGameId = null; // Para saber qué partida estamos editando en el modal

    // --- REFERENCIAS DOM ---
    const btnShowCreate = document.getElementById('btn-show-create');
    const createContainer = document.getElementById('create-game-container');
    const createForm = document.getElementById('create-game-form');
    const btnCancelCreate = document.getElementById('btn-cancel-create');
    const gamesListContainer = document.getElementById('games-list');
    
    // Modal
    const modal = document.getElementById('game-modal');
    const closeModal = document.querySelector('.close-modal');
    const modalRef = document.getElementById('modal-ref');
    const modalStatus = document.getElementById('modal-status');
    const modalDate = document.getElementById('modal-date');
    const modalPlayersList = document.getElementById('modal-players-list');
    const modalPlayersCount = document.getElementById('modal-players-count');
    const modalObs = document.getElementById('modal-obs');
    const btnModalAdd = document.getElementById('btn-modal-add');
    const btnModalDeleteGame = document.getElementById('btn-modal-delete-game');
    const addPlayerSelectContainer = document.getElementById('add-player-select-container');
    const modalPlayerSelect = document.getElementById('modal-player-select');
    const btnConfirmAdd = document.getElementById('btn-confirm-add');
    const btnCancelAdd = document.getElementById('btn-cancel-add');
    const btnHeaderQr = document.getElementById('btn-header-qr');
    const qrDisplay = document.getElementById('qr-display');
    const qrImage = document.getElementById('qr-image');
    const gameLinkText = document.getElementById('game-link-text');

    // --- FUNCIONES ---

    // Renderizar lista de partidas
    const renderGames = async () => {
        gamesListContainer.innerHTML = '<p class="loading-text">Actualizando lista...</p>';
        
        try {
            // Obtenemos las últimas 10 partidas ordenadas por fecha de creación
            const snapshot = await gamesCollection
                .orderBy('fechaCreacion', 'desc')
                .limit(10)
                .get();

            gamesListContainer.innerHTML = '';

            if (snapshot.empty) {
                gamesListContainer.innerHTML = '<p class="info-text">No hay partidas creadas aún.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const game = doc.data();
                game.id = doc.id; // Guardamos el ID del documento para poder usarlo luego
                // Manejo seguro de la fecha por si acaso viene nula (latencia de servidor)
                const date = game.fechaCreacion ? game.fechaCreacion.toDate().toLocaleDateString() : 'Procesando...';
                
                // Crear tarjeta de partida
                const card = document.createElement('div');
                card.className = `game-card status-${game.estado}`;
                card.innerHTML = `
                    <div class="game-card-header">
                        <span class="game-ref">${game.referencia}</span>
                        <span class="status-dot" title="${game.estado}"></span>
                    </div>
                    <div class="game-card-info">
                        <span>${date}</span>
                        <span>${game.jugadores ? game.jugadores.length : 0} Jugadores</span>
                        <button class="btn-add-player" title="Añadir Jugador Rápido">+</button>
                    </div>
                `;
                
                // Click para ver detalles
                card.addEventListener('click', (e) => {
                    // Si pulsamos en el botón de añadir, no abrimos el modal de detalles
                    if (e.target.closest('.btn-add-player')) return;
                    openModal(game);
                });

                // Lógica del botón de añadir jugador rápido
                const btnAdd = card.querySelector('.btn-add-player');
                btnAdd.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Evita que el click llegue a la tarjeta
                    const name = prompt(`Añadir jugador a "${game.referencia}":\n\nIntroduce el nombre:`);
                    
                    if (name && name.trim() !== "") {
                        try {
                            await gamesCollection.doc(doc.id).update({
                                jugadores: firebase.firestore.FieldValue.arrayUnion({ name: name.trim() })
                            });
                            renderGames(); // Recargamos la lista para ver el cambio
                        } catch (error) {
                            console.error("Error al añadir jugador:", error);
                            alert("No se pudo añadir el jugador. Revisa los permisos o la conexión.");
                        }
                    }
                });

                gamesListContainer.appendChild(card);
            });

        } catch (error) {
            console.error("Error cargando partidas:", error);
            if (error.code === 'permission-denied') {
                gamesListContainer.innerHTML = '<p class="error-text" style="color: #ff5555;">Error de permisos: Revisa las Reglas en Firebase Console.</p>';
            } else {
                gamesListContainer.innerHTML = '<p class="error-text">Error al cargar datos.</p>';
            }
        }
    };

    // Abrir Modal con detalles
    const openModal = (game) => {
        currentModalGameId = game.id; // Guardamos el ID actual
        modalRef.textContent = game.referencia;
        modalStatus.textContent = game.estado;
        modalStatus.className = `status-badge status-${game.estado}`;
        modalDate.textContent = game.fechaCreacion ? game.fechaCreacion.toDate().toLocaleString() : 'Pendiente';
        modalObs.textContent = game.observaciones || "Sin observaciones.";
        
        // Reseteamos la vista del QR cada vez que abrimos el modal
        qrDisplay.classList.add('hidden');
        addPlayerSelectContainer.classList.add('hidden'); // Ocultar selector al abrir
        
        // Listar jugadores
        modalPlayersList.innerHTML = '';
        const players = game.jugadores || [];
        modalPlayersCount.textContent = players.length;
        
        if (players.length === 0) {
            modalPlayersList.innerHTML = '<li>No hay jugadores apuntados.</li>';
        } else {
            players.forEach(player => {
                const li = document.createElement('li');
                li.className = 'player-item';
                
                // Asumimos que guardaremos el nombre o un objeto con nombre
                const playerName = typeof player === 'object' ? player.name : player;
                
                li.innerHTML = `
                    <span>${playerName}</span>
                    <button class="btn-delete-player" title="Eliminar">🗑️</button>
                `;

                // Lógica para eliminar este jugador
                li.querySelector('.btn-delete-player').addEventListener('click', async () => {
                    if (confirm(`¿Eliminar a ${playerName} de esta partida?`)) {
                        try {
                            // arrayRemove necesita el objeto exacto
                            await gamesCollection.doc(currentModalGameId).update({
                                jugadores: firebase.firestore.FieldValue.arrayRemove(player)
                            });
                            refreshModal(); // Recargar datos del modal
                        } catch (error) {
                            console.error("Error al eliminar:", error);
                            alert("Error al eliminar jugador.");
                        }
                    }
                });

                modalPlayersList.appendChild(li);
            });
        }

        modal.classList.remove('hidden');
    };

    // Función auxiliar para recargar el modal tras cambios (añadir/borrar)
    const refreshModal = async () => {
        if (!currentModalGameId) return;
        const doc = await gamesCollection.doc(currentModalGameId).get();
        if (doc.exists) {
            const game = doc.data();
            game.id = doc.id;
            openModal(game); // Re-renderizar modal
            renderGames(); // Actualizar también la lista de fondo
        }
    };

    // --- EVENT LISTENERS ---

    // Mostrar/Ocultar formulario
    btnShowCreate.addEventListener('click', () => {
        createContainer.classList.remove('hidden');
        btnShowCreate.classList.add('hidden');
    });

    btnCancelCreate.addEventListener('click', () => {
        createContainer.classList.add('hidden');
        btnShowCreate.classList.remove('hidden');
        createForm.reset();
    });

    // Crear Partida
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newGame = {
            referencia: document.getElementById('game-ref').value,
            estado: document.getElementById('game-status').value,
            tiempoPregunta: parseInt(document.getElementById('game-time').value) || 10,
            cantidadPreguntas: parseInt(document.getElementById('game-questions-qty').value) || 10,
            observaciones: document.getElementById('game-obs').value,
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
            jugadores: [] // Array vacío inicial
        };

        try {
            await gamesCollection.add(newGame);
            createForm.reset();
            createContainer.classList.add('hidden');
            btnShowCreate.classList.remove('hidden');
            renderGames(); // Recargar lista
        } catch (error) {
            console.error("Error creando partida:", error);
            if (error.code === 'permission-denied') {
                alert("Error de permisos: No tienes acceso para escribir en la base de datos. Revisa las Reglas de Firebase.");
            } else {
                alert("Error al crear la partida.");
            }
        }
    });

    // Cerrar modal
    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Botón Añadir Jugador (Dentro del Modal)
    btnModalAdd.addEventListener('click', async () => {
        // Mostrar el selector
        addPlayerSelectContainer.classList.remove('hidden');
        modalPlayerSelect.innerHTML = '<option>Cargando...</option>';

        try {
            // 1. Obtener todos los jugadores disponibles
            const playersSnapshot = await playersCollection.orderBy('name').get();
            
            // 2. Obtener la partida actual para filtrar los que ya están
            const gameDoc = await gamesCollection.doc(currentModalGameId).get();
            const gameData = gameDoc.data();
            const currentPlayers = (gameData.jugadores || []).map(p => typeof p === 'object' ? p.name : p);

            modalPlayerSelect.innerHTML = '';
            
            if (playersSnapshot.empty) {
                modalPlayerSelect.innerHTML = '<option value="">No hay jugadores registrados</option>';
                return;
            }

            let count = 0;
            playersSnapshot.forEach(doc => {
                const p = doc.data();
                // Solo mostramos si no está ya en la partida
                if (!currentPlayers.includes(p.name)) {
                    const option = document.createElement('option');
                    option.value = p.name;
                    option.textContent = p.name;
                    modalPlayerSelect.appendChild(option);
                    count++;
                }
            });

            if (count === 0) {
                modalPlayerSelect.innerHTML = '<option value="">Todos los jugadores ya están apuntados</option>';
            }

        } catch (error) {
            console.error("Error cargando jugadores:", error);
            modalPlayerSelect.innerHTML = '<option>Error al cargar lista</option>';
        }
    });

    // Confirmar añadir jugador desde el selector
    btnConfirmAdd.addEventListener('click', async () => {
        const name = modalPlayerSelect.value;
        if (name && name.trim() !== "") {
            try {
                await gamesCollection.doc(currentModalGameId).update({
                    jugadores: firebase.firestore.FieldValue.arrayUnion({ name: name.trim() })
                });
                addPlayerSelectContainer.classList.add('hidden'); // Ocultar tras añadir
                refreshModal();
            } catch (error) {
                console.error("Error añadiendo jugador:", error);
                alert("Error al añadir jugador.");
            }
        }
    });

    // Cancelar añadir
    btnCancelAdd.addEventListener('click', () => {
        addPlayerSelectContainer.classList.add('hidden');
    });

    // Botón Eliminar Partida (Dentro del Modal)
    btnModalDeleteGame.addEventListener('click', async () => {
        if (confirm("¡PELIGRO!\n\n¿Estás seguro de que quieres ELIMINAR esta partida por completo?\nEsta acción no se puede deshacer.")) {
            try {
                await gamesCollection.doc(currentModalGameId).delete();
                modal.classList.add('hidden');
                renderGames(); // Recargar lista
            } catch (error) {
                console.error("Error eliminando partida:", error);
                alert("Error al eliminar la partida.");
            }
        }
    });

    // Botón QR en cabecera (Toggle)
    btnHeaderQr.addEventListener('click', () => {
        if (qrDisplay.classList.contains('hidden')) {
            // Generar y mostrar
            const gameUrl = `${window.location.origin}/juego.html?partida=${currentModalGameId}`;
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(gameUrl)}`;
            
            qrImage.src = qrApiUrl;
            gameLinkText.textContent = gameUrl;
            
            qrDisplay.classList.remove('hidden');
        } else {
            // Ocultar
            qrDisplay.classList.add('hidden');
        }
    });

    // Inicializar
    renderGames();
});