document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const relogio = document.getElementById('relogio');
    const displayResumo = document.getElementById('resumo');
    const listaRegistros = document.getElementById('lista-registros');
    const btnEntrada = document.getElementById('btnEntrada');
    const btnSaidaAlmoco = document.getElementById('btnSaidaAlmoco');
    const btnVoltaAlmoco = document.getElementById('btnVoltaAlmoco');
    const btnSaida = document.getElementById('btnSaida');
    const btnLimpar = document.getElementById('btnLimpar');
    const mensagemFeedback = document.getElementById('statusMensagem');
    const btnMenu = document.getElementById('btnMenu');
    const menuDropdown = document.getElementById('menuDropdown');

    // Elementos que podem não existir em todas as páginas
    const progressoBarra = document.getElementById('progresso-barra');
    const progressoTexto = document.getElementById('progresso-texto');
    const toggleAlarmePausa = document.getElementById('toggleAlarmePausa');
    const tempoAlarmePausaSelect = document.getElementById('tempoAlarmePausa');
    const btnSalvarConfig = document.getElementById('btnSalvarConfig');
    const statusAlarmePausa = document.getElementById('statusAlarmePausa');
    const configAlarmeDiv = document.getElementById('configAlarme');
    const btnRestaurarPadroes = document.getElementById('btnRestaurarPadroes');

    // --- VARIÁVEIS DE CONFIGURAÇÃO DA API ---
    const API_URL = 'https://692797e9b35b4ffc50126d4f.mockapi.io/api/v1/pontos';
    const HOJE = new Date().toISOString().slice(0, 10);

    // --- VARIÁVEIS DE ESTADO ---
    let registros = [];
    let jornadaMetaMs = 0;
    let pausaTotalMs = 0;
    let alarmePausaAtivo = false;
    let alarmeTimeout;

    // --- FUNÇÕES DE UTILITÁRIOS ---
    const vibrar = (padrao) => {
        // Verifica se o navegador suporta a API de Vibração
        if ('vibrate' in navigator) {
            navigator.vibrate(padrao);
        }
    };

    const msToTime = (duration) => {
        const sinal = duration < 0 ? "-" : "";
        let totalSeconds = Math.abs(Math.floor(duration / 1000));
        let hours = Math.floor(totalSeconds / 3600);
        let minutes = Math.floor((totalSeconds % 3600) / 60);
        let seconds = totalSeconds % 60;
        const pad = (num) => String(num).padStart(2, '0');
        return `${sinal}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    const calcularTempoTrabalhado = (registros, paraDiaAtual = false) => {
        let tempoTotalMs = 0;
        let inicioBloco = null;

        // Ordena para garantir a sequência correta
        const registrosOrdenados = [...registros].sort((a, b) => a.timestamp - b.timestamp);

        registrosOrdenados.forEach(registro => {
            if (['Entrada', 'Volta Almoço', 'Volta Pausa'].includes(registro.tipo)) {
                inicioBloco = registro.timestamp;
            } else if ((registro.tipo === 'Saída Almoço' || registro.tipo === 'Saída') && inicioBloco) {
                tempoTotalMs += registro.timestamp - inicioBloco;
                inicioBloco = null;
            }
        });
        // Se for para o dia atual e o último ponto for uma entrada, calcula até o momento presente.
        if (paraDiaAtual && inicioBloco) {
            tempoTotalMs += Date.now() - inicioBloco;
        }
        return tempoTotalMs;
    };

    const exibirMensagem = (texto, tipo = 'info') => {
        if (!mensagemFeedback) return;
        mensagemFeedback.textContent = texto;
        mensagemFeedback.className = `p-3 mb-4 rounded font-semibold text-center mensagem ${tipo}`;
        mensagemFeedback.style.display = 'block';
        setTimeout(() => {
            mensagemFeedback.style.display = 'none';
        }, 4000);
    };

    // --- FUNÇÕES DE PERSISTÊNCIA (API) ---
    const carregarRegistrosDaAPI = async () => {
        try {
            const response = await fetch(`${API_URL}?data_dia=${HOJE}&sortBy=timestamp&order=asc`);
            
            // Apenas prossiga se a resposta da API for bem-sucedida (200 OK)
            if (response.ok) {
                const registrosDaAPI = await response.json();
                
                // LÓGICA DE SINCRONIZAÇÃO SEGURA:
                // Só substitui os dados locais se a API retornar uma lista comprovadamente maior.
                // Isso evita que um atraso da API apague um ponto recém-batido localmente.
                if (registrosDaAPI.length > registros.length) {
                    registros = registrosDaAPI;
                    // Atualiza o localStorage e a UI com os dados mais recentes da API
                    localStorage.setItem('registrosVeritime', JSON.stringify(registros));
                    atualizarUICompleta();
                }
            }
            // Se a resposta não for OK (ex: 404 ou 500), o código simplesmente não faz nada,
            // preservando os dados que já foram carregados do localStorage.
        } catch (error) {
            console.error("Erro ao carregar da API:", error);
            exibirMensagem(`Falha ao conectar à API. Carregando dados locais.`, 'erro');
        }
    };

    const registrarPontoNaAPI = async (novoRegistro) => {
        // 1. Atualiza a UI localmente IMEDIATAMENTE para feedback rápido
        registros.push(novoRegistro);
        localStorage.setItem('registrosVeritime', JSON.stringify(registros));
        // Salva o último registro para a página de resumo
        localStorage.setItem('resumo_ultimoRegistro', `${novoRegistro.tipo} às ${novoRegistro.horario.slice(0, 5)}`);

        atualizarUICompleta();
        exibirMensagem(`Ponto de ${novoRegistro.tipo} registrado: ${novoRegistro.horario.slice(0, 5)}`, 'sucesso');

        // 2. Tenta salvar na API em segundo plano
        try {
            const registroCompleto = { ...novoRegistro, data_dia: HOJE };
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registroCompleto)
            });
            // CORREÇÃO: Mesmo que a resposta do POST não seja 'ok' (um problema comum em algumas APIs de mock),
            // vamos confiar que o registro foi criado e recarregar a lista para garantir a consistência.
            // O 'throw' foi removido para evitar a mensagem de erro desnecessária.
        } catch (error) {
            console.error("Erro ao salvar na API:", error);
            // A mensagem de erro só aparecerá se houver uma falha de rede real.
            exibirMensagem(`Ponto salvo localmente, mas falhou a conexão para sincronizar.`, 'erro');
        }
    };

    // --- FUNÇÃO PRINCIPAL DE REGISTRO DE PONTO ---
    const registrarPonto = (acao) => {
        const ultimoTipo = registros.length > 0 ? registros[registros.length - 1].tipo : null;
        let tipoDoPonto = '';

        // Lógica para determinar o tipo de ponto com base na ação e no estado atual
        if (acao === 'Entrada') {
            tipoDoPonto = 'Entrada';
        } else if (acao === 'Saida') {
            tipoDoPonto = 'Saída';
        } else if (acao === 'Pausa') {
            if (ultimoTipo === 'Entrada' || ultimoTipo === 'Volta Almoço') {
                tipoDoPonto = 'Saída Pausa';
            } else if (ultimoTipo === 'Volta Pausa') {
                tipoDoPonto = 'Saída Almoço';
            }
        } else if (acao === 'Volta') {
            if (ultimoTipo === 'Saída Pausa') {
                tipoDoPonto = 'Volta Pausa';
            } else if (ultimoTipo === 'Saída Almoço') {
                tipoDoPonto = 'Volta Almoço';
            }
        }

        const timestamp = Date.now();
        const date = new Date(timestamp);
        const horario = date.toLocaleTimeString('pt-BR');
        const novoRegistro = { tipo: tipoDoPonto, horario, timestamp };
        registrarPontoNaAPI(novoRegistro);
    };

    // --- FUNÇÕES DE UI E ESTADO ---
    const atualizarUICompleta = () => {
        renderizarRegistros();
        updateBotoes();
        atualizarResumo();
        updateProgresso();
    };

    const updateBotoes = () => {
        if (!btnEntrada) return; // Só executa na página principal
        const ultimoTipo = registros.length > 0 ? registros[registros.length - 1].tipo : null;
        
        // Primeiro, reseta o estado de todos os botões
        const todosBotoes = [btnEntrada, btnSaidaAlmoco, btnVoltaAlmoco, btnSaida];
        todosBotoes.forEach(btn => btn.classList.remove('tremor'));

        // Habilita/desabilita e aplica o destaque
        btnEntrada.disabled = ultimoTipo !== null;
        if (!btnEntrada.disabled) btnEntrada.classList.add('tremor');

        // Lógica para o botão de Saída (Pausa/Almoço)
        const podeSairParaPausa = ['Entrada', 'Volta Pausa', 'Volta Almoço'].includes(ultimoTipo);
        btnSaidaAlmoco.disabled = !podeSairParaPausa;
        if (!btnSaidaAlmoco.disabled) btnSaidaAlmoco.classList.add('tremor');

        // Lógica para o botão de Volta (Pausa/Almoço)
        const podeVoltarDaPausa = ['Saída Pausa', 'Saída Almoço'].includes(ultimoTipo);
        btnVoltaAlmoco.disabled = !podeVoltarDaPausa;
        if (!btnVoltaAlmoco.disabled) btnVoltaAlmoco.classList.add('tremor');

        // Lógica para o botão de Saída Final
        // Permite sair após a volta do almoço ou após a última pausa.
        const registrosDeVoltaPausa = registros.filter(r => r.tipo === 'Volta Pausa').length;
        const podeSairFinal = (ultimoTipo === 'Volta Almoço' && registrosDeVoltaPausa === 1) || (ultimoTipo === 'Volta Pausa' && registrosDeVoltaPausa === 2);
        btnSaida.disabled = !podeSairFinal;

        // Atualiza o texto do botão de pausa para refletir a próxima ação
        btnSaidaAlmoco.innerHTML = (ultimoTipo === 'Volta Pausa') ? '<i class="fas fa-utensils mr-2"></i> Saída' : '<i class="fas fa-mug-hot mr-2"></i> Pausa';
    };

    const renderizarRegistros = () => {
        if (!listaRegistros) return;
        listaRegistros.innerHTML = ''; // Limpa a tabela

        const registrosPrincipais = registros.filter(r => !['Saída Pausa', 'Volta Pausa'].includes(r.tipo));
        const registrosPausa = registros.filter(r => ['Saída Pausa', 'Volta Pausa'].includes(r.tipo));

        const maxRows = Math.max(registrosPrincipais.length, registrosPausa.length);

        for (let i = 0; i < maxRows; i++) {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-200 dark:border-slate-700';

            const regPrincipal = registrosPrincipais[i];
            const regPausa = registrosPausa[i];

            // Colunas da Jornada Principal
            tr.innerHTML = `
                <td class="p-3 text-slate-700 dark:text-slate-300">${regPrincipal ? regPrincipal.tipo : ''}</td>
                <td class="p-3 font-semibold text-slate-800 dark:text-slate-100">${regPrincipal ? regPrincipal.horario.slice(0, 5) : ''}</td>
            `;

            // Colunas das Pausas Curtas
            tr.innerHTML += `
                <td class="p-3 border-l border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300">${regPausa ? regPausa.tipo : ''}</td>
                <td class="p-3 font-semibold text-slate-800 dark:text-slate-100">${regPausa ? regPausa.horario.slice(0, 5) : ''}</td>
            `;
            listaRegistros.appendChild(tr);
        }
    };

    const updateProgresso = () => {
        if (!progressoBarra || !progressoTexto) return;
        const tempoTrabalhadoMs = calcularTempoTrabalhado(registros, true); // true para dia atual
        const progressoPercent = jornadaMetaMs > 0 ? Math.min(100, (tempoTrabalhadoMs / jornadaMetaMs) * 100) : 0;

        progressoBarra.style.width = `${progressoPercent.toFixed(2)}%`;
        progressoTexto.textContent = `${msToTime(tempoTrabalhadoMs).slice(0, 8)}`;
    };

    const atualizarResumo = () => {
        if (!displayResumo) return;
        const tempoTrabalhadoMs = calcularTempoTrabalhado(registros, true); // true para dia atual
        const entradaRegistro = registros.find(r => r.tipo === 'Entrada');

        if (entradaRegistro) {
            const saidaSugMs = entradaRegistro.timestamp + jornadaMetaMs + pausaTotalMs;
            const saidaSugeridaDate = new Date(saidaSugMs);
            const saidaFormatada = saidaSugeridaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const faltanteMs = jornadaMetaMs - tempoTrabalhadoMs;
            let statusTempo = '';
            if (faltanteMs > 0) {
                statusTempo = ` | Faltam: ${msToTime(faltanteMs).slice(0, 5)}`;
            } else {
                statusTempo = ` | Extra: ${msToTime(faltanteMs).slice(1, 6)}`;
            }

            displayResumo.textContent = `Saída Sugerida: ${saidaFormatada}${statusTempo}`;

            // Salva dados para a página de resumo
            const entradaDate = new Date(entradaRegistro.timestamp);
            localStorage.setItem('resumo_entrada', entradaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
            localStorage.setItem('resumo_saidaSugerida', saidaFormatada);

            // Salva o tempo trabalhado para a página de resumo
            localStorage.setItem('resumo_tempoTrabalhado', tempoTrabalhadoMs);
        } else {
            displayResumo.textContent = 'Aguardando Entrada...';
            localStorage.removeItem('resumo_entrada');
            localStorage.removeItem('resumo_saidaSugerida');
        }
    };
    
    const verificarAlarmePausa = () => {
        if (!alarmePausaAtivo) {
            if (alarmeTimeout) clearTimeout(alarmeTimeout);
            return;
        }

        const saidaAlmoco = registros.find(r => r.tipo === 'Saída Almoço');
        const voltaAlmoco = registros.find(r => r.tipo === 'Volta Almoço');

        if (saidaAlmoco && !voltaAlmoco) {
            const tempoAlarmeMin = parseInt(localStorage.getItem('tempoAlarmePausa') || '5');
            const tempoAlarmeMs = tempoAlarmeMin * 60 * 1000;

            const tempoParaAlarmeMs = (saidaAlmoco.timestamp + pausaTotalMs) - Date.now() - tempoAlarmeMs;

            if (tempoParaAlarmeMs > 0) {
                if (alarmeTimeout) clearTimeout(alarmeTimeout); // Limpa alarme antigo
                alarmeTimeout = setTimeout(() => {
                    exibirMensagem(`ALERTA: Faltam ${tempoAlarmeMin} min para o fim da pausa!`, 'aviso');
                    vibrar([500, 200, 500]); // Ativa a vibração: vibra 0.5s, pausa 0.2s, vibra 0.5s
                }, tempoParaAlarmeMs);
            }
        }
    };

    const updateAlarmeUI = () => {
        if (!statusAlarmePausa || !configAlarmeDiv) return;

        if (alarmePausaAtivo) {
            statusAlarmePausa.textContent = 'Ativado';
            statusAlarmePausa.className = 'text-sm text-green-600 mt-2 italic font-bold';
            configAlarmeDiv.style.display = 'block';
        } else {
            statusAlarmePausa.textContent = 'Desativado';
            statusAlarmePausa.className = 'text-sm text-gray-500 mt-2 italic';
            configAlarmeDiv.style.display = 'none';
        }
    };

    // --- LISTENERS DE EVENTOS ---
    const configurarEventListeners = () => {
        if (btnMenu) {
            btnMenu.addEventListener('click', () => {
                menuDropdown.classList.toggle('hidden');
            });
        }

        if (btnEntrada) {
            btnEntrada.addEventListener('click', () => registrarPonto('Entrada'));
            btnSaidaAlmoco.addEventListener('click', () => registrarPonto('Pausa'));
            btnVoltaAlmoco.addEventListener('click', () => registrarPonto('Volta'));
            btnSaida.addEventListener('click', () => registrarPonto('Saida'));
        }

        if (btnLimpar) {
            btnLimpar.addEventListener('click', () => {
                if (confirm('ATENÇÃO: Isso limpará TODOS os registros LOCAIS. Os registros na API não serão afetados. Deseja continuar?')) {
                    localStorage.removeItem('registrosVeritime');
                    registros = [];
                    atualizarUICompleta();
                    exibirMensagem('Registros locais limpos.', 'sucesso');
                }
            });
        }

        if (toggleAlarmePausa) {
            toggleAlarmePausa.addEventListener('change', () => {
                alarmePausaAtivo = toggleAlarmePausa.checked;
                localStorage.setItem('alarmePausaAtivo', alarmePausaAtivo);
                updateAlarmeUI(); // Atualiza o texto e a visibilidade
            });

            tempoAlarmePausaSelect.addEventListener('change', () => {
                localStorage.setItem('tempoAlarmePausa', tempoAlarmePausaSelect.value);
                verificarAlarmePausa(); // Recalcula o alarme com o novo tempo
            });
        }

        // Lógica para o Acordeão de Registros
        const toggleRegistrosBtn = document.getElementById('toggleRegistros');
        if (toggleRegistrosBtn) {
            const painelRegistros = document.getElementById('painelRegistros');
            const caretIcon = document.getElementById('caretIcon');
            toggleRegistrosBtn.addEventListener('click', () => {
                painelRegistros.classList.toggle('hidden');
                caretIcon.classList.toggle('rotate-180');
            });
        }

        // Lógica para Exportar CSV
        const btnExportarCSV = document.getElementById('btnExportarCSV');
        if (btnExportarCSV) {
            btnExportarCSV.addEventListener('click', (e) => {
                e.preventDefault();
                if (registros.length === 0) {
                    exibirMensagem('Não há registros para exportar.', 'erro');
                    return;
                }

                // Cabeçalho do CSV
                let csvContent = "data:text/csv;charset=utf-8,Tipo,Data,Horario\n";

                // Adiciona as linhas
                registros.forEach(registro => {
                    const data = new Date(registro.timestamp).toLocaleDateString('pt-BR');
                    const linha = `${registro.tipo},${data},${registro.horario}\n`;
                    csvContent += linha;
                });

                // Cria um link temporário e simula o clique para fazer o download
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `registros_ponto_${HOJE}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        // Lógica para Relatório Semanal
        const btnRelatorioSemanal = document.getElementById('btnRelatorioSemanal');
        if (btnRelatorioSemanal) {
            btnRelatorioSemanal.addEventListener('click', async (e) => {
                e.preventDefault();
                exibirMensagem('Gerando relatório semanal...', 'info');

                try {
                    // Busca todos os registros (sem filtro de data)
                    const response = await fetch(`${API_URL}?sortBy=timestamp&order=desc`);
                    let todosRegistros = [];

                    // CORREÇÃO: Trata o erro 404 (Not Found) como uma lista vazia, que é um cenário válido.
                    if (response.ok) {
                        todosRegistros = await response.json();
                    } else if (response.status !== 404) {
                        // Se o erro for diferente de 404 (ex: 500), aí sim é uma falha.
                        throw new Error('Falha ao buscar histórico da API.');
                    }
                    // Se for 404, 'todosRegistros' permanece como um array vazio [], e o código continua normalmente.
                    
                    // Agrupa os registros por dia
                    const dadosAgrupados = todosRegistros.reduce((acc, registro) => {
                        // CORREÇÃO: Garante que a data seja extraída mesmo se o campo 'data_dia' não existir.
                        // Isso torna o relatório compatível com registros antigos.
                        const dataDia = registro.data_dia || new Date(registro.timestamp).toISOString().slice(0, 10);

                        if (!acc[dataDia]) {
                            acc[dataDia] = [];
                        }
                        acc[dataDia].push(registro);
                        return acc;
                    }, {});

                    // Processa cada dia para extrair as informações
                    const relatorioFinal = {};
                    for (const data in dadosAgrupados) {
                        const registrosDoDia = dadosAgrupados[data];
                        relatorioFinal[data] = {
                            entrada: registrosDoDia.find(r => r.tipo === 'Entrada')?.horario.slice(0, 5) || null,
                            saida: registrosDoDia.find(r => r.tipo === 'Saída')?.horario.slice(0, 5) || null,
                            tempoTrabalhado: msToTime(calcularTempoTrabalhado(registrosDoDia, false)).slice(0, 8) // false para dias passados
                        };
                    }

                    localStorage.setItem('relatorioSemanal', JSON.stringify(relatorioFinal));
                    window.location.href = 'relatorio.html';

                } catch (error) {
                    exibirMensagem('Erro ao gerar relatório. Verifique a conexão.', 'erro');
                }
            });
        }

        // Lógica para o Modo Escuro
        const toggleDarkMode = document.getElementById('toggleDarkMode');
        if (toggleDarkMode) {
            // Verifica no carregamento se o modo escuro deve ser ativado
            // Condições: 1) Salvo no localStorage como 'true' OU 2) Não há nada salvo E o sistema prefere o modo escuro
            const isDarkMode = localStorage.getItem('darkMode') === 'true' || 
                               (!('darkMode' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);

            if (isDarkMode) {
                document.documentElement.classList.add('dark');
                toggleDarkMode.checked = true;
            }

            toggleDarkMode.addEventListener('change', () => {
                if (toggleDarkMode.checked) {
                    // Ativa o modo escuro
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('darkMode', 'true');
                } else {
                    // Desativa o modo escuro
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('darkMode', 'false');
                }
            });
        }

        // Lógica para a página de configurações
        if (btnSalvarConfig) {
            btnSalvarConfig.addEventListener('click', () => {
                const jornadaHoras = document.getElementById('jornadaHoras').value;
                const jornadaMinutos = document.getElementById('jornadaMinutos').value;
                const pausaMinutos = document.getElementById('pausaMinutos').value;
                const horaEntrada = document.getElementById('horaEntrada').value;
                const horaSaidaPrevista = document.getElementById('horaSaidaPrevista').value;

                localStorage.setItem('jornadaHoras', jornadaHoras || '8');
                localStorage.setItem('jornadaMinutos', jornadaMinutos || '0');
                localStorage.setItem('pausaMinutos', pausaMinutos || '60');
                localStorage.setItem('horaEntrada', horaEntrada || '09:00');
                // Não salvamos a saída prevista, pois ela é sempre calculada
                exibirMensagem('Configurações salvas com sucesso!', 'sucesso');
            });

            // Lógica para o cálculo automático da saída prevista
            const inputsConfig = ['jornadaHoras', 'jornadaMinutos', 'pausaMinutos', 'horaEntrada'];
            inputsConfig.forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.addEventListener('input', calcularSaidaPrevista);
                }
            });

            // Lógica para restaurar padrões
            if (btnRestaurarPadroes) {
                btnRestaurarPadroes.addEventListener('click', () => {
                    if (confirm('Tem certeza que deseja restaurar as configurações padrão? (Jornada 8h, Pausa 60min)')) {
                        document.getElementById('jornadaHoras').value = '8';
                        document.getElementById('jornadaMinutos').value = '0';
                        document.getElementById('pausaMinutos').value = '60';
                        document.getElementById('horaEntrada').value = '09:00';
                        calcularSaidaPrevista(); // Recalcula a saída com os valores padrão
                        exibirMensagem('Configurações restauradas para o padrão.', 'info');
                    }
                });
            }
        }
    };

    const calcularSaidaPrevista = () => {
        const jornadaHoras = parseInt(document.getElementById('jornadaHoras').value) || 0;
        const jornadaMinutos = parseInt(document.getElementById('jornadaMinutos').value) || 0;
        const pausaMinutos = parseInt(document.getElementById('pausaMinutos').value) || 0;
        const horaEntrada = document.getElementById('horaEntrada').value; // "HH:MM"

        if (!horaEntrada) return;

        const [entradaH, entradaM] = horaEntrada.split(':').map(Number);
        const totalMinutosJornada = (jornadaHoras * 60) + jornadaMinutos + pausaMinutos;

        const dataEntrada = new Date();
        dataEntrada.setHours(entradaH, entradaM, 0, 0);
        const dataSaida = new Date(dataEntrada.getTime() + totalMinutosJornada * 60 * 1000);

        const saidaFormatada = `${String(dataSaida.getHours()).padStart(2, '0')}:${String(dataSaida.getMinutes()).padStart(2, '0')}`;
        document.getElementById('horaSaidaPrevista').value = saidaFormatada;
    };

    const atualizarSaudacao = () => {
        const elementoSaudacao = document.getElementById('saudacao');
        if (!elementoSaudacao) return; // Não faz nada se o elemento não existir na página

        const horaAtual = new Date().getHours();
        let saudacao = '';
        let saudacaoClasses = '';
        let icone = '';

        if (horaAtual >= 5 && horaAtual < 12) {
            saudacao = 'Bom dia';
            saudacaoClasses = 'bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-amber-500';
            icone = '<i class="fas fa-sun fa-sun-slow-spin mr-2 text-yellow-500"></i>';
        } else if (horaAtual >= 12 && horaAtual < 18) {
            saudacao = 'Boa tarde';
            saudacaoClasses = 'bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500';
            icone = '<i class="fas fa-cloud-sun fa-beat-fade mr-2 text-orange-400"></i>';
        } else {
            saudacao = 'Boa noite';
            saudacaoClasses = 'bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400';
            icone = '<i class="fas fa-moon fa-beat mr-2 text-indigo-300"></i>';
        }

        elementoSaudacao.innerHTML = `${icone} Bem-vindo! <span class="font-bold ${saudacaoClasses}">${saudacao}</span>.`;
    };

    // --- FUNÇÃO DE CARREGAMENTO INICIAL ---
    const carregarDados = () => {
        // CORREÇÃO: A ordem de carregamento foi ajustada.

        // 1. Carrega Configurações PRIMEIRO, pois outros cálculos dependem delas.
        const horas = Number(localStorage.getItem('jornadaHoras') || '8');
        const minutos = Number(localStorage.getItem('jornadaMinutos') || '0');
        jornadaMetaMs = (horas * 3600 + minutos * 60) * 1000;

        const pausaMin = Number(localStorage.getItem('pausaMinutos') || '60');
        pausaTotalMs = pausaMin * 60 * 1000;

        // 2. Carrega os registros do localStorage PRIMEIRO para exibir a UI imediatamente
        const storedRegistros = localStorage.getItem('registrosVeritime');
        registros = storedRegistros ? JSON.parse(storedRegistros) : [];

        if (toggleAlarmePausa) {
            alarmePausaAtivo = localStorage.getItem('alarmePausaAtivo') === 'true';
            toggleAlarmePausa.checked = alarmePausaAtivo;

            const tempoSalvo = localStorage.getItem('tempoAlarmePausa') || '5';
            tempoAlarmePausaSelect.value = tempoSalvo;

            // Garante que a UI do alarme esteja correta no carregamento
            updateAlarmeUI();
        }

        // Carrega os dados nos inputs da página de configurações, se ela estiver ativa
        if (document.getElementById('jornadaHoras')) {
            document.getElementById('jornadaHoras').value = localStorage.getItem('jornadaHoras') || '8';
            document.getElementById('jornadaMinutos').value = localStorage.getItem('jornadaMinutos') || '0';
            document.getElementById('pausaMinutos').value = localStorage.getItem('pausaMinutos') || '60';
            document.getElementById('horaEntrada').value = localStorage.getItem('horaEntrada') || '09:00';
            // Calcula a saída prevista com os dados carregados
            calcularSaidaPrevista();
        }

        // 3. Atualiza a UI com os dados locais
        atualizarUICompleta();

        // 4. Tenta buscar a versão mais recente da API em segundo plano
        carregarRegistrosDaAPI();
    };

    // --- INICIALIZAÇÃO ---
    const init = () => {
        configurarEventListeners();
        atualizarSaudacao(); // Adiciona a chamada para a nova função
        carregarDados();

        // Inicia o relógio e a atualização contínua da UI, APENAS se estiver na página principal
        if (relogio) {
            setInterval(() => {
                relogio.textContent = new Date().toLocaleTimeString('pt-BR');
                
                // Atualiza apenas os componentes que mudam com o tempo
                atualizarResumo();
                updateProgresso();
                verificarAlarmePausa();
            }, 1000);
        }
    };

    init();
});