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

    // --- REFERENCIAS DOM ---
    const loginModal = document.getElementById('login-modal');
    const loginSelect = document.getElementById('login-player-select');
    const btnLogin = document.getElementById('btn-login');
    const gameLayout = document.getElementById('game-layout');
    const headerGameRef = document.getElementById('header-game-ref');
    const headerPlayerName = document.getElementById('header-player-name');
    const playersSidebar = document.getElementById('players-sidebar');
    let pauseOverlay = null; // Referencia al overlay de pausa

    // Inyectar botón de "Volver al Menú" en la cabecera
    const gameHeader = document.querySelector('.game-header');
    if (gameHeader && !document.getElementById('btn-exit-game')) {
        const btnExit = document.createElement('button');
        btnExit.id = 'btn-exit-game';
        btnExit.innerHTML = '🏠'; // Icono casa
        btnExit.title = "Volver al Menú Principal";
        // Estilos inline para asegurar que se ve bien sin tocar CSS
        btnExit.style.background = 'transparent';
        btnExit.style.border = '1px solid #00ffff';
        btnExit.style.color = '#00ffff';
        btnExit.style.borderRadius = '50%';
        btnExit.style.width = '40px';
        btnExit.style.height = '40px';
        btnExit.style.fontSize = '1.2rem';
        btnExit.style.cursor = 'pointer';
        btnExit.style.marginRight = '15px';
        
        btnExit.addEventListener('click', () => {
            if (confirm("¿Quieres salir de la partida y volver al menú?")) {
                window.location.href = 'index.html';
            }
        });

        // Insertar al principio del header (a la izquierda del título)
        gameHeader.insertBefore(btnExit, gameHeader.firstChild);
    }
    
    // Nuevas referencias
    const gameActions = document.getElementById('game-actions');
    const btnOpenAddQuestion = document.getElementById('btn-open-add-question');
    const btnStartQuiz = document.getElementById('btn-start-quiz');
    const addQuestionModal = document.getElementById('add-question-modal');
    const closeQuestionModal = document.getElementById('close-question-modal');
    const questionForm = document.getElementById('question-form');
    const quizInterface = document.getElementById('quiz-interface');
    const resultsScreen = document.getElementById('results-screen');
    const rankingList = document.getElementById('ranking-list');

    // --- ESTADO ---
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('partida');
    let currentPlayerName = sessionStorage.getItem(`miju_player_${gameId}`); // Guardamos sesión por partida
    let currentQuestions = []; // Array local de preguntas
    let currentQuestionIndex = 0;
    let isQuizActive = false;
    let gameConfig = {}; // Para guardar la configuración (tiempo, cantidad)
    let timerInterval = null;

    if (!gameId) {
        alert("No se ha especificado una partida.");
        window.location.href = 'index.html';
        return;
    }

    // --- FUNCIONES ---

    // 1. Inicializar el juego (Escuchar cambios en tiempo real)
    const initGame = () => {
        // Ocultar login, mostrar juego
        loginModal.classList.add('hidden');
        gameLayout.classList.remove('hidden');
        
        // Mostrar nombre en cabecera
        headerPlayerName.textContent = currentPlayerName;

        // Escuchar cambios en el documento de la partida (REALTIME)
        db.collection('partidas').doc(gameId).onSnapshot((doc) => {
            if (!doc.exists) {
                alert("La partida ha sido eliminada.");
                window.location.href = 'index.html';
                return;
            }

            const gameData = doc.data();
            gameConfig = gameData; // Guardamos config globalmente

            // GESTIÓN DE PAUSA (Partida Larga)
            if (gameData.partidaLarga) {
                // 1. Inyectar botón de pausa si no existe y tengo pausas disponibles
                if (!document.getElementById('btn-pause-game') && gameData.estado === 'Jugando') {
                    const btnPause = document.createElement('button');
                    btnPause.id = 'btn-pause-game';
                    btnPause.innerHTML = '⏸️';
                    btnPause.title = `Pausar Partida (Restantes: ${gameData.pausasRestantes || 0})`;
                    btnPause.className = 'btn-icon-medium'; // Reutilizamos clase
                    btnPause.style.marginRight = '10px';
                    btnPause.style.border = '1px solid #ffd700';
                    btnPause.style.color = '#ffd700';
                    
                    btnPause.addEventListener('click', async () => {
                        if ((gameData.pausasRestantes || 0) > 0) {
                            if(confirm("¿Pausar la partida para todos los jugadores?")) {
                                await db.collection('partidas').doc(gameId).update({
                                    estado: 'Pausada',
                                    pausasRestantes: (gameData.pausasRestantes || 0) - 1
                                });
                            }
                        } else {
                            alert("No quedan pausas disponibles.");
                        }
                    });
                    // Insertar antes del nombre del jugador
                    const headerRight = document.querySelector('.header-right');
                    headerRight.insertBefore(btnPause, headerRight.firstChild);
                }
            }

            // GESTIÓN DE ESTADO 'PAUSADA'
            if (gameData.estado === 'Pausada') {
                if (!pauseOverlay) {
                    pauseOverlay = document.createElement('div');
                    pauseOverlay.id = 'pause-overlay';
                    pauseOverlay.innerHTML = `
                        <h1 style="color: #ffd700; font-size: 3rem; text-transform: uppercase; animation: pulse 2s infinite;">⏸️ PAUSA</h1>
                        <p style="color: white; margin-top: 20px;">El administrador ha detenido el juego.</p>
                        <button id="btn-resume-game" class="btn action-btn" style="margin-top: 30px; width: auto; background: #ffd700; color: #000;">▶️ REANUDAR</button>
                    `;
                    document.body.appendChild(pauseOverlay);
                    
                    // Botón para reanudar
                    document.getElementById('btn-resume-game').addEventListener('click', async () => {
                        await db.collection('partidas').doc(gameId).update({ estado: 'Jugando' });
                    });
                }
                return; // Detenemos renderizado del juego
            } else {
                // Si ya no está pausada, quitamos el overlay
                if (pauseOverlay && !pauseOverlay.dataset.closing) {
                    pauseOverlay.dataset.closing = "true"; // Evitar múltiples ejecuciones
                    
                    // Cuenta atrás visual
                    let count = 3;
                    pauseOverlay.innerHTML = `<h1 style="color: #00ff00; font-size: 8rem; font-weight: bold; text-shadow: 0 0 20px #00ff00;">${count}</h1>`;
                    
                    const int = setInterval(() => {
                        count--;
                        if (count > 0) {
                            pauseOverlay.innerHTML = `<h1 style="color: #00ff00; font-size: 8rem; font-weight: bold; text-shadow: 0 0 20px #00ff00;">${count}</h1>`;
                        } else {
                            clearInterval(int);
                            pauseOverlay.remove();
                            pauseOverlay = null;
                        }
                    }, 1000);
                }
            }

            // Mostrar u ocultar el botón de añadir pregunta según la regla de la partida
            // Solo en la fase de preparación (cuando game-actions está visible)
            if (!isQuizActive) {
                // Usamos 'display' para evitar conflictos con la clase .hidden
                btnOpenAddQuestion.style.display = gameConfig.preguntasPorJugador ? 'block' : 'none';
            }

            // Si la partida está cerrada, mostrar resultados
            if (gameData.estado === 'Cerrada') {
                showResults(gameData);
                return;
            }

            // Calcular total de preguntas para saber cuándo se termina
            const totalQuestions = gameData.cantidadPreguntas || (gameData.preguntas ? gameData.preguntas.length : 0);

            // Sincronizar índice local con el progreso guardado en BD (BLOQUEO DE SEGURIDAD)
            // Esto evita que si recargas la página puedas volver a responder preguntas ya hechas
            const me = (gameData.jugadores || []).find(p => (typeof p === 'object' ? p.name : p) === currentPlayerName);
            if (me && typeof me.respuestas === 'number') {
                // Si acabamos de entrar (índice 0) y la BD dice que ya llevamos respuestas, actualizamos
                if (currentQuestionIndex === 0 && me.respuestas > 0) {
                    currentQuestionIndex = me.respuestas;
                }
            }

            currentQuestions = gameData.preguntas || [];
            renderHeader(gameData);
            renderSidebar(gameData.jugadores || [], totalQuestions);

            // Detectar si la partida ha empezado (para los jugadores que están esperando)
            if (gameData.estado === 'Jugando') {
                // Si no estábamos jugando, o si ya terminamos (para mostrar pantalla fin), renderizamos
                if (!isQuizActive || currentQuestionIndex >= totalQuestions) {
                    gameActions.classList.add('hidden');
                    quizInterface.classList.remove('hidden');
                    isQuizActive = true;
                    renderQuizQuestion();
                }
            }
        }, (error) => {
            console.error("Error recibiendo actualizaciones:", error);
        });
    };

    // Función para mostrar la pantalla de resultados
    const showResults = (gameData) => {
        loginModal.classList.add('hidden');
        gameLayout.classList.add('hidden');
        resultsScreen.classList.remove('hidden');

        const players = gameData.jugadores || [];
        
        // Ordenar por puntos (descendente)
        players.sort((a, b) => {
            const scoreA = (typeof a === 'object' ? a.puntos : 0) || 0;
            const scoreB = (typeof b === 'object' ? b.puntos : 0) || 0;
            return scoreB - scoreA;
        });

        rankingList.innerHTML = '';
        players.forEach((player, index) => {
            const name = typeof player === 'object' ? player.name : player;
            const score = (typeof player === 'object' ? player.puntos : 0) || 0;
            
            const li = document.createElement('li');
            li.className = `ranking-item ${index === 0 ? 'winner' : ''}`;
            
            let medal = '';
            if (index === 0) medal = '🥇 ';
            else if (index === 1) medal = '🥈 ';
            else if (index === 2) medal = '🥉 ';

            li.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span class="rank-position">${medal}#${index + 1}</span>
                    <span>${name}</span>
                </div>
                <span class="rank-score">${score} pts</span>
            `;
            rankingList.appendChild(li);
        });
    };

    // 2. Renderizar Cabecera
    const renderHeader = (gameData) => {
        headerGameRef.textContent = gameData.referencia;
        document.title = `MiJu - ${gameData.referencia}`;
    };

    // 3. Renderizar Barra Lateral de Jugadores
    const renderSidebar = (players, totalQuestions = 10) => {
        playersSidebar.innerHTML = '';

        // Ordenar: Primero yo, luego el resto alfabéticamente
        players.sort((a, b) => {
            const nameA = typeof a === 'object' ? a.name : a;
            const nameB = typeof b === 'object' ? b.name : b;
            if (nameA === currentPlayerName) return -1;
            if (nameB === currentPlayerName) return 1;
            return nameA.localeCompare(nameB);
        });

        players.forEach(player => {
            const name = typeof player === 'object' ? player.name : player;
            // Si no existe la propiedad respuestas, asumimos 0
            const answersCount = (typeof player === 'object' && player.respuestas) ? player.respuestas : 0;
            const pointsCount = (typeof player === 'object' && player.puntos) ? player.puntos : 0;

            // Lógica de Estado Visual
            let statusIcon = '💤'; // Inactivo / Esperando
            let statusClass = 'status-waiting';

            if (answersCount >= totalQuestions) {
                statusIcon = '🏁'; // Finalizado
                statusClass = 'status-finished';
            } else if (answersCount > 0) {
                statusIcon = '🏃'; // Jugando
                statusClass = 'status-playing';
            }

            const card = document.createElement('div');
            card.className = `sidebar-player-card ${name === currentPlayerName ? 'is-me' : ''} ${statusClass}`;
            
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:5px; overflow:hidden;">
                    <span>${statusIcon}</span>
                    <span class="sidebar-player-name">${name}</span>
                </div>
                <span class="player-score-badge" title="Puntos / Respuestas">${pointsCount} pts</span>
            `;
            playersSidebar.appendChild(card);
        });
    };

    // 4. Cargar lista para el Login
    const loadLoginOptions = async () => {
        try {
            const doc = await db.collection('partidas').doc(gameId).get();
            if (doc.exists) {
                const players = doc.data().jugadores || [];
                loginSelect.innerHTML = '<option value="">-- Selecciona tu nombre --</option>';
                
                players.forEach(player => {
                    const name = typeof player === 'object' ? player.name : player;
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    loginSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error("Error cargando login:", error);
        }
    };

    // 5. Renderizar Pregunta Actual (Quiz)
    const renderQuizQuestion = () => {
        // Limpiar timer anterior si existe
        if (timerInterval) clearInterval(timerInterval);

        // Comprobar límite de preguntas (configurado al crear partida) o fin del array
        const maxQuestions = gameConfig.cantidadPreguntas || currentQuestions.length;
        if (currentQuestionIndex >= currentQuestions.length || currentQuestionIndex >= maxQuestions) {
            // Mensaje personalizado según si juegas solo o acompañado
            const players = gameConfig.jugadores || [];
            const isSolo = players.length === 1;
            const titleMsg = isSolo ? "¡Partida Finalizada!" : "¡Has completado todas las preguntas!";
            const bodyMsg = isSolo ? "Calculando resultados finales..." : "Espera a que los demás terminen.";

            quizInterface.innerHTML = `
                <div class="question-card">
                    <h2>${titleMsg}</h2>
                    <p>${bodyMsg}</p>
                    ${isSolo ? '' : '<button class="btn action-btn" onclick="location.reload()">Volver al inicio</button>'}
                </div>`;
            return;
        }

        const q = currentQuestions[currentQuestionIndex];
        
        let optionsHtml = '';
        q.opciones.forEach((opt, index) => {
            optionsHtml += `<button class="quiz-option-btn" data-index="${index}">${opt}</button>`;
        });

        quizInterface.innerHTML = `
            <div class="question-card">
                <div class="timer-container">
                    <div id="timer-bar" class="timer-fill"></div>
                </div>
                <p style="color: #aaa; margin-bottom: 10px;">Pregunta ${currentQuestionIndex + 1} de ${currentQuestions.length} (Autor: ${q.autor})</p>
                <h2>${q.texto}</h2>
                <div class="quiz-options-list">
                    ${optionsHtml}
                </div>
            </div>
        `;

        // --- LÓGICA DEL TEMPORIZADOR ---
        const timerBar = document.getElementById('timer-bar');
        const timeLimit = gameConfig.tiempoPregunta || 10;
        let timeLeft = timeLimit;

        // Animación CSS para suavidad
        timerBar.style.transition = `width ${timeLimit}s linear, background-color ${timeLimit}s linear`;
        
        // Forzamos un reflow para que la transición funcione desde el 100%
        setTimeout(() => {
            timerBar.style.width = '0%';
            timerBar.style.backgroundColor = '#ff0000'; // Termina en rojo
        }, 50);

        // Control JS para el evento de fin de tiempo
        timerInterval = setTimeout(() => {
            // TIEMPO AGOTADO: Pasa a la siguiente y cuenta como fallada (no suma puntos)
            submitTimeOut(); 
        }, timeLimit * 1000);


        // Añadir eventos a los botones de opción
        document.querySelectorAll('.quiz-option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 1. Bloquear botones visualmente para evitar doble click o cambios de opinión
                document.querySelectorAll('.quiz-option-btn').forEach(b => b.style.pointerEvents = 'none');
                // 2. Usamos currentTarget para asegurar 100% que leemos el índice del botón, no de un elemento interno
                submitAnswer(e.currentTarget.dataset.index);
            });
        });
    };

    // 6a. Manejar Tiempo Agotado (Nueva función para no perder sincronía)
    const submitTimeOut = async () => {
        // Capturamos índice actual
        const answeredQuestionIndex = currentQuestionIndex;
        
        // Avanzamos visualmente
        currentQuestionIndex++;
        renderQuizQuestion();

        // Registramos el fallo en BD para que cuente como respuesta hecha
        const gameRef = db.collection('partidas').doc(gameId);
        try {
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) throw "Partida no existe";

                const players = doc.data().jugadores || [];
                const playerIndex = players.findIndex(p => (typeof p === 'object' ? p.name : p) === currentPlayerName);

                if (playerIndex !== -1) {
                    if (typeof players[playerIndex] !== 'object') players[playerIndex] = { name: players[playerIndex], respuestas: 0 };
                    
                    // Incrementamos contador de respuestas (aunque sea timeout)
                    players[playerIndex].respuestas = (players[playerIndex].respuestas || 0) + 1;
                    
                    // Guardar detalle como -1 (Tiempo Agotado)
                    if (!players[playerIndex].respuestasDetalle) players[playerIndex].respuestasDetalle = {};
                    players[playerIndex].respuestasDetalle[answeredQuestionIndex] = -1; 

                    // Comprobar cierre
                    const totalQuestions = doc.data().cantidadPreguntas || (doc.data().preguntas ? doc.data().preguntas.length : 0);
                    const allFinished = players.every(p => (p.respuestas || 0) >= totalQuestions && totalQuestions > 0);

                    if (allFinished && doc.data().estado !== 'Cerrada') {
                        transaction.update(gameRef, { jugadores: players, estado: 'Cerrada' });
                    } else {
                        transaction.update(gameRef, { jugadores: players });
                    }
                }
            });
        } catch (error) {
            console.error("Error registrando timeout:", error);
        }
    };

    // 6. Enviar Respuesta y Actualizar Puntuación
    const submitAnswer = async (selectedIndex) => {
        // Detener temporizador porque ha contestado
        if (timerInterval) clearTimeout(timerInterval);

        // Capturamos el índice de la pregunta ACTUAL antes de incrementarlo
        // Esto es crucial porque dentro de la transacción (que es async) currentQuestionIndex ya habrá cambiado
        const answeredQuestionIndex = currentQuestionIndex;

        // Verificar si es correcta antes de avanzar
        const question = currentQuestions[answeredQuestionIndex];
        const isCorrect = parseInt(selectedIndex) === question.correcta;

        // Aquí podríamos validar si es correcta, pero el requisito es "actualizar contestadas"
        // Avanzamos índice localmente
        currentQuestionIndex++;
        renderQuizQuestion();

        // Actualizamos en BD (Transacción para seguridad en arrays)
        const gameRef = db.collection('partidas').doc(gameId);
        
        try {
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(gameRef);
                if (!doc.exists) throw "Partida no existe";

                const players = doc.data().jugadores || [];
                // Buscamos al jugador actual en el array
                const playerIndex = players.findIndex(p => (typeof p === 'object' ? p.name : p) === currentPlayerName);

                if (playerIndex !== -1) {
                    // Si es string, lo convertimos a objeto
                    if (typeof players[playerIndex] !== 'object') {
                        players[playerIndex] = { name: players[playerIndex], respuestas: 0 };
                    }
                    
                    // Incrementamos respuestas
                    players[playerIndex].respuestas = (players[playerIndex].respuestas || 0) + 1;
                    
                    // Sumamos puntos si es correcta
                    if (isCorrect) {
                        players[playerIndex].puntos = (players[playerIndex].puntos || 0) + 1;
                    } else {
                        // Si la respuesta es incorrecta, comprobamos si la regla de restar está activa
                        if (doc.data().erroresRestan) {
                            const currentPoints = players[playerIndex].puntos || 0;
                            players[playerIndex].puntos = Math.max(0, currentPoints - 1); // Evita puntos negativos
                        }
                    }

                    // Guardar detalle de la respuesta (índice seleccionado)
                    if (!players[playerIndex].respuestasDetalle) {
                        players[playerIndex].respuestasDetalle = {};
                    }
                    // Usamos el índice capturado al inicio de la función (answeredQuestionIndex)
                    players[playerIndex].respuestasDetalle[answeredQuestionIndex] = parseInt(selectedIndex);
                    
                    // Comprobar si TODOS han terminado para cerrar la partida
                    const totalQuestions = doc.data().cantidadPreguntas || (doc.data().preguntas ? doc.data().preguntas.length : 0);
                    const allFinished = players.every(p => (p.respuestas || 0) >= totalQuestions && totalQuestions > 0);

                    if (allFinished && doc.data().estado !== 'Cerrada') {
                        transaction.update(gameRef, { jugadores: players, estado: 'Cerrada' });
                    } else {
                        transaction.update(gameRef, { jugadores: players });
                    }
                }
            });
        } catch (error) {
            console.error("Error actualizando puntuación:", error);
        }
    };

    // --- EVENT LISTENERS NUEVOS ---

    // Abrir modal añadir pregunta
    btnOpenAddQuestion.addEventListener('click', () => addQuestionModal.classList.remove('hidden'));
    closeQuestionModal.addEventListener('click', () => addQuestionModal.classList.add('hidden'));

    // Guardar nueva pregunta
    questionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('q-text').value;
        const correctIndex = document.querySelector('input[name="correct-opt"]:checked').value;
        const options = Array.from(document.querySelectorAll('.opt-text')).map(input => input.value);

        const newQuestion = {
            texto: text,
            opciones: options,
            correcta: parseInt(correctIndex),
            autor: currentPlayerName
        };

        // 1. Guardar en la partida actual (para jugarla ahora)
        await db.collection('partidas').doc(gameId).update({
            preguntas: firebase.firestore.FieldValue.arrayUnion(newQuestion)
        });

        // 2. Guardar TAMBIÉN en el banco general (para que quede registrada para el futuro)
        // Así el juego crece con las aportaciones de los jugadores
        db.collection('banco_preguntas').add(newQuestion).catch(err => {
            console.error("Error guardando copia en banco:", err);
        });

        addQuestionModal.classList.add('hidden');
        questionForm.reset();
        alert("¡Pregunta añadida con éxito!");
    });

    // Comenzar Quiz
    btnStartQuiz.addEventListener('click', async () => {
        // Verificar si todos han puesto su pregunta antes de empezar
        try {
            const gameDoc = await db.collection('partidas').doc(gameId).get();
            const gData = gameDoc.data();
            const players = gData.jugadores || [];
            const questions = gData.preguntas || [];

            // Solo validamos si la regla de "pregunta por jugador" está activa
            if (gData.preguntasPorJugador) {
                // Identificar qué jugadores NO han añadido pregunta todavía
                const missingPlayers = players.filter(p => {
                    const pName = typeof p === 'object' ? p.name : p;
                    return !questions.some(q => q.autor === pName);
                });

                if (missingPlayers.length > 0) {
                    const names = missingPlayers.map(p => typeof p === 'object' ? p.name : p).join(', ');
                    alert(`⛔ No se puede empezar aún.\n\nFaltan los siguientes jugadores por añadir su pregunta:\n\n👉 ${names}`);
                    return; // Bloqueamos el inicio
                }
            }
            // Si todos cumplieron y la partida estaba Abierta, pasamos a Jugando
            if (gData.estado === 'Abierta') {
                // 1. Calcular cuántas preguntas faltan para llegar al total configurado
                // (Total Configurado - Preguntas ya subidas por los jugadores)
                let finalQuestions = [...questions];
                const totalConfigured = gData.cantidadPreguntas || 10;
                const needed = totalConfigured - finalQuestions.length;

                // 2. Si faltan preguntas, las cogemos del banco al azar
                if (needed > 0) {
                    try {
                        const bankSnapshot = await db.collection('banco_preguntas').get();
                        let bankPool = [];
                        bankSnapshot.forEach(doc => bankPool.push(doc.data()));
                        
                        // Mezclar banco y coger las necesarias
                        bankPool.sort(() => Math.random() - 0.5);
                        const defaults = bankPool.slice(0, needed);
                        
                        finalQuestions = finalQuestions.concat(defaults);
                    } catch (error) {
                        console.error("Error obteniendo preguntas del banco:", error);
                    }
                }

                // 3. Mezclar todo (Jugadores + Banco) para que el orden sea aleatorio
                finalQuestions.sort(() => Math.random() - 0.5);

                if (finalQuestions.length === 0) {
                    alert("⚠️ ERROR: No hay preguntas disponibles.\n\nEl banco de preguntas está vacío y no se han añadido preguntas manuales.\n\nSube preguntas en la sección 'Categorías' o permite que los jugadores añadan las suyas.");
                    return;
                }

                await db.collection('partidas').doc(gameId).update({ 
                    preguntas: finalQuestions,
                    estado: 'Jugando' 
                });
            }
        } catch (error) {
            console.error("Error verificando estado de partida:", error);
            alert("Error de conexión al verificar la partida.");
            return;
        }

        gameActions.classList.add('hidden');
        quizInterface.classList.remove('hidden');
        isQuizActive = true;
        renderQuizQuestion();
    });

    // --- LOGICA DE ARRANQUE ---

    if (currentPlayerName) {
        // Si ya tenemos sesión, entramos directo
        initGame();
    } else {
        // Si no, cargamos opciones y esperamos login
        loadLoginOptions();
        
        btnLogin.addEventListener('click', () => {
            const selected = loginSelect.value;
            if (!selected) {
                alert("Por favor, selecciona quién eres.");
                return;
            }
            
            currentPlayerName = selected;
            sessionStorage.setItem(`miju_player_${gameId}`, currentPlayerName);
            initGame();
        });
    }
});