document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM ---
    const entradaRegistrada = document.getElementById('entradaRegistrada');
    const saidaSugeria = document.getElementById('saidaSugeria');
    const metaTotal = document.getElementById('metaTotal');
    const pausaTotalDisplay = document.getElementById('pausaTotal');
    const erroResumo = document.getElementById('erroResumo');
    const ultimoRegistroDisplay = document.getElementById('ultimoRegistroDisplay');
    const tempoTrabalhadoDisplay = document.getElementById('tempoTrabalhado');
    const ctx = document.getElementById('graficoJornada');
    let graficoJornada; // Variável para armazenar a instância do gráfico

    // --- Funções de Utilitários de Tempo ---
    const msToTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}`; // Apenas HH:MM para exibição
    };

    const msToFullTime = (duration) => {
        const sinal = duration < 0 ? "-" : "";
        let totalSeconds = Math.abs(Math.floor(duration / 1000));
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;
        const pad = (num) => String(num).padStart(2, '0');
        return `${sinal}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    const renderizarGrafico = (tempoTrabalhado, tempoPausa, tempoRestante) => {
        const data = {
            labels: [
                'Trabalhado',
                'Em Pausa',
                'Restante'
            ],
            datasets: [{
                label: 'Jornada',
                data: [
                    Math.max(0, tempoTrabalhado / (1000 * 60)), // em minutos
                    Math.max(0, tempoPausa / (1000 * 60)),
                    Math.max(0, tempoRestante / (1000 * 60))
                ],
                backgroundColor: [
                    '#10b981', // emerald-500
                    '#f59e0b', // amber-500
                    '#64748b'  // slate-500
                ],
                hoverOffset: 4
            }]
        };

        const options = {
            responsive: true,
            cutout: '70%', // Cria o efeito de "doughnut"
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.body.classList.contains('dark') ? '#cbd5e1' : '#475569' // Adapta a cor da legenda ao tema
                    }
                }
            }
        };

        // Se o gráfico já existe, atualiza os dados. Senão, cria um novo.
        if (graficoJornada) {
            graficoJornada.data = data;
            graficoJornada.update();
        } else {
            graficoJornada = new Chart(ctx, { type: 'doughnut', data, options });
        }
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
        const ultimoRegistroSalvo = localStorage.getItem('resumo_ultimoRegistro');
        const tempoTrabalhadoSalvo = localStorage.getItem('resumo_tempoTrabalhado');
        const registros = JSON.parse(localStorage.getItem('registrosVeritime') || '[]');

        // Calcula o tempo de pausa
        let tempoDePausaMs = 0;
        const saidaAlmoco = registros.find(r => r.tipo === 'Saída Almoço');
        const voltaAlmoco = registros.find(r => r.tipo === 'Volta Almoço');
        if (saidaAlmoco && voltaAlmoco) {
            tempoDePausaMs = voltaAlmoco.timestamp - saidaAlmoco.timestamp;
        } else if (saidaAlmoco) {
            tempoDePausaMs = Date.now() - saidaAlmoco.timestamp;
        }

        if (ultimoRegistroSalvo) {
            ultimoRegistroDisplay.textContent = ultimoRegistroSalvo;
        } else {
            ultimoRegistroDisplay.textContent = 'Nenhum ponto registrado.';
        }

        const tempoTrabalhadoMs = Number(tempoTrabalhadoSalvo || '0');
        tempoTrabalhadoDisplay.textContent = msToFullTime(tempoTrabalhadoMs);

        // Renderiza o gráfico
        const tempoRestanteMs = jornadaMetaMs - tempoTrabalhadoMs;
        renderizarGrafico(tempoTrabalhadoMs, tempoDePausaMs, tempoRestanteMs);

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