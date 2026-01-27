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
    const configBtns = document.querySelectorAll('.btn-memory-opt');
    const startContainer = document.getElementById('start-game-container');
    const selectedModeText = document.getElementById('selected-mode-text');
    const btnStart = document.getElementById('btn-start-memory');
    const gameArea = document.getElementById('game-area');
    const levelIndicator = document.getElementById('level-indicator');
    const displayArea = document.getElementById('memory-display-area');
    const inputArea = document.getElementById('memory-input-area');
    const btnExitMode = document.getElementById('btn-exit-mode');

    // --- ESTADO DEL JUEGO ---
    let currentMode = null;
    let gameSequence = [];
    let userSequence = [];
    let currentLevelIndex = 0; // Índice global de niveles (0, 1, 2...)
    let isInputBlocked = false;
    let isGameActive = false;

    // --- DATOS ---
    const DATA = {
        numeros: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        letras: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
        colores: ['green', 'red', 'yellow', 'blue'], // IDs para Simón
        fichas: [] // Se generará dinámicamente d00..d66
    };

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

    // --- FUNCIONES DEL JUEGO ---

    function startGame() {
        if (!currentMode) return;

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
        // Calcular cantidad de elementos: 1, 1, 2, 2, 3, 3...
        // Fórmula: Math.floor(index / 2) + 1
        const qty = Math.floor(currentLevelIndex / 2) + 1;
        
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
        displayArea.textContent = 'Atento...';
        inputArea.style.opacity = '0.5'; // Deshabilitar visualmente input
        
        await sleep(1000);
        if (!isGameActive) return;
        displayArea.textContent = '';

        for (const item of gameSequence) {
            if (!isGameActive) return;
            await sleep(500);
            if (!isGameActive) return;
            
            if (currentMode === 'colores') {
                // Iluminar botón Simón
                const btn = document.getElementById(`simon-${item}`);
                if (btn) {
                    btn.classList.add('active');
                    // Sonido opcional aquí
                    await sleep(600);
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
        displayArea.textContent = '¡Tu turno!';
        inputArea.style.opacity = '1';
        isInputBlocked = false;
    }

    function handleInput(value) {
        if (isInputBlocked) return;

        // Efecto visual al pulsar (especialmente útil para Simón)
        if (currentMode === 'colores') {
            const btn = document.getElementById(`simon-${value}`);
            btn.classList.add('active');
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
            displayArea.innerHTML = '<span style="color: #00ff00;">¡Correcto!</span>';
            setTimeout(() => {
                currentLevelIndex++;
                nextLevel();
            }, 1500);
        }
    }

    function gameOver() {
        isInputBlocked = true;
        displayArea.innerHTML = '<span style="color: #ff0000;">¡Fallaste!</span>';
        
        setTimeout(() => {
            if (confirm(`Fin del juego.\nHas llegado al Nivel ${currentLevelIndex + 1}.\n\n¿Reintentar?`)) {
                startGame();
            } else {
                // Volver a config
                gameArea.classList.add('hidden');
                document.querySelector('.form-container').classList.remove('hidden');
                displayArea.textContent = '';
            }
        }, 500);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    console.log("Sistema de Memoria listo.");
});