const { app, BrowserWindow } = require('electron');
const express = require('express');
const venom = require('venom-bot');
const http = require('http');
const socketIo = require('socket.io');

const appExpress = express();
const server = http.createServer(appExpress);
const io = socketIo(server);
const { init, resendIntervalId, resendInit } = require('./index');  // Importando a função init do index.js
let client;
let mainWindow; // Variável para armazenar a janela principal

const statusTranslation = {
    initBrowser: "Iniciando verificação...",
    openBrowser: "Verificando conexão...",
    initWhatsapp: "Verificando conexão...",
    successPageWhatsapp: "Verificando conexão...",
    isLogged: "Conectado",
    waitForLogin: "Aguardando...",
    waitChat: "Aguardando...",
    successChat: "Conectado",
    notLogged: "Por favor, escaneie o QR CODE",
    noOpenBrowser: "Erro: Reinicie o Sistema."
};

appExpress.set("view engine", "ejs");
appExpress.get('/home', (req, res) => {
    res.render('home');
});
appExpress.use(express.static(__dirname + '/images'));

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1250,
        height: 900,
        show: false, // Não mostrar a janela até que esteja totalmente carregada
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Desabilitar isolamento de contexto para permitir uso de Node.js
        }
    });

    mainWindow.webContents.openDevTools(); // Comente ou remova esta linha
    // mainWindow.maximize(); // Maximiza a janela para preencher a tela inteira
    mainWindow.loadURL('http://localhost:3001/home');

    // Mostra a janela apenas quando ela estiver totalmente carregada
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Fechar o app quando a janela principal é fechada
    mainWindow.on('closed', () => {
        mainWindow = null;
        app.quit(); // Garante que o aplicativo será fechado corretamente
    });
};

// Espera o app estar pronto antes de criar a janela
app.whenReady().then(() => {
    server.listen(3001, () => {
        console.log('Server is listening on port 3001');
        createWindow(); // Chama a função para criar a janela do Electron somente após o servidor estar pronto
    });

    // No caso do app ser fechado no macOS e reaberto sem sair
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Fecha o app quando todas as janelas são fechadas, exceto no macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id);

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
                        socket.emit('ready', './out.png');
                    }, 3000);
                },
                statusFind: (statusSession, session) => {
                    console.log('Status Session: ', statusSession);
                    console.log('Nome da sessão: ', session);
                    const translatedStatus = statusTranslation[statusSession] || statusSession;
                    socket.emit('status', translatedStatus); // Emitindo status traduzido
                }
            });

            // Chame a função init passando o novo client
            await init(client, io);

        } catch (error) {
            console.error('Erro ao criar sessão Venom:', error);
            // Tente reconectar após um tempo
            setTimeout(reconnection, 5000); // Espera 5 segundos antes de tentar novamente
        }
    };

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

    socket.on('resend', async () => {
        try {
            io.emit('log','Forçando o reenvio...');
            await resendInit(client, io);
        } catch (error) {
            io.emit('log','Erro ao chamar reenvio:', error);
        }
    });

    socket.on('connection', reconnection);
});
