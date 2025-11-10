document.addEventListener('DOMContentLoaded', () => {
    
    const jornadaHorasInput = document.getElementById('jornadaHoras');
    const jornadaMinutosInput = document.getElementById('jornadaMinutos');
    const pausaMinutosInput = document.getElementById('pausaMinutos');
    const horaEntradaInput = document.getElementById('horaEntrada');
    const horaSaidaPrevistaInput = document.getElementById('horaSaidaPrevista');
    const btnSalvarConfig = document.getElementById('btnSalvarConfig');
    const statusConfigMensagem = document.getElementById('statusConfigMensagem');

    // Função auxiliar para exibir mensagens de feedback
    const exibirMensagem = (texto, tipo = 'sucesso') => {
        statusConfigMensagem.textContent = texto;
        statusConfigMensagem.className = `p-3 mb-4 rounded font-semibold text-center mensagem ${tipo}`;
        statusConfigMensagem.style.display = 'block';

        setTimeout(() => {
            statusConfigMensagem.style.display = 'none';
        }, 5000);
    };

    // 1. Carregar Configurações ao Iniciar a Página
    const carregarConfiguracoes = () => {
        jornadaHorasInput.value = localStorage.getItem('jornadaHoras') || '8';
        jornadaMinutosInput.value = localStorage.getItem('jornadaMinutos') || '0';
        pausaMinutosInput.value = localStorage.getItem('pausaMinutos') || '60';
        horaEntradaInput.value = localStorage.getItem('horaEntrada') || '09:00';
        horaSaidaPrevistaInput.value = localStorage.getItem('horaSaidaPrevista') || '18:00';
    };

    // 2. Salvar Configurações
    const salvarConfiguracoes = () => {
        // Validação básica (garante que os campos não estão vazios antes de salvar)
        if (jornadaHorasInput.value === '' || jornadaMinutosInput.value === '' || pausaMinutosInput.value === '') {
             exibirMensagem('Por favor, preencha todos os campos obrigatórios da jornada e pausa.', 'erro');
             return;
        }

        localStorage.setItem('jornadaHoras', jornadaHorasInput.value);
        localStorage.setItem('jornadaMinutos', jornadaMinutosInput.value);
        localStorage.setItem('pausaMinutos', pausaMinutosInput.value);
        localStorage.setItem('horaEntrada', horaEntradaInput.value);
        localStorage.setItem('horaSaidaPrevista', horaSaidaPrevistaInput.value);
        
        exibirMensagem('Configurações salvas com sucesso!');
    };

    // 3. Adicionar Listener ao botão Salvar
    btnSalvarConfig.addEventListener('click', salvarConfiguracoes);
    
    // 4. Inicialização
    carregarConfiguracoes();
});