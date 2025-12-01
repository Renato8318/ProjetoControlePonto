document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const metaTotalEl = document.getElementById('metaTotal');
    const pausaTotalEl = document.getElementById('pausaTotal');
    const entradaRegistradaEl = document.getElementById('entradaRegistrada');
    const tempoTrabalhadoEl = document.getElementById('tempoTrabalhado');
    const ultimoRegistroDisplayEl = document.getElementById('ultimoRegistroDisplay');
    const saidaSugeriaEl = document.getElementById('saidaSugeria');
    const erroResumoEl = document.getElementById('erroResumo');
    const graficoCanvas = document.getElementById('graficoJornada');

    // --- FUNÇÕES DE UTILITÁRIOS ---
    const msToTime = (duration, showSeconds = true) => {
        if (isNaN(duration)) return '--:--';
        const sinal = duration < 0 ? "-" : "";
        let totalSeconds = Math.abs(Math.floor(duration / 1000));
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;
        const pad = (num) => String(num).padStart(2, '0');
        
        if (showSeconds) {
            return `${sinal}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        }
        return `${sinal}${pad(hours)}:${pad(minutes)}`;
    };

    // --- FUNÇÃO PRINCIPAL ---
    const carregarResumo = () => {
        // 1. Carrega os dados do localStorage
        const jornadaHoras = Number(localStorage.getItem('jornadaHoras') || '8');
        const jornadaMinutos = Number(localStorage.getItem('jornadaMinutos') || '0');
        const pausaMinutos = Number(localStorage.getItem('pausaMinutos') || '60');
        
        const tempoTrabalhadoMs = Number(localStorage.getItem('resumo_tempoTrabalhado') || 0);
        const entradaRegistrada = localStorage.getItem('resumo_entrada');
        const saidaSugerida = localStorage.getItem('resumo_saidaSugerida');
        const ultimoRegistro = localStorage.getItem('resumo_ultimoRegistro');

        // Verifica se há uma entrada registrada. Se não, exibe mensagem de erro.
        if (!entradaRegistrada) {
            erroResumoEl.textContent = 'Nenhum registro de entrada encontrado para hoje. Volte e inicie sua jornada.';
            erroResumoEl.style.display = 'block';
            document.getElementById('resumoJornada').style.display = 'none'; // Esconde o painel de detalhes
            graficoCanvas.style.display = 'none'; // Esconde o gráfico
            return;
        }

        // 2. Calcula os totais
        const jornadaMetaMs = (jornadaHoras * 3600 + jornadaMinutos * 60) * 1000;
        const pausaTotalMs = pausaMinutos * 60 * 1000;
        const tempoFaltanteMs = Math.max(0, jornadaMetaMs - tempoTrabalhadoMs);

        // 3. Atualiza os elementos de texto na página
        metaTotalEl.textContent = msToTime(jornadaMetaMs, false);
        pausaTotalEl.textContent = msToTime(pausaTotalMs, false);
        entradaRegistradaEl.textContent = entradaRegistrada || '--:--';
        tempoTrabalhadoEl.textContent = msToTime(tempoTrabalhadoMs, true);
        saidaSugeriaEl.textContent = saidaSugerida || '--:--';
        ultimoRegistroDisplayEl.textContent = ultimoRegistro || 'Nenhum ponto registrado.';

        // 4. Cria o gráfico
        criarGrafico(tempoTrabalhadoMs, pausaTotalMs, tempoFaltanteMs);
    };

    const criarGrafico = (trabalhado, pausa, faltante) => {
        const ctx = graficoCanvas.getContext('2d');
        
        // Destrói gráfico antigo se existir, para evitar sobreposição
        if (window.myDoughnutChart) {
            window.myDoughnutChart.destroy();
        }

        window.myDoughnutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Trabalhado', 'Pausa', 'Faltante'],
                datasets: [{
                    data: [trabalhado, pausa, faltante],
                    backgroundColor: [
                        '#10B981', // emerald-500
                        '#6366F1', // indigo-500
                        '#E5E7EB'  // gray-200
                    ],
                    borderColor: '#FFFFFF', // white
                    borderWidth: 4
                }]
            },
            options: {
                responsive: true,
                cutout: '70%', // Deixa o gráfico mais fino
                plugins: {
                    legend: {
                        display: false // Esconde a legenda padrão
                    }
                }
            }
        });
    };

    // --- INICIALIZAÇÃO ---
    carregarResumo();
});