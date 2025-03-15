const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const venom = require('venom-bot');
const path = require('path');
const fs = require('fs');
const ini = require('ini');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const { init, resendIntervalId, resendInit, stopPlanilhaLoop } = require('./index');
  // Importando a função init do index.js

const configPath = path.join(__dirname, 'config.ini');
let client = null;
let currentPage = null; // Para controlar em qual página o usuário está
let isReconnecting = false; // Nova variável para controlar o estado de reconexão
let qrUpdateInterval = null; // Nova variável para controlar o intervalo de atualização do QR

const statusTranslation = {
    initBrowser: "Iniciando o navegador",
    openBrowser: "O navegador foi aberto com sucesso!",
    connectBrowserWs: "Conexão com BrowserWs feita com sucesso!",
    initWhatsapp: "Iniciando o WhatsApp!",
    erroPageWhatsapp: "Erro ao acessar a página do WhatsApp",
    successPageWhatsapp: "Página WhatsApp acessada com sucesso",
    waitForLogin: "Aguardando verificação de login!",
    waitChat: "Aguardando o carregamento do chat",
    successChat: "Conectado",
    isLogged: "Conectado",
    notLogged: "Por favor, escaneie o QR CODE",
    browserClose: "Se o navegador estiver fechado, este parâmetro será retornado",
    qrReadSuccess: "QR Code lido com sucesso!",
    qrReadFail: "Falha ao ler o QR Code!",
    autocloseCalled: "O navegador foi fechado usando o comando autoClose",
    desconnectedMobile: "O cliente desconectou-se do celular",
    serverClose: "O cliente desconectou-se do servidor WebSocket",
    deleteToken: "Sessão deletada manualmente",
    chatsAvailable: "Conectado e lista de bate-papo disponível",
    deviceNotConnected: "Chat não disponível porque o telefone está desconectado",
    serverWssNotConnected: "O endereço WebSocket não foi encontrado!",
    noOpenBrowser: "Não foi encontrado no navegador ou algum comando está faltando em args"
};

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'images')));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// Rota principal
app.get('/', (req, res) => {
    res.render('index');
});

// Rota de comunicação
app.get('/comunicacao', async (req, res) => {
    currentPage = 'comunicacao';
    res.render('comunicacao');
});

