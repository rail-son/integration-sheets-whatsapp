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
let client; // Definir client como variável global


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
server.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});

app.get('/home', async (req, res) => {
    let config = { funcionarios: {}, config: {}, google_auth: {} };
    if (fs.existsSync(configPath)) {
        config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // 🔄 Se não houver uma sessão ativa, recria
    if (!client) {
        console.log("🔄 Reiniciando sessão do Venom ao voltar para /home...");
        createVenomSession();
    }

    res.render('home', { config });
});


app.get('/config', async (req, res) => {
    const configPath = path.join(__dirname, 'config.ini');

    let config = { funcionarios: {}, config: {}, google_auth: {} };

    if (fs.existsSync(configPath)) {
        config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // Garantindo que google_auth sempre exista para evitar erros
    config.google_auth = config.google_auth || {};

    // Preenchendo valores padrão se estiverem ausentes
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

    // Rodar resendInit para aplicar as novas configurações
    if (typeof init === 'function' && client) {
        try {
            await init(client, io);
            console.log("Init foi executado com sucesso.");
        } catch (error) {
            console.error("Erro ao rodar init:", error);
        }
    }

    res.redirect('/home'); // Redireciona após salvar

});



const createVenomSession = async () => {
    try {
        client = await venom.create({
            headless: 'new',
            devtools: false,
            useChrome: true,
            debug: false,
            logQR: true,
            folderNameToken: "token",
            session: "whatsappSessionIntregationSheets",
            browserArgs: ["--no-sandbox", "--disable-setuid-sandbox"],
            disableSpins: true,
            disableWelcome: true,
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

                setTimeout(() => {
                    io.emit('ready', './out.png');
                }, 3000);
            },
            statusFind: (statusSession, session) => {
                console.log('Status Session: ', statusSession);
                console.log('Nome da sessão: ', session);
                const translatedStatus = statusTranslation[statusSession] || statusSession;
                io.emit('status', translatedStatus);
            }
        });

        // Chame a função init passando o novo client
        await init(client, io);

    } catch (error) {
        console.error('Erro ao criar sessão Venom:', error);
        setTimeout(reconnection, 5000);
    }
};

let reconnectTimeout = null; // Criamos uma variável global para armazenar a tentativa de reconexão

const reconnection = async () => {
    if (!client) {
        console.log("Nenhuma sessão ativa. Verificando se pode reconectar...");

        // Se reconexão estiver desativada, não tente reiniciar
        if (reconnectTimeout === null) {
            console.log("Reconexão foi desativada. O Venom não será reiniciado.");
            return;
        }

        console.log("Reiniciando a sessão do Venom...");
        createVenomSession();
    }
};

io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

    // Se um novo usuário se conectar e não houver uma sessão ativa, cria uma nova
    if (!client) {
        console.log("Nenhuma sessão ativa. Criando nova sessão do Venom...");
        createVenomSession();
    }

    socket.on('resend', async () => {
        try {
            io.emit('log', 'Forçando o reenvio...');
            await resendInit(client, io);
        } catch (error) {
            io.emit('log', 'Erro ao chamar reenvio:', error);
        }
    });

    socket.on('connection', async () => {
        if (!client) {
            console.log("Nenhuma sessão ativa. Criando nova sessão do Venom...");
            await createVenomSession();
        }
    });
});

