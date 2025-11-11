document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM ---
    const entradaRegistrada = document.getElementById('entradaRegistrada');
    const saidaSugeria = document.getElementById('saidaSugeria');
    const metaTotal = document.getElementById('metaTotal');
    const pausaTotalDisplay = document.getElementById('pausaTotal');
    const erroResumo = document.getElementById('erroResumo');
    
    // Elemento do Último Registro
    const ultimoRegistroDisplay = document.getElementById('ultimoRegistroDisplay'); 

    // --- Funções de Utilitários de Tempo ---
    const msToTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}`; // Apenas HH:MM para exibição
    };

    // --- Funções de Estado e UI ---
    
    const exibirErro = (texto) => {
        erroResumo.textContent = texto;
        erroResumo.style.display = 'block';
    };

    const carregarResumo = () => {
        // Carrega Configurações
        const horas = Number(localStorage.getItem('jornadaHoras') || '8');
        const minutos = Number(localStorage.getItem('jornadaMinutos') || '0');
        const jornadaMetaMs = (horas * 3600 + minutos * 60) * 1000;

        const pausaMin = Number(localStorage.getItem('pausaMinutos') || '60');
        const pausaTotalMs = pausaMin * 60 * 1000; 

        // Carrega Registros
        const storedRegistros = localStorage.getItem('registrosVeritime');
        const registros = storedRegistros ? JSON.parse(storedRegistros) : [];

        // Encontra o registro de entrada e o último registro
        const entradaRegistro = registros.find(r => r.tipo === 'Entrada');
        const ultimoRegistro = registros.length > 0 ? registros[registros.length - 1] : null;

        // 1. ATUALIZA ÚLTIMO REGISTRO
        if (ultimoRegistro) {
            // Exibe o tipo e horário do último registro. Ex: "Entrada às 20:49"
            ultimoRegistroDisplay.textContent = `${ultimoRegistro.tipo} às ${ultimoRegistro.horario.slice(0, 5)}`;
        } else {
            ultimoRegistroDisplay.textContent = 'Nenhum ponto registrado.';
        }


        // Atualiza UI com as Metas e Pausa
        metaTotal.textContent = msToTime(jornadaMetaMs);
        pausaTotalDisplay.textContent = msToTime(pausaTotalMs);

        if (!entradaRegistro) {
            entradaRegistrada.textContent = '--:--';
            saidaSugeria.textContent = '--:--';
            // Exibe erro se não houver entrada
            exibirErro('Ainda não há um registro de Entrada para calcular a Saída Sugerida.');
            return;
        }
        
        // Esconde erro se houver entrada
        erroResumo.style.display = 'none';

        const entradaTimestamp = entradaRegistro.timestamp;
        
        // Formata a Hora de Entrada
        const entradaDate = new Date(entradaTimestamp);
        const entradaHoraFormatada = `${entradaDate.getHours().toString().padStart(2, '0')}:${entradaDate.getMinutes().toString().padStart(2, '0')}`;
        entradaRegistrada.textContent = entradaHoraFormatada;

        // Cálculo da Saída Sugerida
        const saidaSugeridaMs = entradaTimestamp + jornadaMetaMs + pausaTotalMs;
        const saidaSugeridaDate = new Date(saidaSugeridaMs);

        const sh = saidaSugeridaDate.getHours().toString().padStart(2, '0');
        const sm = saidaSugeridaDate.getMinutes().toString().padStart(2, '0');

        saidaSugeria.textContent = `${sh}:${sm}`;
    };

    // A cada 5 segundos, atualiza o resumo para pegar o último ponto sem recarregar a página.
    carregarResumo();
    setInterval(carregarResumo, 5000); 
});