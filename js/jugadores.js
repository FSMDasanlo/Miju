document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN DE FIREBASE ---
    // ¡IMPORTANTE! Reemplaza esto con la configuración de tu propio proyecto de Firebase.
    // La puedes encontrar en la consola de Firebase, en la configuración de tu proyecto.
    const firebaseConfig = {
  apiKey: "AIzaSyDCfhS1tgrQrdlBSLRw8WtXaI6a--xyWm0",
  authDomain: "miju-d79ce.firebaseapp.com",
  projectId: "miju-d79ce",
  storageBucket: "miju-d79ce.firebasestorage.app",
  messagingSenderId: "982594739405",
  appId: "1:982594739405:web:150d302d4cddb99c075d84",
  measurementId: "G-6S3L4RTVC9"
};

    // Verificación de seguridad para avisarte si olvidaste poner las claves
    if (firebaseConfig.apiKey === "TU_API_KEY") {
        alert("¡Atención!\n\nNecesitas configurar Firebase en el archivo 'js/jugadores.js'.\n\nSigue los pasos que te he indicado para obtener tus claves.");
        return; // Detenemos la ejecución para evitar errores de consola
    }

    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const playersCollection = db.collection('jugadores');

    // --- REFERENCIAS DEL DOM ---
    const addPlayerForm = document.getElementById('add-player-form');
    const playerNameInput = document.getElementById('player-name');
    const playerEmailInput = document.getElementById('player-email');
    const playersList = document.getElementById('players-list');

    // --- FUNCIONES ---

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
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: bold;">${player.name}</span>
                        <span style="font-size: 0.8rem; color: #aaa;">${player.email || ''}</span>
                    </div>
                    <button class="btn-delete-player" title="Eliminar">🗑️</button>
                `;

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

        if (playerName) {
            await playersCollection.add({
                name: playerName,
                email: playerEmail
            });
            addPlayerForm.reset(); // Limpiar el input
            renderPlayers(); // Volver a renderizar la lista actualizada
        }
    });

    // Carga inicial de jugadores al entrar en la página
    renderPlayers();
});