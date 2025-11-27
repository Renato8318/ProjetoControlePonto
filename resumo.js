document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM ---
    const entradaRegistrada = document.getElementById('entradaRegistrada');
    const saidaSugeria = document.getElementById('saidaSugeria');
    const metaTotal = document.getElementById('metaTotal');
    const pausaTotalDisplay = document.getElementById('pausaTotal');
    const erroResumo = document.getElementById('erroResumo');
    // A linha abaixo causava o erro, pois o elemento não existe no resumo.html

    // --- Funções de Utilitários de Tempo ---
    const msToTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}`; // Apenas HH:MM para exibição
    };

    const carregarResumo = () => {
        // Carrega Configurações LOCAIS
        const horas = Number(localStorage.getItem('jornadaHoras') || '8');
        const minutos = Number(localStorage.getItem('jornadaMinutos') || '0');
        const jornadaMetaMs = (horas * 3600 + minutos * 60) * 1000;

        const pausaMin = Number(localStorage.getItem('pausaMinutos') || '60');
        const pausaTotalMs = pausaMin * 60 * 1000;

        // Atualiza UI com as Metas e Pausa
        metaTotal.textContent = msToTime(jornadaMetaMs);
        pausaTotalDisplay.textContent = msToTime(pausaTotalMs);

        // Lê os dados já processados pela página principal
        const entradaSalva = localStorage.getItem('resumo_entrada');
        const saidaSalva = localStorage.getItem('resumo_saidaSugerida');

        if (entradaSalva && saidaSalva) {
            erroResumo.style.display = 'none';
            entradaRegistrada.textContent = entradaSalva;
            saidaSugeria.textContent = saidaSalva;
        } else {
            entradaRegistrada.textContent = '--:--';
            saidaSugeria.textContent = '--:--';
            erroResumo.textContent = 'Vá para a página principal para registrar sua entrada.';
            erroResumo.style.display = 'block';
        }
    };

    // A cada 1 segundo, atualiza o resumo lendo do localStorage
    carregarResumo(); // Chamada inicial
    setInterval(carregarResumo, 1000); 
});