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

    // --- CONSTANTES ---
    // Preguntas semilla para inicializar la colección 'banco_preguntas' en Firestore
    const SEED_QUESTIONS = [
        { texto: "¿En qué año fue fundada Madrid como Mayrit?", opciones: ["852", "711", "1085", "1492"], correcta: 0, autor: "Sistema" },
        { texto: "¿Cuántos distritos tiene la ciudad de Madrid?", opciones: ["19", "20", "21", "22"], correcta: 2, autor: "Sistema" },
        { texto: "¿En qué año Madrid se convirtió en capital de España?", opciones: ["1492", "1561", "1605", "1700"], correcta: 1, autor: "Sistema" },
        { texto: "¿Cuántos municipios tiene la Comunidad de Madrid?", opciones: ["175", "178", "179", "182"], correcta: 2, autor: "Sistema" },
        { texto: "¿Altura aproximada (en metros) sobre el nivel del mar de Madrid?", opciones: ["567", "635", "667", "712"], correcta: 2, autor: "Sistema" },
        { texto: "¿Cuántas líneas tiene el Metro de Madrid (2025)?", opciones: ["10", "12", "13", "14"], correcta: 3, autor: "Sistema" },
        { texto: "¿En qué año se inauguró el Museo del Prado?", opciones: ["1785", "1808", "1819", "1833"], correcta: 2, autor: "Sistema" },
        { texto: "¿Cuántos habitantes aproximadamente tiene la ciudad de Madrid?", opciones: ["2,8 millones", "3,1 millones", "3,3 millones", "3,8 millones"], correcta: 2, autor: "Sistema" },
        { texto: "¿Cuántas puertas tiene la Plaza Mayor?", opciones: ["7", "8", "9", "10"], correcta: 3, autor: "Sistema" },
        { texto: "¿En qué año se inauguró el Metro de Madrid?", opciones: ["1905", "1912", "1919", "1925"], correcta: 2, autor: "Sistema" },
        { texto: "¿Cuántos parques principales tiene el Retiro?", opciones: ["5", "6", "7", "8"], correcta: 3, autor: "Sistema" },
        { texto: "¿Número aproximado de árboles en el Parque del Retiro?", opciones: ["10.000", "15.000", "19.000", "25.000"], correcta: 3, autor: "Sistema" },
        { texto: "¿En qué año se inauguró el estadio Santiago Bernabéu?", opciones: ["1935", "1947", "1952", "1960"], correcta: 1, autor: "Sistema" },
        { texto: "¿Cuántas plantas tiene el edificio Torre de Cristal?", opciones: ["45", "49", "52", "60"], correcta: 2, autor: "Sistema" },
        { texto: "¿Cuántos kilómetros cuadrados ocupa la ciudad de Madrid?", opciones: ["500", "550", "604", "650"], correcta: 2, autor: "Sistema" },
        { texto: "¿En qué año se construyó la Puerta de Alcalá?", opciones: ["1758", "1769", "1778", "1801"], correcta: 2, autor: "Sistema" },
        { texto: "¿Cuántos arcos tiene la Puerta de Alcalá?", opciones: ["3", "4", "5", "6"], correcta: 2, autor: "Sistema" },
        { texto: "¿Cuántos museos forman el “Paseo del Arte”?", opciones: ["2", "3", "4", "5"], correcta: 1, autor: "Sistema" },
        { texto: "¿Cuántos barrios tiene el distrito Centro?", opciones: ["5", "6", "7", "8"], correcta: 1, autor: "Sistema" },
        { texto: "¿Temperatura máxima histórica registrada en Madrid (°C)?", opciones: ["40,2", "41,5", "42,1", "42,7"], correcta: 3, autor: "Sistema" }
    ];

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

        // Auto-sembrado: Si la colección está vacía, subimos las preguntas semilla
        if (snapshot.empty) {
            console.log("Sembrando banco de preguntas en Firestore...");
            const batch = db.batch();
            SEED_QUESTIONS.forEach(q => {
                const docRef = bankRef.doc();
                batch.set(docRef, q);
            });
            await batch.commit();
            snapshot = await bankRef.get(); // Volver a leer
        }

        let pool = [];
        snapshot.forEach(doc => pool.push(doc.data()));

        // Mezclar aleatoriamente
        const shuffled = pool.sort(() => Math.random() - 0.5);
        
        // Actualizar la partida con las preguntas obtenidas
        await db.collection('partidas').doc(targetGameId).update({ preguntas: shuffled });
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

            const card = document.createElement('div');
            card.className = `sidebar-player-card ${name === currentPlayerName ? 'is-me' : ''}`;
            
            card.innerHTML = `
                <span class="sidebar-player-name">${name}</span>
                <span class="player-score-badge" title="Respuestas enviadas">${answersCount}</span>
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
                    
                    transaction.update(gameRef, { jugadores: players });
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
    btnStartQuiz.addEventListener('click', () => {
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