// Rota de configuração
app.get('/config', async (req, res) => {
    console.log("Acessando a página de configuração...");
    currentPage = 'config';

    // Se estiver na página de configuração, encerra qualquer conexão existente
    if (client) {
        console.log("Encerrando a sessão do Venom ao acessar configurações...");
        try {
            // Parar o loop da planilha primeiro
            stopPlanilhaLoop(io);
            
            // Limpar intervalo de reenvio
            if (resendIntervalId) {
                clearInterval(resendIntervalId);
            }
            
            // Limpar intervalo de atualização do QR
            if (qrUpdateInterval) {
                clearInterval(qrUpdateInterval);
            }
            
            // Aguardar um momento para garantir que todas as operações foram encerradas
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Fechar o cliente
            await client.close();
            client = null;
            
            console.log("Sessão do Venom encerrada com sucesso");
        } catch (error) {
            console.error("Erro ao encerrar a sessão do Venom:", error);
            // Forçar limpeza mesmo em caso de erro
            client = null;
            if (resendIntervalId) {
                clearInterval(resendIntervalId);
            }
            if (qrUpdateInterval) {
                clearInterval(qrUpdateInterval);
            }
        }
    }

    let config = { funcionarios: {}, config: {}, google_auth: {} };
    if (fs.existsSync(configPath)) {
        config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // Preenchendo valores padrão do google_auth
    config.google_auth = config.google_auth || {};
    config.google_auth.type = config.google_auth.type || "service_account";
    config.google_auth.project_id = config.google_auth.project_id || "";
    config.google_auth.private_key_id = config.google_auth.private_key_id || "";
    config.google_auth.private_key = config.google_auth.private_key || "";
    config.google_auth.client_email = config.google_auth.client_email || "";
    config.google_auth.client_id = config.google_auth.client_id || "";
    config.google_auth.auth_uri = config.google_auth.auth_uri || "https://accounts.google.com/o/oauth2/auth";
    config.google_auth.token_uri = config.google_auth.token_uri || "https://oauth2.googleapis.com/token";
    config.google_auth.auth_provider_x509_cert_url = config.google_auth.auth_provider_x509_cert_url || "https://www.googleapis.com/oauth2/v1/certs";
    config.google_auth.client_x509_cert_url = config.google_auth.client_x509_cert_url || "";
    config.google_auth.universe_domain = config.google_auth.universe_domain || "googleapis.com";

    res.render('config', { config });
});

app.post('/save-config', async (req, res) => {
    const configPath = path.join(__dirname, 'config.ini');

    let config = {};
    if (fs.existsSync(configPath)) {
        config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // Atualizar funcionários
    config.funcionarios = {};
    const nomes = req.body.funcionarios?.nomes || [];
    const numeros = req.body.funcionarios?.numeros || [];

    nomes.forEach((nome, index) => {
        config.funcionarios[nome] = numeros[index];
    });

    // Atualizar configurações gerais
    config.config = {
        resend_interval: req.body.config.resend_interval,
        id_planilha: req.body.config.id_planilha,
        pendingColumn: req.body.config.pendingColumn,
        range: req.body.config.range,
        numeroEncarregado: req.body.config.numeroEncarregado
    };

    config.google_auth = {
        type: "service_account",
        project_id: req.body.google_auth.project_id,
        private_key_id: req.body.google_auth.private_key_id,
        private_key: (req.body.google_auth.private_key).replace(/\r/g, ''),
        client_email: req.body.google_auth.client_email,
        client_id: req.body.google_auth.client_id,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: req.body.google_auth.client_x509_cert_url,
        universe_domain: "googleapis.com"
    };

    // Salvar no arquivo
    fs.writeFileSync(configPath, ini.stringify(config));

    res.redirect('/'); // Redireciona para a página principal
});

const createVenomSession = async () => {
    if (isReconnecting) {
        console.log("Já existe uma reconexão em andamento...");
        return;
    }

    console.log("Tentando criar uma nova sessão do Venom...");
    isReconnecting = true;
    const outPath = path.join(__dirname, 'images', 'out.png');;
    try {
        if (fs.existsSync(outPath)) {
            try {
                fs.unlinkSync(outPath);
                console.log('Arquivo out.png deletado com sucesso');
            } catch (error) {
                console.error('Erro ao deletar arquivo out.png:', error);
            }
        }
            client = await venom.create({
            session: "whatsappSessionIntregationSheets",
            headless: true, // Forçar headless true em produção
            useChrome: false,
            browserArgs: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-extensions'
            ],
            puppeteerOptions: {
                executablePath: process.env.CHROMIUM_PATH || undefined,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            },
            disableWelcome: true,
            debug: false,
            logQR: true,
            updatesLog: true,
            catchQR: (base64Qr, asciiQR) => {
                console.log(asciiQR);
                var matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
                    response = {};

                if (matches.length !== 3) {
                    return new Error('Invalid input string');
                }
                response.type = matches[1];
                response.data = new Buffer.from(matches[2], 'base64');

                var imageBuffer = response;

                require('fs').writeFile(
                    './images/out.png',
                    imageBuffer['data'],
                    'binary',
                    function (err) {
                        if (err != null) {
                            console.log(err);
                        }
                    }
                );

                // Função para atualizar o QR code
                setTimeout(() => {
                    io.emit('ready', './out.png');
                }, 3000);

            },
            statusFind: (statusSession, session) => {
                console.log('Status Session: ', statusSession);
                console.log('Nome da sessão: ', session);
                const translatedStatus = statusTranslation[statusSession] || statusSession;
                io.emit('status', translatedStatus);

                // Configurar intervalo de atualização do QR Code quando estiver aguardando scan
                if (statusSession === 'waitForLogin' || statusSession === 'notLogged') {
                    if (!qrUpdateInterval) {
                        qrUpdateInterval = setInterval(() => {
                            const outPath = path.join(__dirname, 'images', 'out.png');
                            if (fs.existsSync(outPath)) {
                                io.emit('ready', './out.png');
                            }
                        }, 3000);
                    }
                }

                // Deletar o arquivo out.png e limpar o intervalo quando o status for connected
                if (statusSession === 'successChat' || statusSession === 'isLogged' || statusSession === 'chatsAvailable') {
                    if (fs.existsSync(outPath)) {
                        try {
                            fs.unlinkSync(outPath);
                            console.log('Arquivo out.png deletado com sucesso');
                        } catch (error) {
                            console.error('Erro ao deletar arquivo out.png:', error);
                        }
                    }
                    // Limpar o intervalo de atualização do QR
                    if (qrUpdateInterval) {
                        clearInterval(qrUpdateInterval);
                        qrUpdateInterval = null;
                    }
                }
            }
        });
        if(client){
            console.log("Sessão do Venom criada com sucesso.");
            isReconnecting = false;
        }
        // Chame a função init passando o novo client
        await init(client, io);
    } catch (error) {
        if (fs.existsSync(outPath)) {
            try {
                fs.unlinkSync(outPath);
                console.log('Arquivo out.png deletado com sucesso');
            } catch (error) {
                console.error('Erro ao deletar arquivo out.png:', error);
            }
        }
        console.error("Erro detalhado ao criar sessão:", error);
        if(client){
            await client.close();
            client = null;
        }
        isReconnecting = false;
        setTimeout(reconnection, 5000);
        io.emit('error', 'Erro ao criar sessão Venom. Recarregue a página.');
    }
};

let reconnectTimeout = null; // Criamos uma variável global para armazenar a tentativa de reconexão

const reconnection = async () => {
    if (client) {
        try {
            await client.close(); // Fechar a sessão anterior, se existir
            client = null; // Zerar a variável client
        } catch (error) {
            console.error('Erro ao fechar a sessão Venom:', error);
        }
    }

    console.log('Reiniciando a sessão do Venom...');
    createVenomSession(); // Chama a função para criar uma nova sessão
};

io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    socket.on('checkConnection', () => {
        if (client) {
            socket.emit('status', 'Conectado');
        } else {
            socket.emit('status', 'Desconectado');
        }
    });

    socket.on('connection', async () => {
        // Só permite conexão se estiver na página de comunicação
        if (currentPage !== 'comunicacao') {
            socket.emit('error', 'Conexão só é permitida na página de comunicação');
            return;
        }

        if (!client) {
            console.log("Nenhuma sessão ativa. Criando nova sessão do Venom...");
            await createVenomSession();
        }
    });

    socket.on('resend', async () => {
        if (currentPage !== 'comunicacao') {
            socket.emit('error', 'Reenvio só é permitido na página de comunicação');
            return;
        }

        try {
            // Verificar se o cliente existe
            if (!client) {
                io.emit('log', 'Cliente não inicializado. Criando nova sessão...');
                await createVenomSession();
                return;
            }

            // Verificar se o cliente está realmente conectado
            try {
                if(client){
                    io.emit('status', 'Conectado');
                }
            } catch (error) {
                console.error('Erro ao verificar estado:', error);
                io.emit('log', 'Cliente não está conectado. Tentando reconectar...');
                io.emit('status', 'Desconectado');
                
                // Limpar recursos antes de reconectar
                if (client) {
                    try {
                        await client.close();
                        client = null;
                    } catch (e) {
                        console.error('Erro ao fechar cliente:', e);
                    }
                }
                
                // Limpar intervalos
                if (resendIntervalId) {
                    clearInterval(resendIntervalId);
                }
                if (qrUpdateInterval) {
                    clearInterval(qrUpdateInterval);
                }
                
                // Parar o loop da planilha
                stopPlanilhaLoop(io);
                
                // Criar nova sessão
                await createVenomSession();
                return;
            }

            // Se chegou aqui, o cliente está conectado
            await resendInit(client, io);
            
        } catch (error) {
            console.error('Erro detalhado:', error);
            io.emit('log', 'Erro ao chamar reenvio:', error.message);
            io.emit('log', 'Perda de comunicação com o Venom. Sistema será reiniciado...');
            io.emit('status', 'Desconectado');
            
            // Reiniciar a comunicação
            if (client) {
                try {
                    await client.close();
                    client = null;
                } catch (error) {
                    console.error('Erro ao fechar a sessão Venom:', error);
                }
            }
            
            // Limpar intervalos
            if (resendIntervalId) {
                clearInterval(resendIntervalId);
            }
            if (qrUpdateInterval) {
                clearInterval(qrUpdateInterval);
            }
            
            // Parar o loop da planilha
            stopPlanilhaLoop(io);
            
            // Criar nova sessão após um pequeno delay
            if (!isReconnecting) {
                setTimeout(async () => {
                    console.log('Reiniciando a sessão do Venom...');
                    await createVenomSession();
                }, 5000);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
    });

    socket.on('getPlanilhaId', () => {
        let config = {};
        if (fs.existsSync(configPath)) {
            config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        
        if (config.config && config.config.id_planilha) {
            socket.emit('planilhaId', config.config.id_planilha);
        } else {
            socket.emit('planilhaId', null);
        }
    });
});


