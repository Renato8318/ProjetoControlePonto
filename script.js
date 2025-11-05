document.addEventListener('DOMContentLoaded', () => {
    // --- Constantes para Tipos de Ponto ---
    const TIPOS_PONTO = {
        ENTRADA: 'Entrada',
        SAIDA_ALMOCO: 'Saída Almoço',
        VOLTA_ALMOCO: 'Volta Almoço',
        SAIDA_FINAL: 'Saída Final'
    };
    
    // --- Variáveis Globais de Alarme ---
    let alarmeEntradaTimeout = null;
    let alarme5minAlmocoTimeout = null;
    let alarme10minAlmocoTimeout = null;
    
    // --- Elementos do DOM ---
    const btnEntrada = document.getElementById('btnEntrada');
    const btnSaidaAlmoco = document.getElementById('btnSaidaAlmoco');
    const btnVoltaAlmoco = document.getElementById('btnVoltaAlmoco');
    const btnSaida = document.getElementById('btnSaida');
    const btnLimpar = document.getElementById('btnLimpar');
    const tabelaCorpo = document.querySelector('#tabelaRegistro tbody');
    const statusMensagem = document.getElementById('statusMensagem');
    const relogioReal = document.getElementById('relogioReal'); 
    const somAlerta = document.getElementById('somAlerta'); 
    const inputHoraEntrada = document.getElementById('horaEntrada');
    const inputHoraSaida = document.getElementById('horaSaida');
    const inputMinutosAlmoco = document.getElementById('minutosAlmoco');
    // INPUTS DE JORNADA
    const inputJornadaHoras = document.getElementById('jornadaHoras');
    const inputJornadaMinutos = document.getElementById('jornadaMinutos');

    // Elementos de Progresso
    const barraPreenchimento = document.getElementById('barraPreenchimento');
    const porcentagemProgresso = document.getElementById('porcentagemProgresso');
    const progressoTempo = document.getElementById('progressoTempo');
    const jornadaMetaDisplay = document.getElementById('jornadaMetaDisplay');

    // Elementos de Resumo da Jornada
    const duracaoAlmocoSpan = document.getElementById('duracaoAlmoco');
    const jornadaLiquidaSpan = document.getElementById('jornadaLiquida');
    const saidaSugeriaSpan = document.getElementById('saidaSugeria');


    // --- Variáveis de Estado ---
    let registroAtual = {
        [TIPOS_PONTO.ENTRADA]: null,
        [TIPOS_PONTO.SAIDA_ALMOCO]: null,
        [TIPOS_PONTO.VOLTA_ALMOCO]: null,
        [TIPOS_PONTO.SAIDA_FINAL]: null
    };
    
    // --- Função para Obter Jornada Meta (Em milissegundos) ---
    function getJornadaMetaMs() {
        const horas = parseInt(inputJornadaHoras.value) || 8;
        const minutos = parseInt(inputJornadaMinutos.value) || 0;
        
        return (horas * 60 * 60 * 1000) + (minutos * 60 * 1000);
    }


    // --- Persistência (LocalStorage) ---

    function salvarEstado() {
        // 1. Salva os registros de ponto
        localStorage.setItem('registroPonto', JSON.stringify(registroAtual));
        
        // 2. Salva as configurações de horário e duração
        const configuracoes = {
            entrada: inputHoraEntrada.value,
            saida: inputHoraSaida.value,
            almocoMin: inputMinutosAlmoco.value,
            jornadaHoras: inputJornadaHoras.value,
            jornadaMinutos: inputJornadaMinutos.value,
        };
        localStorage.setItem('configuracoesPonto', JSON.stringify(configuracoes));
    }

    function carregarEstado() {
        // 1. Carrega as configurações de horário e duração
        const configsSalvas = localStorage.getItem('configuracoesPonto');
        if (configsSalvas) {
            const configs = JSON.parse(configsSalvas);
            inputHoraEntrada.value = configs.entrada || '09:00';
            inputHoraSaida.value = configs.saida || '18:00';
            inputMinutosAlmoco.value = configs.almocoMin || '60';
            inputJornadaHoras.value = configs.jornadaHoras || '8';
            inputJornadaMinutos.value = configs.jornadaMinutos || '0';
        }

        // 2. Carrega os registros de ponto e recria a tabela
        const registrosSalvos = localStorage.getItem('registroPonto');
        if (registrosSalvos) {
            const tempRegistro = JSON.parse(registrosSalvos);
            
            for (const [tipo, hora] of Object.entries(tempRegistro)) {
                if (hora && TIPOS_PONTO[tipo]) {
                    adicionarRegistroNaTabela(tipo, hora, false); 
                }
            }
            registroAtual = Object.fromEntries(
                Object.entries(tempRegistro).filter(([key]) => TIPOS_PONTO[key])
            );
            
            mostrarMensagem("Dados carregados com sucesso!", 'sucesso');
        }
        
        calcularDuracoes(); 
    }

    // --- Funções Auxiliares de UX/Tempo Real ---
    
    function atualizarRelogio() {
        const agora = new Date();
        const horaFormatada = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:${String(agora.getSeconds()).padStart(2, '0')}`;
        relogioReal.textContent = horaFormatada;
    }
    
    setInterval(() => {
        atualizarRelogio();
        if (!registroAtual[TIPOS_PONTO.SAIDA_FINAL] && registroAtual[TIPOS_PONTO.ENTRADA]) {
            calcularDuracoes(); 
        }
    }, 1000); 
    atualizarRelogio(); 

    function getHoraFormatada() {
        return relogioReal.textContent;
    }

    function timeToDate(timeStr) {
        if (!timeStr) return null;
        // O relógio real é formatado como HH:mm:ss, então podemos usar este formato.
        const [h, m, s] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m, s || 0, 0); 
        return date;
    }

    function msToTime(ms) {
        if (ms < 0) return `-${msToTime(Math.abs(ms))}`;
        const seconds = Math.floor(ms / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        const pad = (num) => String(num).padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
    }

    function mostrarMensagem(mensagem, tipo) {
        statusMensagem.textContent = mensagem;
        statusMensagem.className = `mensagem ${tipo}`;
        
        if (!mensagem.includes("ALERTA")) {
             setTimeout(() => {
                if (!statusMensagem.textContent.includes("ALERTA")) {
                    statusMensagem.textContent = 'Registro pronto para nova marcação.';
                    statusMensagem.className = 'mensagem sucesso';
                }
            }, 3000);
        }
    }
    
    function adicionarRegistroNaTabela(tipo, hora, salvar = true) {
        document.querySelectorAll('#tabelaRegistro tbody tr').forEach(row => {
            row.classList.remove('ultimo-registro');
        });

        const novaLinha = tabelaCorpo.insertRow();
        novaLinha.classList.add('ultimo-registro');
        
        const celulaTipo = novaLinha.insertCell(0);
        const celulaHora = novaLinha.insertCell(1);
        
        celulaTipo.textContent = tipo;
        celulaHora.textContent = hora;
        
        if (salvar) {
            registroAtual[tipo] = hora; 
            salvarEstado();
            calcularDuracoes(); 
        }
    }

    // --- Lógica Central de Cálculo de Duração ---

    function calcularDuracoes() {
        const { ENTRADA, SAIDA_ALMOCO, VOLTA_ALMOCO, SAIDA_FINAL } = TIPOS_PONTO;

        const entrada = timeToDate(registroAtual[ENTRADA]);
        const saidaAlmoco = timeToDate(registroAtual[SAIDA_ALMOCO]);
        const voltaAlmoco = timeToDate(registroAtual[VOLTA_ALMOCO]);
        const saidaFinal = timeToDate(registroAtual[SAIDA_FINAL]);
        const agora = new Date();
        
        const jornadaMetaMs = getJornadaMetaMs();
        
        let duracaoAlmocoMs = 0;
        let jornadaLiquidaMs = 0;
        let saidaSugeridaStr = '--:--';
        let porcentagem = 0;
        
        // 1. CÁLCULO DA DURAÇÃO DO ALMOÇO (BATIDO)
        if (saidaAlmoco && voltaAlmoco) {
            duracaoAlmocoMs = voltaAlmoco.getTime() - saidaAlmoco.getTime();
            if (duracaoAlmocoMs < 0) duracaoAlmocoMs = 0; 
        }
        
        const tempoTotalSubtrairMs = duracaoAlmocoMs; 

        // 2. CÁLCULO DA JORNADA LÍQUIDA
        if (entrada) {
            if (saidaFinal) {
                // Jornada concluída: (Tempo Bruto Total) - (Almoço Batido)
                jornadaLiquidaMs = (saidaFinal.getTime() - entrada.getTime()) - tempoTotalSubtrairMs;
            } else {
                // Jornada em andamento (calcula até agora)
                let tempoBrutoMs = agora.getTime() - entrada.getTime();
                jornadaLiquidaMs = tempoBrutoMs; 
                
                if (saidaAlmoco && voltaAlmoco) {
                    jornadaLiquidaMs -= duracaoAlmocoMs; 
                } else if (saidaAlmoco && !voltaAlmoco) {
                    // Almoço em andamento: subtrai o tempo até o momento
                    jornadaLiquidaMs -= (agora.getTime() - saidaAlmoco.getTime());
                }
            }

            // Garante que o tempo trabalhado não seja negativo
            if (jornadaLiquidaMs < 0) jornadaLiquidaMs = 0;
            
            // CÁLCULO DA PORCENTAGEM
            porcentagem = Math.min(100, Math.floor((jornadaLiquidaMs / jornadaMetaMs) * 100)); 
        }
        
        // 3. CÁLCULO DA SAÍDA SUGERIDA
        if (entrada && voltaAlmoco && !saidaFinal) {
            // Tempo trabalhado antes do almoço
            const tempoAntesAlmocoLiquidoMs = saidaAlmoco.getTime() - entrada.getTime();
            
            // Tempo restante para completar a jornada meta líquida
            const tempoRestanteMs = jornadaMetaMs - tempoAntesAlmocoLiquidoMs; 
            
            // A Saída Sugerida é a Volta do Almoço + Tempo Restante
            const saidaSugeriaMs = voltaAlmoco.getTime() + tempoRestanteMs;

            const dataSaidaSugeria = new Date(saidaSugeriaMs);
            saidaSugeridaStr = `${String(dataSaidaSugeria.getHours()).padStart(2, '0')}:${String(dataSaidaSugeria.getMinutes()).padStart(2, '0')}`;
        } else if (saidaFinal) {
             saidaSugeridaStr = registroAtual[SAIDA_FINAL].substring(0, 5); 
        }
        
        // 4. ATUALIZAÇÃO DO DOM (Resumo e Progresso)
        
        duracaoAlmocoSpan.textContent = msToTime(duracaoAlmocoMs);
        jornadaLiquidaSpan.textContent = msToTime(jornadaLiquidaMs);
        saidaSugeriaSpan.textContent = saidaSugeridaStr;
        
        const jornadaMetaFormatada = msToTime(jornadaMetaMs).substring(0, 8); 
        const tempoLiquidoFormatado = msToTime(jornadaLiquidaMs).substring(0, 8); 
        
        jornadaMetaDisplay.textContent = jornadaMetaFormatada.substring(0, 5); 
        progressoTempo.textContent = `${tempoLiquidoFormatado} de ${jornadaMetaFormatada}`;
        
        barraPreenchimento.style.width = `${porcentagem}%`;
        porcentagemProgresso.textContent = `${porcentagem}%`;

        if (porcentagem >= 100) {
            barraPreenchimento.style.backgroundColor = '#1e7e34'; 
            porcentagemProgresso.style.color = '#fff';
        } else {
            barraPreenchimento.style.backgroundColor = '#28a745';
            porcentagemProgresso.style.color = '#333'; 
        }
        
        const progressoDiv = document.getElementById('progressoJornada');
        progressoDiv.style.display = entrada ? 'block' : 'none';
    }


    // --- Lógica de Alarmes ---
    function dispararAlarme(mensagemAlerta, vibracaoPadrao) {
        somAlerta.play().catch(e => console.log("Não foi possível tocar o som:", e));
        if ('vibrate' in navigator) {
            navigator.vibrate(vibracaoPadrao); 
        }
        mostrarMensagem(mensagemAlerta, 'erro'); 
    }
    
    function cancelarAlarmes() {
        if (alarmeEntradaTimeout) clearTimeout(alarmeEntradaTimeout);
        if (alarme10minAlmocoTimeout) clearTimeout(alarme10minAlmocoTimeout);
        if (alarme5minAlmocoTimeout) clearTimeout(alarme5minAlmocoTimeout);
        
        alarmeEntradaTimeout = null;
        alarme10minAlmocoTimeout = null;
        alarme5minAlmocoTimeout = null;
        
        if ('vibrate' in navigator) {
            navigator.vibrate(0); 
        }
    }

    function agendarAlarmeEntrada() {
        if (alarmeEntradaTimeout) clearTimeout(alarmeEntradaTimeout);
        alarmeEntradaTimeout = null;
        if (registroAtual[TIPOS_PONTO.ENTRADA]) return;
        
        // Lógica de agendamento de alarme de entrada (MANTIDA)
    }

    function agendarAlarmesAlmocoPorDuracao(saidaAlmocoDate) {
        cancelarAlarmes(); 
        
        const minutosAlmoco = parseInt(inputMinutosAlmoco.value) || 60;
        const duracaoAlmocoMs = minutosAlmoco * 60 * 1000;
        
        const horaVolta = new Date(saidaAlmocoDate.getTime() + duracaoAlmocoMs);
        const alarme10min = new Date(horaVolta.getTime() - (10 * 60 * 1000));
        const alarme5min = new Date(horaVolta.getTime() - (5 * 60 * 1000));
        const agoraMs = new Date().getTime();

        let alarmesAgendados = 0;
        const vibracaoAlmoco = [500, 200, 500];

        if (alarme10min.getTime() > agoraMs) {
            alarme10minAlmocoTimeout = setTimeout(() => {
                dispararAlarme(`🔔 ALERTA: Faltam 10 minutos para a Volta do Almoço (Prevista às ${horaVolta.toLocaleTimeString().substring(0, 5)})!`, vibracaoAlmoco);
            }, alarme10min.getTime() - agoraMs);
            alarmesAgendados++;
        }

        if (alarme5min.getTime() > agoraMs) {
            alarme5minAlmocoTimeout = setTimeout(() => {
                dispararAlarme(`🔔 ALERTA: Faltam 5 minutos para a Volta do Almoço (Prevista às ${horaVolta.toLocaleTimeString().substring(0, 5)})!`, vibracaoAlmoco);
            }, alarme5min.getTime() - agoraMs);
            alarmesAgendados++;
        }
        
        if (alarmesAgendados > 0) {
            mostrarMensagem(`Saída Almoço registrada! ${alarmesAgendados} alarmes agendados. Volta prevista: ${horaVolta.toLocaleTimeString().substring(0, 5)}.`, 'sucesso');
        } else {
             mostrarMensagem("Saída Almoço registrada! O tempo de almoço é muito curto para agendar alertas.", 'erro');
        }
    }


    // --- Lógica de Habilitação/Desabilitação dos Botões ---

    function atualizarEstadoBotoes() {
        const entradaOk = !!registroAtual[TIPOS_PONTO.ENTRADA];
        const saidaAlmocoOk = !!registroAtual[TIPOS_PONTO.SAIDA_ALMOCO];
        const voltaAlmocoOk = !!registroAtual[TIPOS_PONTO.VOLTA_ALMOCO];
        const saidaOk = !!registroAtual[TIPOS_PONTO.SAIDA_FINAL];

        const botoesEcondicoes = [
            { id: 'btnEntrada', btn: btnEntrada, disabled: entradaOk, msg: 'Entrada já registrada. Limpe para recomeçar.' },
            { id: 'btnSaidaAlmoco', btn: btnSaidaAlmoco, disabled: !entradaOk || saidaAlmocoOk || saidaOk, msg: !entradaOk ? 'Bata a Entrada primeiro.' : 'Saída almoço já registrada.' },
            { id: 'btnVoltaAlmoco', btn: btnVoltaAlmoco, disabled: !saidaAlmocoOk || voltaAlmocoOk || saidaOk, msg: !saidaAlmocoOk ? 'Bata a Saída Almoço primeiro.' : 'Volta almoço já registrada.' },
            { id: 'btnSaida', btn: btnSaida, disabled: !voltaAlmocoOk || saidaOk, msg: !voltaAlmocoOk ? 'Bata a Volta do Almoço primeiro.' : 'Saída final já registrada.' },
        ];

        botoesEcondicoes.forEach(({ btn, disabled, msg }) => {
            btn.disabled = disabled;
            
            if (disabled) {
                btn.setAttribute('aria-label', msg);
                btn.setAttribute('title', msg); 
            } else {
                btn.removeAttribute('aria-label');
                btn.removeAttribute('title');
            }
        });
    }
    
    // --- Funções de Manipulação de Ponto (Com Validação H) ---
    
    function chamarFuncaoPonto(tipo) {
        const horaAtualFormatada = getHoraFormatada();
        const horaAtualDate = timeToDate(horaAtualFormatada);
        
        let chave;
        if (tipo.includes(TIPOS_PONTO.ENTRADA)) chave = TIPOS_PONTO.ENTRADA;
        else if (tipo.includes(TIPOS_PONTO.SAIDA_ALMOCO)) chave = TIPOS_PONTO.SAIDA_ALMOCO;
        else if (tipo.includes(TIPOS_PONTO.VOLTA_ALMOCO)) chave = TIPOS_PONTO.VOLTA_ALMOCO;
        else if (tipo.includes(TIPOS_PONTO.SAIDA_FINAL)) chave = TIPOS_PONTO.SAIDA_FINAL;

        if (!chave) return;

        // 1. VALIDAÇÃO DE CLIQUE RÁPIDO / TEMPO NEGATIVO (Implementação H)
        const pontosEmOrdem = [TIPOS_PONTO.ENTRADA, TIPOS_PONTO.SAIDA_ALMOCO, TIPOS_PONTO.VOLTA_ALMOCO, TIPOS_PONTO.SAIDA_FINAL];
        const indiceAtual = pontosEmOrdem.indexOf(chave);
        
        if (indiceAtual > 0) {
            const pontoAnteriorChave = pontosEmOrdem[indiceAtual - 1];
            const pontoAnteriorHora = registroAtual[pontoAnteriorChave];
            
            if (pontoAnteriorHora) {
                const pontoAnteriorDate = timeToDate(pontoAnteriorHora);
                const diferencaMs = horaAtualDate.getTime() - pontoAnteriorDate.getTime();
                
                // Validação de Diferença de Tempo (Mínimo de 1 segundo)
                if (diferencaMs < 1000) { 
                    mostrarMensagem(`❌ ERRO: O registro de ${chave} deve ser batido pelo menos 1 segundo após ${pontoAnteriorChave}.`, 'erro');
                    return; 
                }
                
                // Validação de Tempo Negativo de Intervalo
                if (chave === TIPOS_PONTO.VOLTA_ALMOCO && diferencaMs < 0) {
                    mostrarMensagem(`❌ ERRO: O registro de Volta Almoço não pode ser antes do Saída Almoço.`, 'erro');
                    return; 
                }
            }
        }
        
        // 2. REGISTRO
        adicionarRegistroNaTabela(chave, horaAtualFormatada, true); 
        
        if (chave === TIPOS_PONTO.SAIDA_ALMOCO) {
            const saidaAlmocoDate = timeToDate(horaAtualFormatada);
            agendarAlarmesAlmocoPorDuracao(saidaAlmocoDate);
        } else if (chave === TIPOS_PONTO.VOLTA_ALMOCO) {
            cancelarAlarmes();
        }

        mostrarMensagem(`${chave} registrada com sucesso!`, 'sucesso');
        atualizarEstadoBotoes();
    }
    
    function limparRegistros() {
        if (confirm("Tem certeza que deseja limpar todos os registros do dia?")) {
            tabelaCorpo.innerHTML = ''; 
            registroAtual = { 
                [TIPOS_PONTO.ENTRADA]: null,
                [TIPOS_PONTO.SAIDA_ALMOCO]: null,
                [TIPOS_PONTO.VOLTA_ALMOCO]: null,
                [TIPOS_PONTO.SAIDA_FINAL]: null
            }; 
            cancelarAlarmes(); 
            salvarEstado(); 
            agendarAlarmeEntrada();
            mostrarMensagem("Registros limpos. Aguardando a Entrada.", 'erro');
            atualizarEstadoBotoes(); 
            calcularDuracoes(); 
        }
    }

    // --- Inicialização e Event Listeners ---
    
    function configurarListenersBotoes() {
        [btnEntrada, btnSaidaAlmoco, btnVoltaAlmoco, btnSaida].forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) {
                    const msg = btn.getAttribute('aria-label') || 'Ação fora de ordem.';
                    mostrarMensagem(msg, 'erro');
                    btn.classList.add('tremor');
                    setTimeout(() => btn.classList.remove('tremor'), 600);
                } else {
                    const tipo = btn.textContent.trim(); 
                    chamarFuncaoPonto(tipo);
                }
            });
        });
        
        btnLimpar.addEventListener('click', limparRegistros);
        
        // Adiciona listeners para salvar a configuração (Jornada, Referência, Almoço)
        [inputHoraEntrada, inputHoraSaida, inputMinutosAlmoco, inputJornadaHoras, inputJornadaMinutos].forEach(input => {
            input.addEventListener('change', () => {
                salvarEstado(); 
                agendarAlarmeEntrada(); 
                calcularDuracoes(); 
            });
        });
    }
    
    // --- Fluxo de Inicialização ---
    carregarEstado();
    configurarListenersBotoes();
    atualizarEstadoBotoes(); 
    agendarAlarmeEntrada(); 
});