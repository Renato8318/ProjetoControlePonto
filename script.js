document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM ---
    const relogio = document.getElementById('relogio');
    const statusMensagem = document.getElementById('statusMensagem');
    const tabelaRegistros = document.getElementById('tabelaRegistros').querySelector('tbody');
    const progressoJornada = document.getElementById('progressoJornada');
    const barraPreenchimento = document.getElementById('barraPreenchimento');
    const progressoTexto = document.getElementById('progressoTexto');
    const progressoTempo = document.getElementById('progressoTempo');
    const resumoJornada = document.getElementById('resumoJornada');
    const entradaRegistrada = document.getElementById('entradaRegistrada');
    const saidaSugeria = document.getElementById('saidaSugeria');
    const metaTotal = document.getElementById('metaTotal');
    const pausaTotal = document.getElementById('pausaTotal');
    // NOVOS ELEMENTOS DOM para o alarme
    const toggleAlarmePausa = document.getElementById('toggleAlarmePausa'); 
    const statusAlarmePausa = document.getElementById('statusAlarmePausa'); 

    // --- Configurações Input ---
    const jornadaHorasInput = document.getElementById('jornadaHoras');
    const jornadaMinutosInput = document.getElementById('jornadaMinutos');
    const horaEntradaInput = document.getElementById('horaEntrada');
    const horaSaidaPrevistaInput = document.getElementById('horaSaidaPrevista');
    const pausaMinutosInput = document.getElementById('pausaMinutos');

    // --- Botões ---
    const btnEntrada = document.getElementById('btnEntrada');
    const btnSaidaAlmoco = document.getElementById('btnSaidaAlmoco');
    const btnVoltaAlmoco = document.getElementById('btnVoltaAlmoco');
    const btnSaida = document.getElementById('btnSaida');
    const btnLimpar = document.getElementById('btnLimpar');

    // --- Variáveis de Estado ---
    let registros = [];
    let jornadaMetaMs = (8 * 60 + 0) * 60 * 1000; // Padrão: 8h
    let pausaTotalMs = 60 * 60 * 1000; // Padrão: 60min
    let entradaHora = '09:00';
    let saidaPrevistaHora = '18:00';
    let estadoAtual = 'INICIO'; // INICIO, JORNADA, ALMOCO, FIM
    let timerInterval = null;
    
    // NOVAS VARIÁVEIS DE ESTADO para o alarme
    let alarmePausaAtivo = false; 
    let alarmeTimeout = null; 
    const audioAlarme = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3'); // URL de som simples para teste


    // --- Funções de Utilitários de Tempo ---

    /** Converte HH:MM para milissegundos a partir da meia-noite */
    const timeToMs = (time) => {
        const [h, m] = time.split(':').map(Number);
        return h * 3600000 + m * 60000;
    };

    /** Converte milissegundos em HH:MM:SS */
    const msToTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    /** Calcula o tempo trabalhado líquido em milissegundos */
    const calcularTempoTrabalhado = (regs) => {
        let tempoTrabalhadoMs = 0;
        let entradaMs = 0;
        let saidaMs = 0;

        for (const registro of regs) {
            const timeMs = registro.timestamp;
            const tipo = registro.tipo;

            if (tipo === 'Entrada') {
                entradaMs = timeMs;
            } else if (tipo === 'Saída Almoço' || tipo === 'Saída') {
                saidaMs = timeMs;
                if (entradaMs !== 0) {
                    tempoTrabalhadoMs += (saidaMs - entradaMs);
                    entradaMs = 0; // Reseta para calcular o próximo bloco
                }
            } else if (tipo === 'Volta Almoço') {
                entradaMs = timeMs;
            }
        }

        // Se a jornada estiver ativa (última marcação é Entrada ou Volta Almoço)
        if (entradaMs !== 0) {
            const agoraMs = Date.now();
            tempoTrabalhadoMs += (agoraMs - entradaMs);
        }

        return tempoTrabalhadoMs;
    };

    // --- Funções de Estado e UI ---

    const updateRelogio = () => {
        const now = new Date();
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        const s = now.getSeconds().toString().padStart(2, '0');
        relogio.textContent = `${h}:${m}:${s}`;

        if (estadoAtual !== 'INICIO' && estadoAtual !== 'FIM') {
            updateProgresso();
        }
    };
    
    // --- LÓGICA DO ALARME DE PAUSA (NOVA FUNÇÃO) ---
    const updateAlarmePausaUI = () => {
        if (alarmePausaAtivo) {
            statusAlarmePausa.textContent = 'Alarme ATIVADO';
            statusAlarmePausa.classList.remove('text-gray-500');
            statusAlarmePausa.classList.add('text-green-600', 'font-semibold');
        } else {
            statusAlarmePausa.textContent = 'Desativado';
            statusAlarmePausa.classList.remove('text-green-600', 'font-semibold');
            statusAlarmePausa.classList.add('text-gray-500');
        }
    };
    
    const handleAlarmePausa = () => {
        // 1. Limpa qualquer alarme pendente
        if (alarmeTimeout) {
            clearTimeout(alarmeTimeout);
            alarmeTimeout = null;
        }

        // 2. Só configura se o alarme estiver ativo E se o estado for ALMOCO
        if (alarmePausaAtivo && estadoAtual === 'ALMOCO') {
            const ultimoRegistro = registros[registros.length - 1]; // Deve ser 'Saída Almoço'
            if (!ultimoRegistro || ultimoRegistro.tipo !== 'Saída Almoço') return;

            const saidaAlmocoMs = ultimoRegistro.timestamp;
            const pausaMin = Number(pausaMinutosInput.value);
            const pausaTotalMs = pausaMin * 60 * 1000;
            
            // O alarme deve tocar 5 minutos ANTES do fim da pausa
            const alarmeAtrasoMs = 5 * 60 * 1000; 

            // Horário do Alarme = (Saída Almoço + Duração Total da Pausa) - 5 minutos
            const horarioAlarmeMs = saidaAlmocoMs + pausaTotalMs - alarmeAtrasoMs;
            
            const agoraMs = Date.now();
            const tempoRestanteParaAlarme = horarioAlarmeMs - agoraMs;

            if (tempoRestanteParaAlarme > 0) {
                // Configura o timer
                alarmeTimeout = setTimeout(() => {
                    audioAlarme.play();
                    exibirMensagem('🚨 Faltam 5 minutos para o fim do intervalo!', 'erro'); // Usa 'erro' para cor de destaque
                }, tempoRestanteParaAlarme);
                
                // Atualiza a UI para mostrar que o alarme está agendado
                statusAlarmePausa.textContent = `Alarme agendado! Toca em: ${msToTime(tempoRestanteParaAlarme).slice(0, 5)} (restante)`;

            } else {
                // Se o horário de alarme já passou (usuário atrasado ou marcou pausa há muito tempo)
                statusAlarmePausa.textContent = 'Intervalo excedido ou finalizado.';
            }
        } else {
             // Alarme ativo, mas estado errado (INICIO, JORNADA, FIM)
             updateAlarmePausaUI();
        }
    };
    // --- FIM DA LÓGICA DO ALARME DE PAUSA ---


    const updateProgresso = () => {
        const tempoTrabalhadoMs = calcularTempoTrabalhado(registros);
        const porcentagem = Math.min(100, (tempoTrabalhadoMs / jornadaMetaMs) * 100);

        barraPreenchimento.style.width = `${porcentagem}%`;
        progressoTexto.textContent = `${porcentagem.toFixed(1)}%`;
        progressoTempo.textContent = `Tempo trabalhado: ${msToTime(tempoTrabalhadoMs)}`;

        // Atualiza a cor da barra (usando classes Tailwind para as cores)
        if (porcentagem < 50) {
            barraPreenchimento.classList.remove('bg-green-500', 'bg-red-600');
            barraPreenchimento.classList.add('bg-yellow-500'); 
        } else if (porcentagem < 100) {
            barraPreenchimento.classList.remove('bg-yellow-500', 'bg-red-600');
            barraPreenchimento.classList.add('bg-green-500'); 
        } else {
            barraPreenchimento.classList.remove('bg-green-500', 'bg-yellow-500');
            barraPreenchimento.classList.add('bg-red-600'); 
        }

        // Atualiza o resumo
        updateResumo(tempoTrabalhadoMs);
    };

    const updateResumo = (tempoTrabalhadoMs) => {
        resumoJornada.style.display = registros.length > 0 ? 'block' : 'none';
        progressoJornada.style.display = registros.length > 0 ? 'block' : 'none';

        if (registros.length > 0) {
            const entradaTimestamp = registros.find(r => r.tipo === 'Entrada').timestamp;
            const entradaDate = new Date(entradaTimestamp);
            const entradaHoraFormatada = `${entradaDate.getHours().toString().padStart(2, '0')}:${entradaDate.getMinutes().toString().padStart(2, '0')}`;
            
            entradaRegistrada.textContent = entradaHoraFormatada;
            metaTotal.textContent = msToTime(jornadaMetaMs).slice(0, 5); // Apenas HH:MM
            pausaTotal.textContent = msToTime(pausaTotalMs).slice(0, 5); // Apenas HH:MM

            // Cálculo da Saída Sugerida (Entrada + Jornada Meta + Pausa Total)
            const saidaSugeridaMs = entradaTimestamp + jornadaMetaMs + pausaTotalMs;
            const saidaSugeridaDate = new Date(saidaSugeridaMs);

            const sh = saidaSugeridaDate.getHours().toString().padStart(2, '0');
            const sm = saidaSugeridaDate.getMinutes().toString().padStart(2, '0');

            saidaSugeria.textContent = `${sh}:${sm}`;
        }
    };

    const exibirMensagem = (texto, tipo = 'sucesso') => {
        statusMensagem.textContent = texto;
        statusMensagem.className = `p-3 mb-4 rounded font-semibold text-center mensagem ${tipo}`;
        statusMensagem.style.display = 'block';

        if (tipo === 'erro') {
            statusMensagem.classList.add('tremor');
        } else {
            statusMensagem.classList.remove('tremor');
        }

        setTimeout(() => {
            statusMensagem.style.display = 'none';
        }, 5000);
    };

    const updateBotoes = () => {
        btnEntrada.disabled = true;
        btnSaidaAlmoco.disabled = true;
        btnVoltaAlmoco.disabled = true;
        btnSaida.disabled = true;
        
        btnEntrada.classList.remove('tremor');
        btnSaidaAlmoco.classList.remove('tremor');
        btnVoltaAlmoco.classList.remove('tremor');
        btnSaida.classList.remove('tremor');


        switch (estadoAtual) {
            case 'INICIO':
                btnEntrada.disabled = false;
                btnEntrada.classList.add('tremor');
                break;
            case 'JORNADA':
                btnSaidaAlmoco.disabled = false;
                btnSaida.disabled = false;
                break;
            case 'ALMOCO':
                btnVoltaAlmoco.disabled = false;
                btnVoltaAlmoco.classList.add('tremor');
                break;
            case 'FIM':
                // Todos desativados
                break;
        }
    };

    const atualizarEstado = () => {
        const ultimoRegistro = registros[registros.length - 1];

        if (!ultimoRegistro) {
            estadoAtual = 'INICIO';
        } else {
            switch (ultimoRegistro.tipo) {
                case 'Entrada':
                case 'Volta Almoço':
                    estadoAtual = 'JORNADA';
                    break;
                case 'Saída Almoço':
                    estadoAtual = 'ALMOCO';
                    break;
                case 'Saída':
                    estadoAtual = 'FIM';
                    break;
                default:
                    estadoAtual = 'INICIO';
            }
        }
        updateBotoes();
        handleAlarmePausa(); // ATUALIZADO: Verifica/reconfigura o alarme ao mudar de estado
    };

    // --- Funções de Marcação de Ponto ---

    const registrarPonto = (tipo) => {
        const timestamp = Date.now();
        const date = new Date(timestamp);
        const horario = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

        registros.push({ tipo, horario, timestamp });
        salvarDados();
        renderizarRegistros();
        atualizarEstado();
        exibirMensagem(`Ponto de ${tipo} registrado com sucesso: ${horario}`);
    };

    // --- Event Listeners para Botões de Marcação ---
    btnEntrada.addEventListener('click', () => {
        if (estadoAtual === 'INICIO') registrarPonto('Entrada');
        else exibirMensagem('A jornada já foi iniciada.', 'erro');
    });

    btnSaidaAlmoco.addEventListener('click', () => {
        if (estadoAtual === 'JORNADA') registrarPonto('Saída Almoço');
        else exibirMensagem('Você não pode sair para o almoço agora.', 'erro');
    });

    btnVoltaAlmoco.addEventListener('click', () => {
        if (estadoAtual === 'ALMOCO') registrarPonto('Volta Almoço');
        else exibirMensagem('Você não pode voltar do almoço agora.', 'erro');
    });

    btnSaida.addEventListener('click', () => {
        if (estadoAtual === 'JORNADA') registrarPonto('Saída');
        else exibirMensagem('Você não pode finalizar a jornada agora.', 'erro');
    });

    // --- Funções de Renderização e Persistência ---

    const renderizarRegistros = () => {
        tabelaRegistros.innerHTML = ''; // Limpa a tabela
        
        if (registros.length === 0) {
            const row = tabelaRegistros.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 2;
            cell.textContent = "Nenhum registro de ponto feito hoje.";
            cell.classList.add('text-center', 'text-gray-500', 'p-3');
            cell.style.border = 'none'; // Remove borda da célula de mensagem
            return;
        }

        registros.forEach((registro, index) => {
            const row = tabelaRegistros.insertRow();
            
            // Adiciona a classe 'ultimo-registro' apenas ao último item (estilizada no <style> do HTML)
            if (index === registros.length - 1) {
                row.classList.add('ultimo-registro');
            } else {
                row.classList.add('bg-white', 'hover:bg-gray-50', 'transition-colors');
            }

            const cellTipo = row.insertCell(0);
            const cellHorario = row.insertCell(1);

            cellTipo.textContent = registro.tipo;
            cellHorario.textContent = registro.horario;

            // Adiciona estilos de célula Tailwind
            cellTipo.classList.add('p-3', 'border', 'border-gray-200');
            cellHorario.classList.add('p-3', 'border', 'border-gray-200');
        });
    };

    const salvarDados = () => {
        localStorage.setItem('registrosVeritime', JSON.stringify(registros));
        localStorage.setItem('jornadaHoras', jornadaHorasInput.value);
        localStorage.setItem('jornadaMinutos', jornadaMinutosInput.value);
        localStorage.setItem('pausaMinutos', pausaMinutosInput.value);
        localStorage.setItem('horaEntrada', horaEntradaInput.value);
        localStorage.setItem('horaSaidaPrevista', horaSaidaPrevistaInput.value);
        localStorage.setItem('alarmePausaAtivo', alarmePausaAtivo); // NOVO
    };

    const carregarDados = () => {
        const storedRegistros = localStorage.getItem('registrosVeritime');
        if (storedRegistros) {
            registros = JSON.parse(storedRegistros);
        }

        // Carrega e atualiza as configurações
        jornadaHorasInput.value = localStorage.getItem('jornadaHoras') || '8';
        jornadaMinutosInput.value = localStorage.getItem('jornadaMinutos') || '0';
        pausaMinutosInput.value = localStorage.getItem('pausaMinutos') || '60';
        horaEntradaInput.value = localStorage.getItem('horaEntrada') || '09:00';
        horaSaidaPrevistaInput.value = localStorage.getItem('horaSaidaPrevista') || '18:00';
        
        // Carrega e atualiza o estado do alarme (NOVO)
        const storedAlarme = localStorage.getItem('alarmePausaAtivo');
        alarmePausaAtivo = storedAlarme === 'true'; 
        toggleAlarmePausa.checked = alarmePausaAtivo;

        atualizarConfiguracoes();
        renderizarRegistros();
        atualizarEstado();
        updateAlarmePausaUI(); // Chama a nova função para atualizar o texto do status
    };

    const atualizarConfiguracoes = () => {
        const horas = Number(jornadaHorasInput.value);
        const minutos = Number(jornadaMinutosInput.value);
        jornadaMetaMs = (horas * 3600 + minutos * 60) * 1000;

        const pausaMin = Number(pausaMinutosInput.value);
        pausaTotalMs = pausaMin * 60 * 1000;

        // Atualiza variáveis de referência (sem afetar cálculos por enquanto)
        entradaHora = horaEntradaInput.value;
        saidaPrevistaHora = horaSaidaPrevistaInput.value;
        
        salvarDados();
        updateProgresso(); // Atualiza os cálculos de resumo
        handleAlarmePausa(); // Re-checa o alarme se as configurações de tempo mudarem
    };

    // --- Event Listeners para Configurações ---
    document.querySelectorAll('.configuracao input').forEach(input => {
        input.addEventListener('change', atualizarConfiguracoes);
    });
    
    // --- Event Listener para o Alarme de Pausa (NOVO) ---
    toggleAlarmePausa.addEventListener('change', () => {
        alarmePausaAtivo = toggleAlarmePausa.checked;
        salvarDados();
        updateAlarmePausaUI();
        handleAlarmePausa();
        // Se desativar, limpa a mensagem de agendamento
        if (!alarmePausaAtivo) {
            statusAlarmePausa.textContent = 'Desativado';
        }
    });

    // --- Botão Limpar ---
    btnLimpar.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar todos os registros e configurações? Esta ação é irreversível.')) {
            localStorage.removeItem('registrosVeritime');
            localStorage.clear(); // Limpa todas as configurações salvas
            
            // Reseta variáveis e inputs para o padrão
            registros = [];
            jornadaMetaMs = (8 * 60 + 0) * 60 * 1000;
            pausaTotalMs = 60 * 60 * 1000;
            jornadaHorasInput.value = 8;
            jornadaMinutosInput.value = 0;
            pausaMinutosInput.value = 60;
            
            // Também reseta o alarme (NOVO)
            if (alarmeTimeout) clearTimeout(alarmeTimeout);
            alarmePausaAtivo = false;
            toggleAlarmePausa.checked = false;


            carregarDados(); // Recarrega para resetar a UI
            renderizarRegistros();
            atualizarEstado();
            updateProgresso();

            exibirMensagem('Todos os dados foram limpos com sucesso.', 'sucesso');
        }
    });

    // --- Inicialização ---
    carregarDados();
    // Inicia o relógio e o loop de atualização do progresso
    updateRelogio();
    timerInterval = setInterval(updateRelogio, 1000); 
});