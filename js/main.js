document.addEventListener('DOMContentLoaded', () => {
    const introScreen = document.getElementById('intro-screen');
    const mainMenu = document.getElementById('main-menu');

    // Comprobamos si ya se ha mostrado la intro en esta sesión
    if (sessionStorage.getItem('introShown')) {
        // Si ya se mostró, saltamos la intro y mostramos el menú directamente
        introScreen.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    } else {
        // Si es la primera vez, ejecutamos la animación
        // Tiempo de espera: 2500 milisegundos = 2.5 segundos
        setTimeout(() => {
            // 1. Desvanecer la intro
            introScreen.style.opacity = '0';
            
            // 2. Esperar a que termine la transición CSS (1s) para ocultarla del todo
            setTimeout(() => {
                introScreen.classList.add('hidden');
                
                // 3. Mostrar el menú principal
                mainMenu.classList.remove('hidden');
                
                // 4. Guardamos en la sesión que la intro ya se ha visto
                sessionStorage.setItem('introShown', 'true');
            }, 1000);
        }, 2500);
    }
});