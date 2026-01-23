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

            // Si la partida está cerrada, mostrar resultados
            if (gameData.estado === 'Cerrada') {
                showResults(gameData);
                return;
            }

            // 1.1 Si no hay preguntas, cargamos las por defecto (Solo lo hace el primero que entra o detecta esto)
            if (!gameData.preguntas) {
                // Cargamos las preguntas desde la colección de Firestore
                loadQuestionsFromBank(gameId);
                return; // Esperamos al siguiente snapshot con los datos cargados
            }

            currentQuestions = gameData.preguntas || [];
            renderHeader(gameData);
            renderSidebar(gameData.jugadores || []);
        }, (error) => {
            console.error("Error recibiendo actualizaciones:", error);
        });
    };

    // Función auxiliar para cargar preguntas desde la colección global 'banco_preguntas'
    const loadQuestionsFromBank = async (targetGameId) => {
        const bankRef = db.collection('banco_preguntas');
        let snapshot = await bankRef.get();

        let pool = [];
        snapshot.forEach(doc => pool.push(doc.data()));

        // Mezclar aleatoriamente
        const shuffled = pool.sort(() => Math.random() - 0.5);
        
        // Actualizar la partida con las preguntas obtenidas
        await db.collection('partidas').doc(targetGameId).update({ preguntas: shuffled });
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
    const renderSidebar = (players) => {
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

            const card = document.createElement('div');
            card.className = `sidebar-player-card ${name === currentPlayerName ? 'is-me' : ''}`;
            
            card.innerHTML = `
                <span class="sidebar-player-name">${name}</span>
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
            quizInterface.innerHTML = `
                <div class="question-card">
                    <h2>¡Has completado todas las preguntas!</h2>
                    <p>Espera a que los demás terminen o añade más preguntas.</p>
                    <button class="btn action-btn" onclick="location.reload()">Volver al inicio</button>
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
            currentQuestionIndex++;
            renderQuizQuestion();
        }, timeLimit * 1000);


        // Añadir eventos a los botones de opción
        document.querySelectorAll('.quiz-option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => submitAnswer(e.target.dataset.index));
        });
    };

    // 6. Enviar Respuesta y Actualizar Puntuación
    const submitAnswer = async (selectedIndex) => {
        // Detener temporizador porque ha contestado
        if (timerInterval) clearTimeout(timerInterval);

        // Verificar si es correcta antes de avanzar
        const question = currentQuestions[currentQuestionIndex];
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
                    }

                    // Guardar detalle de la respuesta (índice seleccionado)
                    if (!players[playerIndex].respuestasDetalle) {
                        players[playerIndex].respuestasDetalle = {};
                    }
                    players[playerIndex].respuestasDetalle[currentQuestionIndex] = parseInt(selectedIndex);
                    
                    // Comprobar si TODOS han terminado para cerrar la partida
                    const totalQuestions = doc.data().cantidadPreguntas || (doc.data().preguntas ? doc.data().preguntas.length : 0);
                    const allFinished = players.every(p => (p.respuestas || 0) >= totalQuestions);

                    if (allFinished) {
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

        await db.collection('partidas').doc(gameId).update({
            preguntas: firebase.firestore.FieldValue.arrayUnion(newQuestion)
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

            // Si todos cumplieron y la partida estaba Abierta, pasamos a Jugando
            if (gData.estado === 'Abierta') {
                await db.collection('partidas').doc(gameId).update({ estado: 'Jugando' });
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