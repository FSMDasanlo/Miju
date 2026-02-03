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

    // --- REFERENCIAS DOM ---
    const configBtns = document.querySelectorAll('.btn-memory-opt');
    const startContainer = document.getElementById('start-game-container');
    const selectedModeText = document.getElementById('selected-mode-text');
    const btnStart = document.getElementById('btn-start-memory');
    const gameArea = document.getElementById('game-area');
    const levelIndicator = document.getElementById('level-indicator');
    const displayArea = document.getElementById('memory-display-area');
    const inputArea = document.getElementById('memory-input-area');
    const btnExitMode = document.getElementById('btn-exit-mode');
    const playerSelect = document.getElementById('memory-player-select');
    const scoresPanel = document.getElementById('scores-panel');

    // --- ESTADO DEL JUEGO ---
    let currentMode = null;
    let gameSequence = [];
    let userSequence = [];
    let currentLevelIndex = 0; // Índice global de niveles (0, 1, 2...)
    let isInputBlocked = false;
    let isGameActive = false;
    let currentPlayerId = null;
    let currentPlayerName = null;
    let allPlayersData = []; // Para calcular rankings globales

    // --- FRASES MOTIVADORAS ---
    const motivationalPhrases = [
        "¡No te rindas! La próxima vez será mejor.",
        "El fracaso es solo una oportunidad para empezar de nuevo con más inteligencia.",
        "¡Sigue intentándolo! Cada intento te acerca más al éxito.",
        "La memoria es un músculo, ¡sigue entrenándola!",
        "¡Ánimo! Hasta los más grandes campeones han tropezado.",
        "La perseverancia es la clave. ¡Vamos a por la siguiente!",
        "¡Buen intento! La práctica hace al maestro."
    ];

    // --- DATOS ---
    const DATA = {
        numeros: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        letras: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
        colores: ['green', 'red', 'yellow', 'blue'], // IDs para Simón
        fichas: [] // Se generará dinámicamente d00..d66
    };

    // --- AUDIO (SIMÓN DICE) ---
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    const SOUNDS = {
        green: 329.63,  // E4
        red: 261.63,    // C4
        yellow: 220.00, // A3
        blue: 164.81    // E3
    };

    function playSound(color) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = SOUNDS[color] || 440;
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.00001, now + 0.5);
        
        osc.start(now);
        osc.stop(now + 0.5);
    }

    // Generar lista de fichas de dominó (00 a 66)
    for (let i = 0; i <= 6; i++) {
        for (let j = i; j <= 6; j++) { // j=i para evitar duplicados inversos si es standard, pero usuario dijo 38 imgs.
            // Si el usuario tiene 38 imágenes específicas, asumimos d00 a d66 completas o similar.
            // Generamos la serie estándar doble 6 (28 fichas) para asegurar que existen.
            DATA.fichas.push(`d${i}${j}`);
        }
    }
    // Nota: Si hay 38 imágenes exactas en la carpeta, podríamos ajustar esto. 
    // Por ahora usamos las combinaciones estándar de dominó que coinciden con el patrón dXY.

    // --- INICIALIZACIÓN ---
    loadPlayers();

    // --- EVENTOS CONFIGURACIÓN ---
    configBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Visual
            configBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Lógica
            currentMode = btn.dataset.mode;
            let modeName = btn.textContent;
            selectedModeText.textContent = `Modo seleccionado: ${modeName}`;
            startContainer.classList.remove('hidden');
        });
    });

    btnStart.addEventListener('click', startGame);

    btnExitMode.addEventListener('click', () => {
        if (confirm("¿Quieres salir del juego actual y elegir otro modo?")) {
            isGameActive = false;
            gameArea.classList.add('hidden');
            document.querySelector('.form-container').classList.remove('hidden');
            displayArea.textContent = '';
            inputArea.innerHTML = '';
        }
    });

    playerSelect.addEventListener('change', () => {
        handlePlayerSelection();
    });

    // --- FUNCIONES DEL JUEGO ---

    function startGame() {
        if (!currentMode) return;

        if (!currentPlayerId) {
            alert("⚠️ Por favor, selecciona tu nombre en el desplegable 'Jugador' antes de empezar.");
            return;
        }

        if (audioCtx.state === 'suspended') audioCtx.resume();
        isGameActive = true;

        // Reset
        currentLevelIndex = 0;
        gameSequence = [];
        userSequence = [];
        
        // UI Setup
        document.querySelector('.form-container').classList.add('hidden'); // Ocultar config
        gameArea.classList.remove('hidden');
        
        renderInputBoard(); // Dibujar el teclado/tablero abajo
        nextLevel();
    }

    function renderInputBoard() {
        inputArea.innerHTML = '';

        if (currentMode === 'colores') {
            // Tablero Simón (4 botones grandes)
            const board = document.createElement('div');
            board.className = 'simon-board';
            
            const colors = [
                { id: 'green', color: '#00ff00' },
                { id: 'red', color: '#ff0000' },
                { id: 'yellow', color: '#ffff00' },
                { id: 'blue', color: '#0000ff' }
            ];

            colors.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'simon-btn';
                btn.id = `simon-${c.id}`;
                btn.style.backgroundColor = c.color;
                btn.style.color = c.color; // Para el box-shadow
                btn.addEventListener('click', () => handleInput(c.id));
                board.appendChild(btn);
            });
            inputArea.appendChild(board);

        } else if (currentMode === 'fichas') {
            // Grid de imágenes
            const grid = document.createElement('div');
            grid.className = 'input-grid-tokens';
            
            DATA.fichas.forEach(ficha => {
                const img = document.createElement('img');
                img.src = `img/${ficha}.png`; // Asumiendo ruta img/d00.png
                img.className = 'token-img';
                img.alt = ficha;
                img.addEventListener('click', () => handleInput(ficha));
                grid.appendChild(img);
            });
            inputArea.appendChild(grid);

        } else {
            // Números o Letras (Botones pequeños)
            const grid = document.createElement('div');
            grid.className = 'input-grid-small';
            
            const items = DATA[currentMode];
            items.forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'btn-input-item';
                btn.textContent = item;
                btn.addEventListener('click', () => handleInput(item));
                grid.appendChild(btn);
            });
            inputArea.appendChild(grid);
        }
    }

    function nextLevel() {
        // Calcular cantidad de elementos.
        // Niveles 1 y 2 (índices 0 y 1): 1 y 2 elementos respectivamente (sin repetir).
        // A partir de ahí (índice 2+): 3, 3, 4, 4, 5, 5...
        let qty;
        if (currentLevelIndex < 2) {
            qty = currentLevelIndex + 1;
        } else {
            qty = Math.floor((currentLevelIndex - 2) / 2) + 3;
        }
        
        levelIndicator.textContent = `Nivel ${currentLevelIndex + 1} (Elementos: ${qty})`;
        userSequence = [];
        gameSequence = generateSequence(qty);
        
        playSequence();
    }

    function generateSequence(length) {
        const seq = [];
        const source = DATA[currentMode];
        for (let i = 0; i < length; i++) {
            const randomItem = source[Math.floor(Math.random() * source.length)];
            seq.push(randomItem);
        }
        return seq;
    }

    async function playSequence() {
        isInputBlocked = true;
        if (!isGameActive) return;
        displayArea.innerHTML = '<span style="font-size: 3rem;">Atento...</span>';
        inputArea.style.opacity = '0.5'; // Deshabilitar visualmente input
        
        await sleep(1000);
        if (!isGameActive) return;
        displayArea.textContent = '';

        for (const item of gameSequence) {
            if (!isGameActive) return;
            // Pausa entre elementos (más rápida para colores)
            await sleep(currentMode === 'colores' ? 250 : 500);
            if (!isGameActive) return;
            
            if (currentMode === 'colores') {
                // Iluminar botón Simón
                const btn = document.getElementById(`simon-${item}`);
                if (btn) {
                    btn.classList.add('active');
                    playSound(item);
                    await sleep(400);
                    if (!isGameActive) return;
                    btn.classList.remove('active');
                }
            } else if (currentMode === 'fichas') {
                // Mostrar imagen
                displayArea.innerHTML = `<img src="img/${item}.png" style="max-height: 150px;">`;
                await sleep(1000);
                if (!isGameActive) return;
                displayArea.innerHTML = '';
            } else {
                // Mostrar texto (número/letra)
                displayArea.textContent = item;
                await sleep(1000);
                if (!isGameActive) return;
                displayArea.textContent = '';
            }
        }

        if (!isGameActive) return;
        displayArea.innerHTML = '<span style="font-size: 3rem;">¡Tu turno!</span>';
        inputArea.style.opacity = '1';
        isInputBlocked = false;
    }

    function handleInput(value) {
        if (isInputBlocked) return;

        // Efecto visual al pulsar (especialmente útil para Simón)
        if (currentMode === 'colores') {
            const btn = document.getElementById(`simon-${value}`);
            btn.classList.add('active');
            playSound(value);
            setTimeout(() => btn.classList.remove('active'), 200);
        }

        userSequence.push(value);

        // Comprobar si el último elemento introducido es correcto
        const currentIndex = userSequence.length - 1;
        
        if (userSequence[currentIndex] !== gameSequence[currentIndex]) {
            gameOver();
            return;
        }

        // Si ha completado la secuencia
        if (userSequence.length === gameSequence.length) {
            isInputBlocked = true;
            displayArea.innerHTML = '<span style="color: #00ff00; font-size: 3rem;">¡Correcto!</span>';
            setTimeout(() => {
                currentLevelIndex++;
                nextLevel();
            }, 1500);
        }
    }

    async function gameOver() {
        // Calcular puntuación final (Niveles completados)
        const finalScore = currentLevelIndex;

        isInputBlocked = true;
        const randomPhrase = motivationalPhrases[Math.floor(Math.random() * motivationalPhrases.length)];
        displayArea.innerHTML = `<span style="color: #ff0000; font-size: 3rem;">¡Fallaste!</span><p style="color: #aaa; font-size: 1.1rem; margin-top: 10px; font-style: italic;">${randomPhrase}</p>`;
        inputArea.innerHTML = ''; // Limpiar controles para mostrar el menú
        
        let recordInfo = { isRecord: false };

        // Guardar récord si hay jugador seleccionado
        if (currentPlayerId && currentMode) {
            recordInfo = await checkAndSaveRecord(finalScore);
        }

        // --- GENERAR MENÚ DE FIN DE JUEGO ---
        const container = document.createElement('div');
        container.style.textAlign = 'center';
        container.style.marginTop = '20px';
        container.className = 'game-over-menu';

        let html = `<h3 style="color: #fff; margin-bottom: 10px;">Fin del juego</h3>
                    <p style="font-size: 1.2rem; margin-bottom: 20px;">Nivel alcanzado: <span style="color: #00ffff; font-weight:bold;">${finalScore}</span></p>`;

        if (recordInfo.isRecord) {
            html += `<p style="color: #00ff00; font-weight: bold; margin-bottom: 10px; font-size: 1.2rem;">¡NUEVO RÉCORD PERSONAL!</p>`;
            if (recordInfo.isGlobal) {
                html += `<p style="color: #ffd700; font-weight: bold; margin-bottom: 15px; font-size: 1.3rem; text-shadow: 0 0 10px #ffd700;">🏆 ¡RÉCORD GLOBAL! 🏆</p>`;
            }
        }

        container.innerHTML = html;

        // Contenedor de botones
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.flexWrap = 'wrap';
        btnContainer.style.gap = '15px';
        btnContainer.style.justifyContent = 'center';
        btnContainer.style.marginTop = '20px';

        // Botón WhatsApp (Si hay récord)
        if (recordInfo.isRecord) {
            const btnWa = document.createElement('button');
            btnWa.className = 'action-btn';
            btnWa.style.background = '#25D366'; // Color WhatsApp
            btnWa.style.color = '#fff';
            btnWa.style.width = 'auto';
            btnWa.innerHTML = '📱 Compartir WhatsApp';
            btnWa.onclick = () => {
                const text = `¡He conseguido un nuevo récord en Memoria (${currentMode}) en MIJU! 🧠\nNivel: ${finalScore}\n\n¿Puedes superarme? 😉\nhttps://fsmdasanlo.github.io/Miju/`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            };
            btnContainer.appendChild(btnWa);

            // Botón Email (Si es Global y hay a quien avisar)
            if (recordInfo.isGlobal && recordInfo.previousHolder && recordInfo.previousHolder.email) {
                const btnMail = document.createElement('button');
                btnMail.className = 'action-btn';
                btnMail.style.background = '#EA4335'; // Color Gmail
                btnMail.style.width = 'auto';
                btnMail.innerHTML = `📧 Avisar a ${recordInfo.previousHolder.name}`;
                btnMail.onclick = () => {
                    const subject = `¡${currentPlayerName} te ha quitado el récord de ${currentMode}!`;
                    const body = `Hola ${recordInfo.previousHolder.name}:\n\nTe informamos que ${currentPlayerName} acaba de quitarte el récord de Retos de Memoria (${currentMode}).\n\nHa llegado al nivel: ${finalScore}\n\nRECUPERA TU RECORD DE NUEVO.\nJuega en el siguiente link:\nhttps://fsmdasanlo.github.io/Miju/`;
                    window.location.href = `mailto:${recordInfo.previousHolder.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                };
                btnContainer.appendChild(btnMail);
            }

            // Botón WhatsApp Rival (Si es Global y tiene teléfono)
            if (recordInfo.isGlobal && recordInfo.previousHolder && recordInfo.previousHolder.phone) {
                const btnWaRival = document.createElement('button');
                btnWaRival.className = 'action-btn';
                btnWaRival.style.background = '#128C7E'; // WhatsApp Dark
                btnWaRival.style.width = 'auto';
                btnWaRival.innerHTML = `😈 Picar a ${recordInfo.previousHolder.name}`;
                btnWaRival.onclick = () => {
                    // Limpiar teléfono (quitar espacios, guiones, etc)
                    const phone = recordInfo.previousHolder.phone.replace(/[^0-9]/g, '');
                    const text = `Hola ${recordInfo.previousHolder.name}:\n\nTe informamos que ${currentPlayerName} acaba de quitarte el récord de Retos de Memoria (${currentMode}).\n\nHa llegado al nivel: ${finalScore}\n\nRECUPERA TU RECORD DE NUEVO.\nJuega en el siguiente link:\nhttps://fsmdasanlo.github.io/Miju/`;
                    
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
                };
                btnContainer.appendChild(btnWaRival);
            }
        }

        // Botón Reintentar
        const btnRetry = document.createElement('button');
        btnRetry.className = 'action-btn';
        btnRetry.style.width = 'auto';
        btnRetry.style.background = 'linear-gradient(90deg, #00ffff, #0077ff)';
        btnRetry.innerHTML = '🔄 Reintentar';
        btnRetry.onclick = startGame;
        btnContainer.appendChild(btnRetry);

        // Botón Salir
        const btnExit = document.createElement('button');
        btnExit.className = 'btn-secondary';
        btnExit.style.padding = '15px 20px';
        btnExit.style.borderRadius = '8px';
        btnExit.style.cursor = 'pointer';
        btnExit.innerHTML = 'Salir';
        btnExit.onclick = () => {
            gameArea.classList.add('hidden');
            document.querySelector('.form-container').classList.remove('hidden');
            displayArea.textContent = '';
            inputArea.innerHTML = '';
        };
        btnContainer.appendChild(btnExit);

        container.appendChild(btnContainer);
        inputArea.appendChild(container);
    }

    // --- GESTIÓN DE JUGADORES Y PUNTUACIONES ---

    async function loadPlayers() {
        try {
            const snapshot = await playersCollection.orderBy('name').get();
            allPlayersData = [];
            
            playerSelect.innerHTML = '<option value="">-- Selecciona tu nombre --</option>';
            
            snapshot.forEach(doc => {
                const p = doc.data();
                p.id = doc.id; // Guardamos ID
                allPlayersData.push(p);
                
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = p.name;
                playerSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error cargando jugadores:", error);
        }
    }

    function handlePlayerSelection() {
        currentPlayerId = playerSelect.value;
        currentPlayerName = playerSelect.options[playerSelect.selectedIndex].text;

        if (currentPlayerId) {
            scoresPanel.classList.remove('hidden');
            updateScoresDisplay();
        } else {
            scoresPanel.classList.add('hidden');
        }
    }

    function updateScoresDisplay() {
        if (!currentPlayerId) return;

        // Buscar datos del jugador actual en memoria
        const playerData = allPlayersData.find(p => p.id === currentPlayerId);
        const myScores = playerData.memory_scores || {};

        // Calcular mejores globales
        const globalBests = {
            numeros: { score: 0, holder: '-' },
            letras: { score: 0, holder: '-' },
            fichas: { score: 0, holder: '-' },
            colores: { score: 0, holder: '-' }
        };

        allPlayersData.forEach(p => {
            const s = p.memory_scores || {};
            for (const mode in globalBests) {
                if (s[mode] && s[mode] > globalBests[mode].score) {
                    globalBests[mode].score = s[mode];
                    globalBests[mode].holder = p.name;
                }
            }
        });

        // Construir HTML
        let html = `<h3 style="color:#00ffff; margin-bottom:10px; border-bottom:1px solid #555; padding-bottom:5px;">Estadísticas de ${playerData.name}</h3>`;
        
        html += `<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; font-size:0.9rem;">
                    <div style="color:#aaa;">Modalidad</div>
                    <div style="color:#00ff00; font-weight:bold;">Tu Récord</div>
                    <div style="color:#ffd700;">Récord Global</div>`;

        const modes = [
            { key: 'numeros', label: 'Números' },
            { key: 'letras', label: 'Letras' },
            { key: 'fichas', label: 'Fichas' },
            { key: 'colores', label: 'Colores' }
        ];

        modes.forEach(m => {
            const myVal = myScores[m.key] || 0;
            const globalVal = globalBests[m.key].score;
            const globalHolder = globalBests[m.key].holder;
            
            html += `
                <div style="border-top:1px solid #333; padding-top:5px; margin-top:5px;">${m.label}</div>
                <div style="border-top:1px solid #333; padding-top:5px; margin-top:5px;">${myVal}</div>
                <div style="border-top:1px solid #333; padding-top:5px; margin-top:5px;">${globalVal} (${globalHolder})</div>
            `;
        });

        html += `</div>`;
        scoresPanel.innerHTML = html;
    }

    function getPlayerBestScore(playerId, mode) {
        const p = allPlayersData.find(x => x.id === playerId);
        if (p && p.memory_scores) {
            return p.memory_scores[mode] || 0;
        }
        return 0;
    }

    async function checkAndSaveRecord(score) {
        const currentBest = getPlayerBestScore(currentPlayerId, currentMode);
        let result = { isRecord: false, isGlobal: false, previousHolder: null };
        
        if (score > currentBest) {
            result.isRecord = true;

            // 0. Calcular el récord global ANTES de actualizar (para saber a quién hemos ganado)
            let globalMax = 0;
            let globalHolder = null;

            allPlayersData.forEach(p => {
                const s = p.memory_scores || {};
                const val = s[currentMode] || 0;
                if (val > globalMax) {
                    globalMax = val;
                    globalHolder = p;
                }
            });

            // ¡Nuevo Récord!
            // 1. Actualizar en memoria local para reflejarlo ya
            const pIndex = allPlayersData.findIndex(x => x.id === currentPlayerId);
            if (pIndex !== -1) {
                if (!allPlayersData[pIndex].memory_scores) allPlayersData[pIndex].memory_scores = {};
                allPlayersData[pIndex].memory_scores[currentMode] = score;
            }

            // 2. Actualizar UI
            updateScoresDisplay();
            
            // 3. Guardar en Firebase
            try {
                // Usamos notación de punto para actualizar solo ese campo del mapa
                const updateData = {};
                updateData[`memory_scores.${currentMode}`] = score;
                
                await playersCollection.doc(currentPlayerId).update(updateData);
                
                // Determinar si es récord global para devolver la info
                if (score > globalMax) {
                    // Si había un dueño anterior distinto a mí
                    if (globalHolder && globalHolder.id !== currentPlayerId) {
                        result.isGlobal = true;
                        result.previousHolder = globalHolder;
                    } else if (!globalHolder) {
                        // Primer récord global
                        result.isGlobal = true;
                    }
                }
            } catch (error) {
                console.error("Error guardando récord:", error);
            }
        }
        return result;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    console.log("Sistema de Memoria listo.");
});