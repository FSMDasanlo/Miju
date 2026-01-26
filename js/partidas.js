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
    let currentModalPlayers = []; // Guardamos los jugadores en memoria para el email

    // --- REFERENCIAS DOM ---
    const btnShowCreate = document.getElementById('btn-show-create');
    const createContainer = document.getElementById('create-game-container');
    const createForm = document.getElementById('create-game-form');
    const editGameIdInput = document.getElementById('edit-game-id');
    const btnCancelCreate = document.getElementById('btn-cancel-create');
    const gamesListContainer = document.getElementById('games-list');
    
    // Modal
    const modal = document.getElementById('game-modal');
    const closeModal = document.querySelector('.close-modal');
    const modalRef = document.getElementById('modal-ref');
    const modalStatus = document.getElementById('modal-status');
    const modalDate = document.getElementById('modal-date');
    const modalTime = document.getElementById('modal-time');
    const modalQuestionsQty = document.getElementById('modal-questions-qty');
    const modalPlayerQRule = document.getElementById('modal-player-q-rule');
    const modalSubtractRule = document.getElementById('modal-subtract-rule');
    const modalPausesBox = document.getElementById('modal-pauses-box');
    const modalPausesQty = document.getElementById('modal-pauses-qty');
    const modalPlayersList = document.getElementById('modal-players-list');
    const modalPlayersCount = document.getElementById('modal-players-count');
    const modalObs = document.getElementById('modal-obs');
    const btnModalAdd = document.getElementById('btn-modal-add');
    const btnModalPlay = document.getElementById('btn-modal-play');
    const btnModalDeleteGame = document.getElementById('btn-modal-delete-game');
    const addPlayerSelectContainer = document.getElementById('add-player-select-container');
    const modalPlayerSelect = document.getElementById('modal-player-select');
    const btnCancelAdd = document.getElementById('btn-cancel-add');
    const btnHeaderQr = document.getElementById('btn-header-qr');
    const qrDisplay = document.getElementById('qr-display');
    const qrImage = document.getElementById('qr-image');
    const gameLinkText = document.getElementById('game-link-text');
    const btnSendInvite = document.getElementById('btn-send-invite');
    
    // Referencias Resultados
    const btnViewResults = document.getElementById('btn-view-results');
    const resultsTableModal = document.getElementById('results-table-modal');
    const closeResultsModal = document.getElementById('close-results-modal');
    const resultsTable = document.getElementById('results-table');

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
                
                // Añadir icono si es partida larga
                const longMatchIcon = game.partidaLarga ? '<span title="Partida Larga (Maratón)">🏆</span> ' : '';

                // Crear tarjeta de partida
                const card = document.createElement('div');
                card.className = `game-card status-${game.estado}`;
                card.innerHTML = `
                    <div class="game-card-header">
                        <span class="game-ref">${longMatchIcon}${game.referencia}</span>
                        <span class="status-dot" title="${game.estado}"></span>
                    </div>
                    <div class="game-card-info">
                        <span>${date}</span>
                        <span>${game.jugadores ? game.jugadores.length : 0} Jugadores</span>
                        <button class="btn-clone-game" title="Clonar Partida">📋</button>
                        <button class="btn-edit-game" title="Editar Partida">✏️</button>
                        <button class="btn-delete-game" title="Eliminar Partida">🗑️</button>
                        <button class="btn-add-player" title="Añadir Jugador Rápido">+</button>
                    </div>
                `;
                
                // Click para ver detalles
                card.addEventListener('click', (e) => {
                    // Si pulsamos en botones de acción, no abrimos el modal
                    if (e.target.closest('.btn-add-player') || e.target.closest('.btn-edit-game') || e.target.closest('.btn-clone-game') || e.target.closest('.btn-delete-game')) return;
                    openModal(game);
                });

                // Lógica del botón CLONAR
                const btnClone = card.querySelector('.btn-clone-game');
                btnClone.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`¿Crear una copia de la partida "${game.referencia}"?`)) return;

                    try {
                        // Limpiamos los jugadores para quitar puntuaciones y respuestas antiguas
                        const cleanPlayers = (game.jugadores || []).map(p => {
                            const name = typeof p === 'object' ? p.name : p;
                            return { name: name }; // Solo guardamos el nombre, reseteando lo demás
                        });

                        const newGame = {
                            referencia: `${game.referencia} (Copia)`,
                            estado: 'Abierta', // Forzamos estado abierta
                            tiempoPregunta: game.tiempoPregunta || 15,
                            cantidadPreguntas: game.cantidadPreguntas || 10,
                            preguntasPorJugador: game.preguntasPorJugador || false,
                            erroresRestan: game.erroresRestan || false,
                            observaciones: game.observaciones || '',
                            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                            jugadores: cleanPlayers
                        };

                        await gamesCollection.add(newGame);
                        renderGames(); // Recargar lista
                    } catch (error) {
                        console.error("Error clonando partida:", error);
                        alert("Error al clonar la partida.");
                    }
                });

                // Lógica del botón EDITAR
                const btnEdit = card.querySelector('.btn-edit-game');
                btnEdit.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Rellenar formulario
                    document.getElementById('game-ref').value = game.referencia;
                    document.getElementById('game-time').value = game.tiempoPregunta || 20;
                    document.getElementById('game-questions-qty').value = game.cantidadPreguntas || 10;
                    document.getElementById('game-obs').value = game.observaciones || '';
                    document.getElementById('game-player-questions').checked = game.preguntasPorJugador || false;
                    document.getElementById('game-subtract-errors').checked = game.erroresRestan || false;
                    document.getElementById('game-long-match').checked = game.partidaLarga || false;
                    
                    // Gestión de comodines (compatibilidad con booleanos antiguos)
                    let has50 = true;
                    let hasHint = true;
                    if (typeof game.comodines === 'object' && game.comodines !== null) {
                        has50 = game.comodines.cincuenta;
                        hasHint = game.comodines.pista;
                    } else if (typeof game.comodines === 'boolean') {
                        has50 = game.comodines;
                        hasHint = game.comodines;
                    } else if (game.comodines === undefined) {
                        has50 = false;
                        hasHint = false;
                    }
                    document.getElementById('game-wildcard-50').checked = has50;
                    document.getElementById('game-wildcard-hint').checked = hasHint;
                    
                    editGameIdInput.value = game.id;
                    // Guardamos el estado actual en el dataset para no perderlo al guardar
                    editGameIdInput.dataset.currentStatus = game.estado;

                    // Cambiar interfaz a modo edición
                    document.getElementById('create-form-title').textContent = "Editar Partida";
                    document.getElementById('create-game-submit-btn').textContent = "Guardar Cambios";
                    
                    btnShowCreate.classList.add('hidden');
                    createContainer.classList.remove('hidden');
                    
                    // Aplicar animación de entrada
                    createContainer.animate([
                        { opacity: 0, transform: 'translateY(-20px)' },
                        { opacity: 1, transform: 'translateY(0)' }
                    ], {
                        duration: 400,
                        easing: 'ease-out'
                    });

                    createContainer.scrollIntoView({ behavior: 'smooth' });
                });

                // Lógica del botón ELIMINAR (Lista)
                const btnDelete = card.querySelector('.btn-delete-game');
                btnDelete.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Estás seguro de que quieres ELIMINAR la partida "${game.referencia}"?\nEsta acción no se puede deshacer.`)) {
                        try {
                            await gamesCollection.doc(game.id).delete();
                            renderGames();
                        } catch (error) {
                            console.error("Error eliminando partida:", error);
                            alert("Error al eliminar la partida.");
                        }
                    }
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
        currentModalPlayers = game.jugadores || []; // Guardamos jugadores en memoria
        modalRef.textContent = game.referencia;
        modalStatus.textContent = game.estado;
        modalDate.textContent = game.fechaCreacion ? game.fechaCreacion.toDate().toLocaleString() : 'Pendiente';
        modalTime.textContent = (game.tiempoPregunta || 15) + ' seg';
        modalQuestionsQty.textContent = (game.cantidadPreguntas || 10);
        modalPlayerQRule.textContent = game.preguntasPorJugador ? 'SÍ' : 'NO';
        modalSubtractRule.textContent = game.erroresRestan ? 'SÍ' : 'NO';
        
        // Mostrar comodines
        const wildcardsBox = document.getElementById('modal-wildcards-box');
        const wildcardsRule = document.getElementById('modal-wildcards-rule');
        
        let wText = 'NO';
        if (game.comodines) {
            if (typeof game.comodines === 'object') {
                const arr = [];
                if (game.comodines.cincuenta) arr.push('50%');
                if (game.comodines.pista) arr.push('💡');
                wText = arr.length > 0 ? arr.join(' + ') : 'NO';
            } else {
                wText = 'SÍ (Todos)';
            }
        }
        wildcardsRule.textContent = wText;
        
        // Siempre visible para saber si están activos o no
        wildcardsBox.classList.remove('hidden');

        // Mostrar pausas si es partida larga
        if (game.partidaLarga) {
            modalPausesBox.classList.remove('hidden');
            modalPausesQty.textContent = game.pausasRestantes !== undefined ? game.pausasRestantes : 3;
        } else {
            modalPausesBox.classList.add('hidden');
        }

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

                            // --- CORRECCIÓN: Comprobar si hay que cerrar la partida tras borrar al jugador ---
                            const updatedDoc = await gamesCollection.doc(currentModalGameId).get();
                            if (updatedDoc.exists) {
                                const gData = updatedDoc.data();
                                const remainingPlayers = gData.jugadores || [];
                                const totalQs = gData.cantidadPreguntas || (gData.preguntas ? gData.preguntas.length : 0);

                                // Si quedan jugadores, la partida está 'Jugando' y todos han terminado -> CERRAR
                                if (remainingPlayers.length > 0 && gData.estado === 'Jugando' && totalQs > 0) {
                                    const allFinished = remainingPlayers.every(p => {
                                        const answers = (typeof p === 'object' ? p.respuestas : 0) || 0;
                                        return answers >= totalQs;
                                    });
                                    if (allFinished) {
                                        await gamesCollection.doc(currentModalGameId).update({ estado: 'Cerrada' });
                                    }
                                }
                            }
                            // ---------------------------------------------------------------------------------

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

        // Botón Ver Resultados (Solo si está cerrada)
        if (game.estado === 'Cerrada') {
            btnViewResults.classList.remove('hidden');
        } else {
            btnViewResults.classList.add('hidden');
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
        btnShowCreate.classList.add('hidden');
        createContainer.classList.remove('hidden');
        // Aplicar animación de entrada
        createContainer.animate([
            { opacity: 0, transform: 'translateY(-20px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], {
            duration: 400,
            easing: 'ease-out'
        });
    });

    btnCancelCreate.addEventListener('click', () => {
        createContainer.classList.add('hidden');
        btnShowCreate.classList.remove('hidden');
        
        // Resetear formulario y modo edición
        createForm.reset();
        editGameIdInput.value = '';
        document.getElementById('create-form-title').textContent = "Configurar Nueva Partida";
        document.getElementById('create-game-submit-btn').textContent = "Crear Partida";
    });

    // Crear o Editar Partida
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const editId = editGameIdInput.value;
        let questionsQty = parseInt(document.getElementById('game-questions-qty').value) || 10;
        const isLongMatch = document.getElementById('game-long-match').checked;

        // Validación Partida Larga
        if (isLongMatch && questionsQty < 50) {
            if (confirm("⚠️ Una Partida Larga requiere mínimo 50 preguntas.\n\n¿Quieres ajustar la cantidad a 50 automáticamente?")) {
                questionsQty = 50;
                document.getElementById('game-questions-qty').value = 50;
            } else {
                return; // Cancelar creación
            }
        }

        const gameData = {
            referencia: document.getElementById('game-ref').value,
            // Si editamos, mantenemos el estado. Si es nueva, siempre 'Abierta'.
            estado: editId ? editGameIdInput.dataset.currentStatus : 'Abierta',
            tiempoPregunta: parseInt(document.getElementById('game-time').value) || 20,
            cantidadPreguntas: questionsQty,
            observaciones: document.getElementById('game-obs').value,
            preguntasPorJugador: document.getElementById('game-player-questions').checked,
            erroresRestan: document.getElementById('game-subtract-errors').checked,
            partidaLarga: isLongMatch,
            comodines: {
                cincuenta: document.getElementById('game-wildcard-50').checked,
                pista: document.getElementById('game-wildcard-hint').checked
            }
        };

        // Si es partida larga y nueva, asignamos pausas
        if (isLongMatch && !editId) {
            gameData.pausasRestantes = 3;
        }

        try {
            if (editId) {
                // MODO EDICIÓN
                await gamesCollection.doc(editId).update(gameData);
            } else {
                // MODO CREACIÓN
                // Forzamos estado 'Abierta' y fecha de creación
                gameData.estado = 'Abierta';
                gameData.fechaCreacion = firebase.firestore.FieldValue.serverTimestamp();
                gameData.jugadores = [];
                
                await gamesCollection.add(gameData);
            }

            createForm.reset();
            editGameIdInput.value = '';
            document.getElementById('create-form-title').textContent = "Configurar Nueva Partida";
            document.getElementById('create-game-submit-btn').textContent = "Crear Partida";
            
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

            modalPlayerSelect.innerHTML = '<option value="">-- Seleccionar --</option>';
            
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
                    // Guardamos el email en un atributo de datos para usarlo al añadir
                    if (p.email) option.dataset.email = p.email;
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

    // Añadir jugador al cambiar la selección
    modalPlayerSelect.addEventListener('change', async () => {
        const name = modalPlayerSelect.value;
        const selectedOption = modalPlayerSelect.options[modalPlayerSelect.selectedIndex];
        const email = selectedOption.dataset.email || null;

        if (name && name.trim() !== "") {
            try {
                const playerObj = { name: name.trim() };
                if (email) playerObj.email = email;

                await gamesCollection.doc(currentModalGameId).update({
                    jugadores: firebase.firestore.FieldValue.arrayUnion(playerObj)
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

    // Botón JUGAR (Ir directo a la partida)
    btnModalPlay.addEventListener('click', () => {
        if (currentModalGameId) {
            window.location.href = `juego.html?partida=${currentModalGameId}`;
        }
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
            // Usamos URL relativa para que funcione en GitHub Pages (que incluye el nombre del repo en la ruta)
            const gameUrl = new URL(`juego.html?partida=${currentModalGameId}`, window.location.href).href;
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(gameUrl)}`;
            
            qrImage.src = qrApiUrl;
            gameLinkText.textContent = gameUrl;
            
            qrDisplay.classList.remove('hidden');
        } else {
            // Ocultar
            qrDisplay.classList.add('hidden');
        }
    });

    // Botón Enviar Invitación por Correo
    btnSendInvite.addEventListener('click', () => {
        console.log("--- Iniciando envío de invitación ---");

        // 1. Usamos los datos en memoria (sin await) para no perder el gesto del usuario
        const players = currentModalPlayers;

        console.log("Jugadores en la partida:", players);

        // 2. Filtrar emails
        const emails = [];
        players.forEach(p => {
            if (typeof p === 'object' && p.email) {
                emails.push(p.email);
            } else {
                console.warn("Jugador ignorado (sin email o formato antiguo):", p);
            }
        });

        console.log("Emails válidos encontrados:", emails);

        if (emails.length === 0) {
            alert("⚠️ No se encontraron emails en esta partida.\n\nPosible causa: Los jugadores se añadieron antes de configurar sus correos.\n\nSolución: Elimina al jugador de la partida y vuélvelo a añadir.");
            return;
        }

        // 3. Preparar datos para la invitación
        // Obtenemos los nombres de los jugadores para ponerlos en el correo
        const playerNames = players.map(p => typeof p === 'object' ? p.name : p).join(', ');
        
        // Construimos el enlace a la NUEVA página de invitación (pasamos los nombres por URL para mostrarlos allí también)
        const invitePageUrl = new URL(`invitacion.html?partida=${currentModalGameId}&jugadores=${encodeURIComponent(playerNames)}`, window.location.href).href;
        
        const subject = "Invitación a jugar a MIJU";
        
        // Cuerpo del correo en texto plano (pero con enlace a la web bonita)
        const body = `Hola.\n\nTus amigos (${playerNames}) te están invitando a una partida de MIJU.\n\nHemos preparado una invitación con el código QR y el acceso directo.\n\nPincha aquí para verla y entrar:\n${invitePageUrl}\n\n¡Te esperamos!`;
        
        console.log("Abriendo cliente de correo...");
        const mailtoLink = `mailto:?bcc=${emails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Método robusto: Crear enlace temporal y hacer click
        const link = document.createElement('a');
        link.href = mailtoLink;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Feedback al usuario + Copia al portapapeles (Fallback por si falla la apertura)
        const clipboardText = `ASUNTO: ${subject}\n\nMENSAJE:\n${body}\n\nDESTINATARIOS (CCO):\n${emails.join(', ')}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(clipboardText).then(() => {
                alert("📧 Se está intentando abrir tu programa de correo.\n\n📋 Además, he copiado el mensaje y los destinatarios al portapapeles por si necesitas pegarlos manualmente.");
            }).catch(() => {
                alert("📧 Se está intentando abrir tu programa de correo.");
            });
        } else {
            alert("📧 Se está intentando abrir tu programa de correo.");
        }
    });

    // Botón Ver Resultados Detallados
    btnViewResults.addEventListener('click', async () => {
        // Obtenemos datos frescos de la partida
        const doc = await gamesCollection.doc(currentModalGameId).get();
        if (!doc.exists) return;
        const game = doc.data();
        const players = game.jugadores || [];
        const questions = game.preguntas || [];

        // Construir Tabla
        let html = '<thead><tr><th style="text-align: left; padding: 10px; border-bottom: 2px solid #00ffff;">Pregunta</th>';
        
        // Cabeceras de Jugadores
        players.forEach(p => {
            const name = typeof p === 'object' ? p.name : p;
            html += `<th style="padding: 10px; border-bottom: 2px solid #00ffff; text-align: center;">${name}</th>`;
        });
        html += '</tr></thead><tbody>';

        // Filas de Preguntas
        questions.forEach((q, qIndex) => {
            html += `<tr>
                <td style="padding: 10px; border-bottom: 1px solid #333; max-width: 300px;">
                    <div style="font-weight: bold;">${qIndex + 1}. ${q.texto}</div>
                    <div style="font-size: 0.8rem; color: #aaa;">Correcta: ${q.opciones[q.correcta]}</div>
                </td>`;
            
            players.forEach(p => {
                const pObj = typeof p === 'object' ? p : { name: p, respuestasDetalle: {} };
                const details = pObj.respuestasDetalle || {};
                const answerIndex = details[qIndex]; // Índice de la respuesta dada
                
                let cellContent = '-';
                let cellStyle = 'background: rgba(0,0,0,0.2);'; // Por defecto

                if (answerIndex !== undefined) {
                    const isCorrect = answerIndex === q.correcta;
                    const answerText = q.opciones[answerIndex] || 'Error';
                    
                    if (isCorrect) {
                        cellStyle = 'background: rgba(0, 255, 0, 0.2); color: #00ff00;'; // Verde
                        cellContent = `✅ ${answerText}`;
                    } else {
                        cellStyle = 'background: rgba(128, 128, 128, 0.2); color: #ccc;'; // Gris
                        cellContent = `❌ ${answerText}`;
                    }
                }

                html += `<td style="padding: 10px; border-bottom: 1px solid #333; text-align: center; ${cellStyle}">${cellContent}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';

        resultsTable.innerHTML = html;
        resultsTableModal.classList.remove('hidden');
    });

    // Cerrar modal de resultados
    closeResultsModal.addEventListener('click', () => {
        resultsTableModal.classList.add('hidden');
    });

    // Inicializar
    renderGames();
});