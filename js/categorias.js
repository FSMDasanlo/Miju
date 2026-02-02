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
    const btnDownloadAll = document.getElementById('btn-download-all');
    const btnDeleteAll = document.getElementById('btn-delete-all');
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
                        ${q.pista ? `<div style="font-size: 0.85rem; color: #ffcc00; margin-top: 4px; font-style: italic;">Pista: ${q.pista}</div>` : ''}
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
                    document.getElementById('q-hint').value = q.pista || '';
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

    // 3. Descargar todas las preguntas
    if (btnDownloadAll) {
        btnDownloadAll.addEventListener('click', () => {
            if (loadedQuestions.length === 0) {
                alert("No hay preguntas para descargar.");
                return;
            }

            let fileContent = '';
            // Ordenamos alfabéticamente para que el fichero sea más organizado
            const sortedQuestions = [...loadedQuestions].sort((a, b) => a.texto.localeCompare(b.texto));

            sortedQuestions.forEach((q, index) => {
                fileContent += `${index + 1}. ${q.texto}\n`;
                const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
                
                if (q.opciones && Array.isArray(q.opciones)) {
                    q.opciones.forEach((opt, i) => {
                        const isCorrect = i === q.correcta;
                        const letter = optionLetters[i] || String.fromCharCode(65 + i);
                        fileContent += `   ${letter}) ${opt}${isCorrect ? ' ✅' : ''}\n`;
                    });
                }
                if (q.pista && q.pista.trim() !== '') {
                    fileContent += `Pista: ${q.pista}\n`;
                }
                fileContent += '\n'; // Espacio entre preguntas
            });

            const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'banco_preguntas.txt';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }

    // 4. Borrar TODAS las preguntas
    if (btnDeleteAll) { // Usamos la existencia de un botón para inyectar la nueva tarjeta
        // 1. Crear el nuevo contenedor (la tarjeta de peligro)
        const dangerZoneContainer = document.createElement('div');
        dangerZoneContainer.className = 'list-container danger-zone';
        dangerZoneContainer.innerHTML = `
            <h2 style="color: #ff9900;">Mantenimiento</h2>
            <p style="color: #aaa; font-size: 0.9rem; margin-bottom: 1.5rem;">
                Acciones para limpiar la base de datos. Úsalas con precaución.
            </p>
        `;

        // 2. Crear botón de Eliminar Duplicados
        const btnRemoveDupes = document.createElement('button');
        btnRemoveDupes.className = 'action-btn';
        btnRemoveDupes.style.background = 'linear-gradient(90deg, #ff9900, #ff5500)';
        btnRemoveDupes.innerHTML = '🧹 Eliminar Preguntas Duplicadas';
        dangerZoneContainer.appendChild(btnRemoveDupes);

        // 3. Insertar el contenedor en el DOM (Reorganización solicitada)
        const individualUploadCard = btnAddSingle ? (btnAddSingle.closest('.list-container') || btnAddSingle.closest('.form-container')) : null;
        const fileManagementCard = btnMassUpload ? (btnMassUpload.closest('.list-container') || btnMassUpload.closest('.form-container')) : null;

        if (individualUploadCard && fileManagementCard && individualUploadCard.parentNode) {
            fileManagementCard.parentNode.insertBefore(individualUploadCard, fileManagementCard.nextSibling);
            individualUploadCard.parentNode.insertBefore(dangerZoneContainer, individualUploadCard.nextSibling);
        } else if (btnDeleteAll.parentNode) {
            btnDeleteAll.parentNode.insertBefore(dangerZoneContainer, btnDeleteAll);
        }

        // 4. Mover el botón de "Borrar Todo" al nuevo contenedor y estilizarlo
        dangerZoneContainer.appendChild(btnDeleteAll);
        
        btnDeleteAll.innerHTML = '🗑️ Borrar TODA la base de datos';
        btnDeleteAll.className = 'action-btn';
        btnDeleteAll.style.background = 'linear-gradient(90deg, #ff4444, #b71c1c)';
        btnDeleteAll.style.marginTop = '10px';
        btnDeleteAll.style.marginBottom = '0';

        // 5. Añadir los listeners a los botones
        btnRemoveDupes.addEventListener('click', async () => {
            if (!confirm("¿Quieres analizar la base de datos y eliminar automáticamente las preguntas repetidas?")) return;

            questionsList.innerHTML = '<li class="loading-item">Analizando preguntas...</li>';

            try {
                const snapshot = await questionsCollection.get();
                const seenTexts = new Set();
                const duplicates = [];

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const normalizedText = data.texto ? data.texto.trim().toLowerCase() : '';

                    if (normalizedText && seenTexts.has(normalizedText)) {
                        duplicates.push(doc.id);
                    } else {
                        seenTexts.add(normalizedText);
                    }
                });

                if (duplicates.length === 0) {
                    alert("¡Todo limpio! No se encontraron preguntas duplicadas.");
                } else if (confirm(`⚠️ Se han encontrado ${duplicates.length} preguntas repetidas.\n\n¿Quieres eliminarlas y dejar solo una copia de cada una?`)) {
                    const chunkSize = 400;
                    const chunks = [];
                    for (let i = 0; i < duplicates.length; i += chunkSize) {
                        chunks.push(duplicates.slice(i, i + chunkSize));
                    }

                    for (const chunk of chunks) {
                        const batch = db.batch();
                        chunk.forEach(id => batch.delete(questionsCollection.doc(id)));
                        await batch.commit();
                    }

                    alert(`¡Limpieza completada! Se eliminaron ${duplicates.length} duplicados.`);
                }
                renderQuestions(); // Recargar siempre
            } catch (error) {
                console.error("Error eliminando duplicados:", error);
                alert("Error al procesar duplicados.");
                renderQuestions();
            }
        });

        btnDeleteAll.addEventListener('click', async () => {
            if (loadedQuestions.length === 0) return alert("No hay preguntas para borrar.");
            
            const password = prompt("🔒 ZONA PELIGROSA\n\nPara borrar TODA la base de datos, introduce la clave de administrador:");
            if (password !== "Traid1959") {
                return alert("⛔ Contraseña incorrecta.");
            }

            if (!confirm("⚠️ ¡PELIGRO! ⚠️\n\n¿Estás seguro de que quieres BORRAR TODAS las preguntas?\n\nEsta acción no se puede deshacer.")) return;
            if (!confirm(`Se van a eliminar ${loadedQuestions.length} preguntas permanentemente.\n\n¿Confirmar borrado total?`)) return;

            try {
                const chunkSize = 400;
                const chunks = [];
                for (let i = 0; i < loadedQuestions.length; i += chunkSize) {
                    chunks.push(loadedQuestions.slice(i, i + chunkSize));
                }

                for (const chunk of chunks) {
                    const batch = db.batch();
                    chunk.forEach(q => batch.delete(questionsCollection.doc(q.id)));
                    await batch.commit();
                }

                alert("Base de datos limpiada correctamente.");
                renderQuestions();
            } catch (error) {
                console.error("Error borrando todo:", error);
                alert("Error al borrar las preguntas: " + error.message);
            }
        });
    }

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
                const blocks = ('\n' + normalizedText).split(/\n(?=\d+[\.\s\*])/);
                
                blocks.forEach(block => {
                    // Limpiamos líneas vacías y espacios extra
                    const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
                    if (lines.length === 0) return;

                    // Extraer Pista (si existe)
                    let hintText = '';
                    const hintIndex = lines.findIndex(l => /^[\*]*pista:/i.test(l));
                    if (hintIndex !== -1) {
                        hintText = lines[hintIndex].replace(/^[\*]*pista:[\*]*\s*/i, '').trim();
                        lines.splice(hintIndex, 1); // La quitamos para que no moleste
                    }

                    // Buscamos dónde empiezan las opciones (A), B), etc.)
                    const firstOptionIndex = lines.findIndex(l => /^[a-d]\)/i.test(l));
                    
                    if (firstOptionIndex === -1) return; // Si no hay opciones, saltamos este bloque

                    // 1. Extraer Pregunta (Todas las líneas antes de la primera opción)
                    // Quitamos el número inicial "1. " y posibles asteriscos
                    let qText = lines.slice(0, firstOptionIndex).join(' ')
                        .replace(/^\d+[\.\s]*\s*/, '')
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
                            autor: 'Admin',
                            pista: hintText
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
        const hint = document.getElementById('q-hint').value.trim();
        const correctIndex = document.querySelector('input[name="correct-opt"]:checked').value;
        const options = Array.from(document.querySelectorAll('.opt-text')).map(input => input.value);

        try {
            const questionData = {
                texto: text,
                pista: hint,
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