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
    let currentRecord = 0; // Récord actual del modo
    let currentRecordHolder = ''; // Nombre del poseedor del récord
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
        colores: ['green', 'red', 'yellow', 'blue'],
        figuras: ['☀️', '🌙', '⭐', '△', '⭕', '⬢']
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
        
        // Calcular récord actual para mostrarlo
        currentRecord = 0;
        currentRecordHolder = '';
        allPlayersData.forEach(p => {
            const s = p.memory_scores || {};
            if ((s[currentMode] || 0) > currentRecord) {
                currentRecord = s[currentMode] || 0;
                currentRecordHolder = p.name;
            }
        });

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

        } else if (currentMode === 'figuras') {
            // Grid de 2x3 para las figuras
            const grid = document.createElement('div');
            grid.className = 'input-grid-small'; // Reutilizamos esta clase
            grid.style.gridTemplateColumns = 'repeat(3, 1fr)'; // Forzamos 3 columnas
            
            DATA.figuras.forEach(figura => {
                const btn = document.createElement('button');
                btn.className = 'btn-input-item';
                btn.id = `figura-${figura}`; // ID único para encontrarlo después
                btn.textContent = figura;
                btn.style.fontSize = '2.5rem'; // Más grande para los emojis
                btn.addEventListener('click', () => handleInput(figura));
                grid.appendChild(btn);
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

    async function nextLevel() {
        userSequence = []; // Reset user input for the new level

        let qty;

        // --- LÓGICA ACUMULATIVA (SIMON SAYS) solo para 'figuras' ---
        if (currentMode === 'figuras') {
            const source = DATA[currentMode];
            const newItem = source[Math.floor(Math.random() * source.length)];
            gameSequence.push(newItem); // Add one new item to the sequence
            qty = gameSequence.length;
        } else {
            // --- LÓGICA ORIGINAL (NUEVA SECUENCIA) para 'numeros', 'letras' y 'colores' ---
            // Calcular cantidad de elementos.
            if (currentLevelIndex < 2) {
                qty = currentLevelIndex + 1;
            } else {
                qty = Math.floor((currentLevelIndex - 2) / 2) + 3;
            }
            gameSequence = generateSequence(qty);
        }
        
        // Mostrar Nivel y Récord
        let recordText = currentRecord > 0 ? ` <span style="color:#ffd700; margin-left:15px; text-shadow:0 0 5px #b8860b;">🏆 ${currentRecord} <span style="font-size:0.5em; color:#ddd; vertical-align: middle;">(${currentRecordHolder})</span></span>` : '';
        levelIndicator.innerHTML = `Nivel ${currentLevelIndex + 1}${recordText}`;
        
        // --- MOTIVACIÓN: Si estamos a 3 niveles del récord ---
        // Ejemplo: Récord 10. Nivel 8 (Index 7). 10 - 7 = 3.
        if (currentRecord > 0 && (currentRecord - currentLevelIndex === 3)) {
            await showMotivationAlert();
        }

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

    function showMotivationAlert() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0'; overlay.style.left = '0';
            overlay.style.width = '100%'; overlay.style.height = '100%';
            overlay.style.background = 'rgba(0,0,0,0.9)';
            overlay.style.zIndex = '3000';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'column';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.textAlign = 'center';
            
            overlay.innerHTML = `
                <h1 style="color: #ffd700; font-size: 3rem; margin-bottom: 20px; text-shadow: 0 0 20px #ff0000; animation: pulse 1s infinite;">🔥 ¡ESTÁS ON FIRE! 🔥</h1>
                <p style="color: #fff; font-size: 1.5rem; max-width: 80%; margin-bottom: 30px; line-height: 1.5;">
                    Estás a solo <span style="color: #00ffff; font-weight:bold; font-size: 2.5rem;">3 niveles</span> de alcanzar el Récord Global.
                    <br><br>
                    Respira hondo... ¡Tú puedes hacer historia!
                </p>
                <button id="btn-resume-motivation" class="action-btn" style="font-size: 1.2rem; padding: 15px 40px; background: linear-gradient(90deg, #ff9900, #ff5500); border:none; border-radius:50px; color:white; cursor:pointer; box-shadow: 0 0 15px #ff5500;">¡VAMOS ALLÁ! 🚀</button>
            `;
            
            document.body.appendChild(overlay);
            
            document.getElementById('btn-resume-motivation').onclick = () => {
                overlay.remove();
                resolve();
            };
        });
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
            await sleep(currentMode === 'colores' ? 250 : 200);
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
            } else if (currentMode === 'figuras') {
                // Iluminar la figura en el tablero de input
                const btn = document.getElementById(`figura-${item}`);
                if (btn) {
                    btn.classList.add('active'); // Usaremos la clase 'active' de simon-btn
                    await sleep(500);
                    if (!isGameActive) return;
                    btn.classList.remove('active');
                }
            } else {
                // Mostrar texto (número/letra)
                displayArea.textContent = item;
                await sleep(600);
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

        // Efecto visual al pulsar
        if (currentMode === 'colores') {
            const btn = document.getElementById(`simon-${value}`);
            btn.classList.add('active');
            playSound(value);
            setTimeout(() => btn.classList.remove('active'), 200);
        } else if (currentMode === 'figuras') {
            const btn = document.getElementById(`figura-${value}`);
            if (btn) {
                btn.classList.add('clicked');
                setTimeout(() => btn.classList.remove('clicked'), 150);
            }
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
        
        let sequenceHtml = '';
        if (currentMode === 'numeros' || currentMode === 'letras' || currentMode === 'figuras') {
            sequenceHtml = `
                <div style="margin-top: 20px; text-align: center;">
                    <div style="color: #aaa; font-size: 0.9rem; margin-bottom: 5px;">Secuencia correcta:</div>
                    <div style="font-size: 1.5rem; letter-spacing: 3px; color: #00ffff; font-weight: bold;">${gameSequence.join(' ')}</div>
                </div>`;
        }

        displayArea.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                <div style="color: #ff0000; font-size: 3rem; margin-bottom: 25px;">¡Fallaste!</div>
                <div style="color: #aaa; font-size: 1.1rem; font-style: italic;">${randomPhrase}</div>
                ${sequenceHtml}
            </div>
        `;
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
            setupCustomDropdown();
        } catch (error) {
            console.error("Error cargando jugadores:", error);
        }
    }

    function setupCustomDropdown() {
        // Evitar duplicados si se recarga
        const existingWrapper = document.querySelector('.custom-select-wrapper');
        if (existingWrapper) existingWrapper.remove();

        playerSelect.style.display = 'none'; // Ocultar select nativo

        // Crear contenedor
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.width = '100%';
        wrapper.style.maxWidth = '300px';
        wrapper.style.margin = '0 auto 1rem auto';

        // Crear input buscador
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '🔍 Buscar nombre...';
        input.style.width = '100%';
        input.style.padding = '12px';
        input.style.borderRadius = '5px';
        input.style.border = '1px solid #00ffff';
        input.style.background = '#1a1a2e';
        input.style.color = '#fff';
        input.style.cursor = 'text';

        // Crear lista desplegable
        const list = document.createElement('div');
        list.className = 'custom-select-list hidden';
        list.style.position = 'absolute';
        list.style.top = '100%';
        list.style.left = '0';
        list.style.width = '100%';
        list.style.maxHeight = '250px';
        list.style.overflowY = 'auto';
        list.style.background = '#0f0f1a';
        list.style.border = '1px solid #333';
        list.style.zIndex = '1000';
        list.style.borderRadius = '0 0 5px 5px';

        wrapper.appendChild(input);
        wrapper.appendChild(list);
        playerSelect.parentNode.insertBefore(wrapper, playerSelect);

        // Función de renderizado
        const renderList = (filter = '') => {
            list.innerHTML = '';
            const filtered = allPlayersData.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
            
            if (filtered.length === 0) {
                const item = document.createElement('div');
                item.textContent = 'No encontrado';
                item.style.padding = '10px';
                item.style.color = '#aaa';
                list.appendChild(item);
                return;
            }

            filtered.forEach(p => {
                const item = document.createElement('div');
                item.textContent = p.name;
                item.style.padding = '10px';
                item.style.cursor = 'pointer';
                item.style.borderBottom = '1px solid #222';
                
                item.addEventListener('mouseover', () => item.style.background = '#00ffff22');
                item.addEventListener('mouseout', () => item.style.background = 'transparent');
                
                item.addEventListener('click', () => {
                    input.value = p.name;
                    playerSelect.value = p.id; // Actualizar select original oculto
                    list.classList.add('hidden');
                    playerSelect.dispatchEvent(new Event('change')); // Disparar lógica existente
                });
                list.appendChild(item);
            });
        };

        // Eventos
        input.addEventListener('focus', () => {
            list.classList.remove('hidden');
            renderList();
        });

        input.addEventListener('input', (e) => {
            list.classList.remove('hidden');
            renderList(e.target.value);
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                list.classList.add('hidden');
            }
        });
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
            figuras: { score: 0, holder: '-' },
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
            { key: 'figuras', label: 'Figuras' },
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