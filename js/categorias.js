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
    const questionsCollection = db.collection('banco_preguntas');
    let currentEditingId = null; // Variable para saber si estamos editando
    let loadedQuestions = []; // Array para almacenar preguntas y filtrar localmente

    // --- REFERENCIAS DOM ---
    const btnMassUpload = document.getElementById('btn-mass-upload');
    const fileUpload = document.getElementById('file-upload');
    const btnAddSingle = document.getElementById('btn-add-single');
    const questionsList = document.getElementById('questions-list');
    const questionsCount = document.getElementById('questions-count');
    const searchFilter = document.getElementById('search-filter');
    
    // Modal referencias
    const addQuestionModal = document.getElementById('add-question-modal');
    const closeQuestionModal = document.getElementById('close-question-modal');
    const questionForm = document.getElementById('question-form');

    // --- FUNCIONES ---

    // Renderizar lista de preguntas
    const renderQuestions = async () => {
        questionsList.innerHTML = '<li class="loading-item">Actualizando lista...</li>';
        try {
            const snapshot = await questionsCollection.get();
            
            loadedQuestions = [];
            snapshot.forEach(doc => {
                loadedQuestions.push({ id: doc.id, ...doc.data() });
            });

            displayQuestionsList();

        } catch (error) {
            console.error("Error cargando preguntas:", error);
            questionsList.innerHTML = '<li class="error-item">Error al cargar datos.</li>';
        }
    };

    const displayQuestionsList = () => {
        const filterText = searchFilter.value.toLowerCase();
        const filtered = loadedQuestions.filter(q => q.texto.toLowerCase().includes(filterText));

        questionsList.innerHTML = '';
        questionsCount.textContent = filtered.length;

        if (filtered.length === 0) {
            questionsList.innerHTML = '<li class="info-item">No se encontraron preguntas.</li>';
            return;
        }

        filtered.forEach(q => {
                const li = document.createElement('li');
                li.className = 'player-item'; // Reutilizamos estilo de lista
                
                li.innerHTML = `
                    <div style="flex-grow: 1; margin-right: 10px;">
                        <div style="font-weight: bold; color: #fff; margin-bottom: 5px;">${q.texto}</div>
                        <div style="font-size: 0.85rem; color: #aaa;">
                            Correcta: <span style="color: #00ff00;">${q.opciones[q.correcta]}</span> | Autor: ${q.autor}
                        </div>
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon-small btn-edit" title="Editar">✏️</button>
                        <button class="btn-icon-small btn-danger btn-delete" title="Eliminar">🗑️</button>
                    </div>
                `;

                // Evento Editar
                li.querySelector('.btn-edit').addEventListener('click', () => {
                    currentEditingId = q.id;
                    document.getElementById('q-text').value = q.texto;
                    const inputs = document.querySelectorAll('.opt-text');
                    q.opciones.forEach((opt, i) => {
                        if(inputs[i]) inputs[i].value = opt;
                    });
                    const radios = document.querySelectorAll('input[name="correct-opt"]');
                    if(radios[q.correcta]) radios[q.correcta].checked = true;

                    document.querySelector('#add-question-modal h2').textContent = "Editar Pregunta";
                    document.querySelector('#question-form button[type="submit"]').textContent = "Actualizar";
                    addQuestionModal.classList.remove('hidden');
                });

                // Evento Eliminar
                li.querySelector('.btn-delete').addEventListener('click', async () => {
                    if(confirm("¿Eliminar esta pregunta permanentemente?")) {
                        await questionsCollection.doc(q.id).delete();
                        renderQuestions();
                    }
                });

                questionsList.appendChild(li);
        });
    };

    // --- EVENTOS ---

    // Filtro de búsqueda
    searchFilter.addEventListener('input', displayQuestionsList);

    // 1. Subida Masiva (JSON)
    btnMassUpload.addEventListener('click', () => fileUpload.click());

    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const questions = [];
                
                // Normalizamos saltos de línea
                const normalizedText = text.replace(/\r\n/g, '\n');
                
                // Separamos por bloques que empiecen por número y punto (Ej: "1. ")
                // Añadimos un salto de línea al principio para asegurar que pilla la primera pregunta
                const blocks = ('\n' + normalizedText).split(/\n(?=\d+\.)/);
                
                blocks.forEach(block => {
                    // Limpiamos líneas vacías y espacios extra
                    const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
                    if (lines.length === 0) return;

                    // Buscamos dónde empiezan las opciones (A), B), etc.)
                    const firstOptionIndex = lines.findIndex(l => /^[a-d]\)/i.test(l));
                    
                    if (firstOptionIndex === -1) return; // Si no hay opciones, saltamos este bloque

                    // 1. Extraer Pregunta (Todas las líneas antes de la primera opción)
                    // Quitamos el número inicial "1. " y posibles asteriscos
                    let qText = lines.slice(0, firstOptionIndex).join(' ')
                        .replace(/^\d+\.\s*/, '')
                        .replace(/\*\*/g, '')
                        .trim();
                    
                    const options = [];
                    let correctIndex = 0;
                    
                    // 2. Extraer Opciones
                    lines.slice(firstOptionIndex).forEach(line => {
                        if (/^[a-d]\)/i.test(line)) {
                            let isCorrect = line.includes('✅');
                            // Limpiamos "A) " y el emoji
                            let optText = line.replace(/^[a-d]\)\s*/i, '').replace('✅', '').trim();
                            
                            options.push(optText);
                            if (isCorrect) correctIndex = options.length - 1;
                        }
                    });

                    if (qText && options.length >= 2) {
                        questions.push({
                            texto: qText,
                            opciones: options,
                            correcta: correctIndex,
                            autor: 'Admin'
                        });
                    }
                });

                if (questions.length === 0) throw new Error("No se encontraron preguntas válidas en el archivo.");

                if (!confirm(`Se han encontrado ${questions.length} preguntas. ¿Subirlas al banco?`)) return;

                const batch = db.batch();
                questions.forEach(q => {
                    const docRef = questionsCollection.doc();
                    batch.set(docRef, q);
                });

                await batch.commit();
                alert("¡Carga masiva completada!");
                renderQuestions();
            } catch (error) {
                console.error(error);
                alert("Error al procesar el archivo: " + error.message);
            }
            fileUpload.value = ''; // Resetear input
        };
        reader.readAsText(file);
    });

    // 2. Subida Individual (Modal)
    btnAddSingle.addEventListener('click', () => {
        currentEditingId = null;
        questionForm.reset();
        document.querySelector('#add-question-modal h2').textContent = "Nueva Pregunta";
        document.querySelector('#question-form button[type="submit"]').textContent = "Guardar en Banco";
        addQuestionModal.classList.remove('hidden');
    });
    closeQuestionModal.addEventListener('click', () => addQuestionModal.classList.add('hidden'));

    questionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('q-text').value;
        const correctIndex = document.querySelector('input[name="correct-opt"]:checked').value;
        const options = Array.from(document.querySelectorAll('.opt-text')).map(input => input.value);

        try {
            const questionData = {
                texto: text,
                opciones: options,
                correcta: parseInt(correctIndex),
                autor: 'Admin'
            };

            if (currentEditingId) {
                await questionsCollection.doc(currentEditingId).update(questionData);
                alert("Pregunta actualizada.");
            } else {
                await questionsCollection.add(questionData);
                alert("Pregunta creada correctamente.");
            }

            addQuestionModal.classList.add('hidden');
            questionForm.reset();
            currentEditingId = null;
            renderQuestions();
        } catch (error) {
            console.error(error);
            alert("Error al guardar la pregunta.");
        }
    });

    // --- INICIO ---
    renderQuestions();
});