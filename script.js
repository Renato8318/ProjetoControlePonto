document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM (Página Principal) ---
    const relogio = document.getElementById('relogio');
    const statusMensagem = document.getElementById('statusMensagem');
    const tabelaRegistros = document.getElementById('tabelaRegistros').querySelector('tbody');
    const progressoJornada = document.getElementById('progressoJornada');
    const progressoTexto = document.getElementById('progressoTexto');
    const progressoTempo = document.getElementById('progressoTempo');
    const barraPreenchimento = document.getElementById('barraPreenchimento');
    
    // Alarme e Vibração
    const toggleAlarmePausa = document.getElementById('toggleAlarmePausa'); 
    const statusAlarmePausa = document.getElementById('statusAlarmePausa'); 
    const btnLimpar = document.getElementById('btnLimpar'); 
    let alarmeTimeout = null; 
    let alarmeVibrarInterval = null; 

    // Botões de Ponto
    const btnEntrada = document.getElementById('btnEntrada');
    const btnSaidaAlmoco = document.getElementById('btnSaidaAlmoco');
    const btnVoltaAlmoco = document.getElementById('btnVoltaAlmoco');
    const btnSaida = document.getElementById('btnSaida');

    // Variáveis de Estado
    let registros = [];
    let jornadaMetaMs = 0; 
    let pausaTotalMs = 0;  
    let alarmePausaAtivo = false; 

    
    // --- Lógica do Menu Hambúrguer ---
    const btnMenu = document.getElementById('btnMenu');
    const menuDropdown = document.getElementById('menuDropdown');

    btnMenu.addEventListener('click', () => {
        menuDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!btnMenu.contains(e.target) && !menuDropdown.contains(e.target)) {
            menuDropdown.classList.add('hidden');
        }
    });

    // --- FUNÇÕES DE ALARME E UTILS ---
    
    const vibrar = (padrao) => {
        if ("vibrate" in navigator) {
            navigator.vibrate(padrao);
        }
    };

    const iniciarVibracaoContinua = () => {
        if (alarmeVibrarInterval) clearInterval(alarmeVibrarInterval);
        alarmeVibrarInterval = setInterval(() => {
            vibrar([500, 200, 500]); 
            exibirMensagem('🚨 Faltam 5 minutos para o fim do intervalo de almoço! (Vibração Ativa) 🔔', 'erro');
        }, 1500); 
    };

    const pararVibracaoContinua = () => {
        if (alarmeVibrarInterval) {
            clearInterval(alarmeVibrarInterval);
            alarmeVibrarInterval = null;
        }
        if ("vibrate" in navigator) {
            navigator.vibrate(0); 
        }
    };
    
    const msToTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    const calcularTempoTrabalhado = (regs) => {
        let tempoTrabalhadoMs = 0;
        let entradaMs = 0;
        const entradas = ['Entrada', 'Volta Almoço'];
        const saidas = ['Saída Almoço', 'Saída'];

        for (const registro of regs) {
            const timeMs = registro.timestamp;
            const tipo = registro.tipo;

            if (entradas.includes(tipo)) {
                entradaMs = timeMs;
            } else if (saidas.includes(tipo)) {
                const saidaMs = timeMs;
                if (entradaMs !== 0) {
                    tempoTrabalhadoMs += (saidaMs - entradaMs);
                    entradaMs = 0; 
                }
            }
        }
        if (entradaMs !== 0) {
            tempoTrabalhadoMs += (Date.now() - entradaMs);
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

        // Atualiza progresso apenas se estiver em jornada
        if (registros.length > 0 && registros[registros.length - 1].tipo !== 'Saída') {
            updateProgresso();
        }
    };
    
    const updateAlarmePausaUI = () => {
        if (alarmePausaAtivo) {
            statusAlarmePausa.textContent = 'Alarme ATIVADO (Apenas Vibração)';
            statusAlarmePausa.classList.remove('text-gray-500');
            statusAlarmePausa.classList.add('text-green-600', 'font-semibold');
        } else {
            statusAlarmePausa.textContent = 'Desativado';
            statusAlarmePausa.classList.remove('text-green-600', 'font-semibold');
            statusAlarmePausa.classList.add('text-gray-500');
        }
    };
    
    const handleAlarmePausa = () => {
        if (alarmeTimeout) {
            clearTimeout(alarmeTimeout);
            alarmeTimeout = null;
        }
        pararVibracaoContinua(); 

        const ultimoTipo = registros.length > 0 ? registros[registros.length - 1].tipo : 'INICIO';

        if (alarmePausaAtivo && ultimoTipo === 'Saída Almoço' && pausaTotalMs > 0) {
            const ultimoRegistro = registros[registros.length - 1]; 
            const saidaAlmocoMs = ultimoRegistro.timestamp;
            
            const alarmeAtrasoMs = 5 * 60 * 1000; 
            const horarioAlarmeMs = saidaAlmocoMs + pausaTotalMs - alarmeAtrasoMs;
            
            const tempoRestanteParaAlarme = horarioAlarmeMs - Date.now();

            if (tempoRestanteParaAlarme > 0) {
                alarmeTimeout = setTimeout(() => {
                    iniciarVibracaoContinua();
                }, tempoRestanteParaAlarme);
                
                statusAlarmePausa.textContent = `Alarme agendado! Toca em: ${msToTime(tempoRestanteParaAlarme).slice(0, 5)} (restante)`;

            } else {
                if (Date.now() < saidaAlmocoMs + pausaTotalMs) {
                     iniciarVibracaoContinua();
                } else {
                    statusAlarmePausa.textContent = 'Intervalo excedido ou finalizado.';
                }
            }
        } else {
            updateAlarmePausaUI();
        }
    };


    const updateProgresso = () => {
        progressoJornada.style.display = registros.length > 0 ? 'block' : 'none';
        
        const tempoTrabalhadoMs = calcularTempoTrabalhado(registros);
        const porcentagem = Math.min(100, (tempoTrabalhadoMs / jornadaMetaMs) * 100);

        barraPreenchimento.style.width = `${porcentagem}%`;
        progressoTexto.textContent = `${porcentagem.toFixed(1)}%`;
        progressoTempo.textContent = `Tempo trabalhado: ${msToTime(tempoTrabalhadoMs)}`;

        barraPreenchimento.classList.remove('bg-yellow-500', 'bg-red-600', 'bg-green-500');
        if (porcentagem < 50) barraPreenchimento.classList.add('bg-yellow-500'); 
        else if (porcentagem < 100) barraPreenchimento.classList.add('bg-green-500'); 
        else barraPreenchimento.classList.add('bg-red-600'); 
    };

    const exibirMensagem = (texto, tipo = 'sucesso') => {
        statusMensagem.textContent = texto;
        statusMensagem.className = `p-3 mb-4 rounded font-semibold text-center mensagem ${tipo}`;
        statusMensagem.style.display = 'block';

        if (tipo === 'erro') {
            statusMensagem.classList.add('tremor');
            vibrar([100, 50, 100]); 
        } else {
            statusMensagem.classList.remove('tremor');
        }

        setTimeout(() => {
            statusMensagem.style.display = 'none';
        }, 5000);
    };

    const updateBotoes = () => {
        document.querySelectorAll('.flex.flex-wrap > button').forEach(btn => {
            btn.disabled = true;
            btn.classList.remove('tremor');
        });

        const ultimoTipo = registros.length > 0 ? registros[registros.length - 1].tipo : 'INICIO';

        switch (ultimoTipo) {
            case 'INICIO':
                btnEntrada.disabled = false;
                btnEntrada.classList.add('tremor');
                break;
            case 'Entrada':
                btnSaidaAlmoco.disabled = false;
                btnSaida.disabled = false; 
                btnSaidaAlmoco.classList.add('tremor');
                break;
            case 'Saída Almoço':
                btnVoltaAlmoco.disabled = false; 
                btnVoltaAlmoco.classList.add('tremor');
                break;
            case 'Volta Almoço':
                btnSaida.disabled = false;
                btnSaida.classList.add('tremor');
                break;
            case 'Saída':
                pararVibracaoContinua(); 
                break;
            default:
                btnEntrada.disabled = false;
                break;
        }
    };

    const atualizarEstado = () => {
        updateBotoes();
        handleAlarmePausa(); 
    };

    // --- Funções de Marcação de Ponto ---

    const registrarPonto = (tipo) => {
        const timestamp = Date.now();
        const date = new Date(timestamp);
        const horario = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

        registros.push({ tipo, horario, timestamp });
        salvarRegistros(); 
        renderizarRegistros();
        
        if (tipo === 'Volta Almoço') {
            pararVibracaoContinua(); 
        }

        atualizarEstado();
        exibirMensagem(`Ponto de ${tipo} registrado com sucesso: ${horario}`);
    };
    
    // Event Listeners Botões de Ponto 
    btnEntrada.addEventListener('click', () => { registrarPonto('Entrada'); });
    btnSaidaAlmoco.addEventListener('click', () => { 
        if (!registros.find(r => r.tipo === 'Entrada')) {
            exibirMensagem('É necessário registrar a Entrada primeiro.', 'erro');
            return;
        }
        registrarPonto('Saída Almoço'); 
    });
    btnVoltaAlmoco.addEventListener('click', () => { 
        const ultimoTipo = registros.length > 0 ? registros[registros.length - 1].tipo : 'INICIO';
        if (ultimoTipo !== 'Saída Almoço') {
             exibirMensagem('Você precisa registrar a Saída do Almoço antes de voltar.', 'erro');
            return;
        }
        registrarPonto('Volta Almoço'); 
    });
    btnSaida.addEventListener('click', () => { 
         if (!registros.find(r => r.tipo === 'Entrada')) {
            exibirMensagem('É necessário registrar a Entrada primeiro.', 'erro');
            return;
        }
        registrarPonto('Saída'); 
    });


    // --- Funções de Renderização e Persistência ---

    const renderizarRegistros = () => {
        tabelaRegistros.innerHTML = '';
        
        if (registros.length === 0) {
            const row = tabelaRegistros.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 2;
            cell.textContent = "Nenhum registro de ponto feito hoje.";
            cell.classList.add('text-center', 'text-gray-500', 'p-3');
            cell.style.border = 'none';
            return;
        }

        registros.forEach((registro, index) => {
            const row = tabelaRegistros.insertRow();
            
            if (index === registros.length - 1) {
                row.classList.add('ultimo-registro');
            } else {
                row.classList.add('bg-white', 'hover:bg-gray-50', 'transition-colors');
            }

            const cellTipo = row.insertCell(0);
            const cellHorario = row.insertCell(1);

            cellTipo.textContent = registro.tipo;
            cellHorario.textContent = registro.horario;

            cellTipo.classList.add('p-3', 'border', 'border-gray-200');
            cellHorario.classList.add('p-3', 'border', 'border-gray-200');
        });
    };

    const salvarRegistros = () => {
        localStorage.setItem('registrosVeritime', JSON.stringify(registros));
    };
    
    const salvarEstadoAlarme = () => {
        localStorage.setItem('alarmePausaAtivo', alarmePausaAtivo); 
    }

    const carregarDados = () => {
        // Carrega Registros
        const storedRegistros = localStorage.getItem('registrosVeritime');
        if (storedRegistros) {
            registros = JSON.parse(storedRegistros);
        }

        // Carrega Configurações (Meta e Pausa)
        const horas = Number(localStorage.getItem('jornadaHoras') || '8');
        const minutos = Number(localStorage.getItem('jornadaMinutos') || '0');
        jornadaMetaMs = (horas * 3600 + minutos * 60) * 1000;

        const pausaMin = Number(localStorage.getItem('pausaMinutos') || '60');
        pausaTotalMs = pausaMin * 60 * 1000; 

        // Carrega Estado do Alarme
        const storedAlarme = localStorage.getItem('alarmePausaAtivo');
        alarmePausaAtivo = storedAlarme === 'true'; 
        toggleAlarmePausa.checked = alarmePausaAtivo;

        // Atualiza a UI com os dados carregados
        renderizarRegistros();
        updateProgresso();
        atualizarEstado();
        updateAlarmePausaUI(); 
    };

    // --- Event Listener para o Toggle do Alarme ---
    toggleAlarmePausa.addEventListener('change', () => {
        alarmePausaAtivo = toggleAlarmePausa.checked;
        salvarEstadoAlarme(); 
        updateAlarmePausaUI();
        handleAlarmePausa();
        if (!alarmePausaAtivo) {
            statusAlarmePausa.textContent = 'Desativado';
            pararVibracaoContinua();
            exibirMensagem('Alarme de vibração DESATIVADO.', 'erro');
        } else {
            exibirMensagem('Alarme de vibração ATIVADO para 5 minutos antes do fim do almoço.', 'sucesso');
        }
    });

    // --- Botão Limpar ---
    btnLimpar.addEventListener('click', () => {
        if (confirm('ATENÇÃO: Tem certeza que deseja LIMPAR todos os registros de ponto e redefinir todas as configurações? Esta ação é irreversível.')) {
            localStorage.clear();
            
            registros = [];
            // Define valores default se limpar tudo
            localStorage.setItem('jornadaHoras', '8'); 
            localStorage.setItem('jornadaMinutos', '0');
            localStorage.setItem('pausaMinutos', '60');
            
            pararVibracaoContinua(); 
            if (alarmeTimeout) clearTimeout(alarmeTimeout);
            
            carregarDados();
            renderizarRegistros();
            updateProgresso();

            exibirMensagem('Todos os dados e configurações foram limpos com sucesso.', 'erro');
        }
    });

    // --- Inicialização ---
    carregarDados();
    updateRelogio();
    setInterval(updateRelogio, 1000); 
});