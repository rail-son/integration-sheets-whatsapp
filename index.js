require('dotenv').config({ path: require('path').join(__dirname, './config.env') });
const venom = require('venom-bot');
const { google } = require('googleapis');
const fs = require('fs');
const ini = require('ini');
const path = require('path');
let resendIntervalId;

// Função para ler e processar as configurações do arquivo INI
function loadConfig(io) {
    const configPath = path.join(__dirname, './config.ini');
    if (!fs.existsSync(configPath)) {
        console.error("Arquivo 'config.ini' não encontrado.");
        io.emit('log', "Erro: Arquivo 'config.ini' não encontrado.");
        return;
    }

    const config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
    const numeroEncarregado = config.config.numeroEncarregado.replace(/"/g, '');
    const pendingColumn = config.config.pendingColumn.replace(/"/g, '');
    const range = config.config.range;
    const spreadSheet_Id = config.config.id_planilha.replace(/"/g, '');

    // Cria ou atualiza o arquivo .env com o ID da planilha
    const envContent = `spreadSheet_Id=${spreadSheet_Id}\n`;
    const envPath = path.join(__dirname, './config.env');
    fs.writeFileSync(envPath, envContent);

    const funcionariosTelefones = config.funcionarios;
    const resendInterval = parseInt(config.config.resend_interval) || 5;

    const credentials = {
        type: config.google_auth.type.replace(/"/g, ''),
        project_id: config.google_auth.project_id.replace(/"/g, ''),
        private_key_id: config.google_auth.private_key_id.replace(/"/g, ''),
        private_key: config.google_auth.private_key.replace(/\\n/g, '\n').replace(/"/g, ''),
        client_email: config.google_auth.client_email.replace(/"/g, ''),
        client_id: config.google_auth.client_id.replace(/"/g, ''),
        auth_uri: config.google_auth.auth_uri.replace(/"/g, ''),
        token_uri: config.google_auth.token_uri.replace(/"/g, ''),
        auth_provider_x509_cert_url: config.google_auth.auth_provider_x509_cert_url.replace(/"/g, ''),
        client_x509_cert_url: config.google_auth.client_x509_cert_url.replace(/"/g, ''),
        universe_domain: config.google_auth.universe_domain.replace(/"/g, '')
    };

    // Cria o arquivo credentials.json
    const credentialsPath = path.join(__dirname, './credentials.json');
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log("Arquivo CONFIG carregado com sucesso!");
    io.emit('log', "Arquivo CONFIG carregado com sucesso!");

    if (!process.env.spreadSheet_Id) {
        console.error('Erro: Faltam variáveis de ambiente necessárias no arquivo config.env.');
        io.emit('log', 'Erro: Faltam variáveis de ambiente necessárias no arquivo config.env.');
    }

    return {
        pendingColumn,
        funcionariosTelefones,
        resendInterval,
        range,
        numeroEncarregado
    };
}

// Função para autenticar com a Google Sheets API
async function getAuthsheets() {
    const credentialsPath = path.join(__dirname, './credentials.json');
    const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: 'v4', auth: client });
    return { googleSheets };
}

// Função para buscar dados da planilha
async function getDataFromSheet(googleSheets, rangeIni, io) {
    const range = `${rangeIni}`;
    try {
        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: process.env.spreadSheet_Id,
            range: range,
        });

        const values = response.data.values;
        
        if (!values || values.length === 0) {
            console.log('Nenhum dado encontrado.');
            return;
        }

        // Aqui você deve garantir que cada valor pode ser convertido em string
        values.forEach(row => {
            row.forEach((cell, index) => {
                if (cell !== null && cell !== undefined) {
                    // Se o valor não for uma string, você pode querer convertê-lo
                    if (typeof cell !== 'string') {
                        row[index] = String(cell);
                    }
                }
            });
        });

        return values;
    } catch (error) {
        console.error('Erro ao obter dados da planilha:', error);
    }
}

// Função para atualizar o status na planilha
async function atualizarStatus(googleSheets, linha, novoStatus, pendingColumn, io) {
    try {
        const field = `${pendingColumn}${linha}`;
        await googleSheets.spreadsheets.values.update({
            spreadsheetId: process.env.spreadSheet_Id,
            range: field,
            valueInputOption: 'RAW',
            resource: { values: [[novoStatus]] },
        });
        console.log(`Status atualizado na linha ${linha}: ${novoStatus}`);
        io.emit('log', `Status atualizado na linha ${linha}: ${novoStatus}`);
    } catch (error) {
        console.error(`Erro ao atualizar status na linha ${linha}:`, error);
        io.emit('log', `Erro ao atualizar status na linha ${linha}:`, error);
    }
}

async function sendMessageSafely(client, numero, mensagem) {
    try {
        const isWAPILoaded = await client.page.evaluate(() => {
            return typeof WAPI !== 'undefined';
        });

        if (!isWAPILoaded) {
            throw new Error('WAPI is not defined');
        }

        await client.sendText(`${numero}@c.us`, mensagem);
    } catch (error) {
        throw new Error(`Erro ao enviar mensagem: ${error.message}`);
    }
}

// Função para enviar mensagens e atualizar status
async function sendMessages(client, googleSheets, pendingColumn, funcionariosTelefones, resendInterval, range, numeroEncarregado, io) {
    const rows = await getDataFromSheet(googleSheets, range, io);
    if (!rows.length) {
        console.log('Planilha vazia.');
        io.emit('log', 'Planilha vazia.');
        return;
    }

    for (let index = 0; index < rows.length; index++) {
        const [time, codigo, veiculo, observacao, funcionario, empresa, status] = rows[index];

        // Verifica se as informações essenciais estão presentes

        // Verifica se o status é 'Pendente' ou se está vazio
        if (status === 'Pendente' || !status) {
            if (!empresa || !funcionario || !veiculo || !Number.isInteger(Number(codigo))) {
                const logMessage = `Erro: Linha ignorada, falta de informação ou código da empresa não localizado.`;
                console.log(logMessage);
                io.emit('log', logMessage);
                sendMessageSafely(client, numeroEncarregado, `*AUTOMAÇÃO*: *ERRO: Um ou mais registros não está sendo enviados por falta de informações ou código da empresa incorreto, favor verifique.*`);
                continue;
            }
            const funcionarios = funcionario.replace(/\*/g, '').split('/').map(nome => nome.trim());

            for (let nome of funcionarios) {
                const numero = funcionariosTelefones[nome];
                
            

                if (numero) {
                    const mensagem = `Código da Empresa: ${codigo}\nEmpresa: ${empresa}\nVeículo: ${veiculo}\nFuncionário: ${funcionario}\nObservação: ${observacao}\nHora da Solicitação: ${time}`;
                    console.log(mensagem);
                    io.emit('log', mensagem);

                    try {
                        const logMessage = `Tentando enviar mensagem para ${funcionario} (${numero})...`;
                        console.log(logMessage);
                        io.emit('log', logMessage);
                
                        await sendMessageSafely(client, numero, mensagem);
                
                        const successMessage = `Mensagem enviada para ${funcionario} no número ${numero}`;
                        console.log(successMessage);
                        io.emit('log', successMessage);
                
                        await atualizarStatus(googleSheets, index + 1, 'Enviado', pendingColumn, io);
                    } catch (error) {
                        const errorMessage = `Erro ao enviar mensagem para ${numero}: ${error.message}`;
                        console.error(errorMessage);
                        io.emit('log', errorMessage);
                
                        if (error.message.includes('WAPI is not defined') || error.message.includes('disconnected')) {
                            const disconnectMessage = 'Perda de comunicação com o Venom. Sistema deve ser reiniciado...';
                            console.error(disconnectMessage);
                            io.emit('log', disconnectMessage);
                            await io.emit('status', 'DESCONECTADO');
                            clearInterval(resendIntervalId);
                            await socket.emit('connection', reconnection);
                            process.exit();
                        }
                        process.exit();
                    }
                } else {
                    console.log(`Erro: Número de telefone para ${funcionario} não encontrado.`);
                    io.emit('log', `Erro: Número de telefone para "${funcionario}" não encontrado.`);
                    await sendMessageSafely(client, numeroEncarregado, `*AUTOMAÇÃO*: *ERRO ao enviar mensagem para "${funcionario}", verifique o nome e número cadastrado.*`);
                }
            }
        }
    }
    console.log(`A planilha será verificada novamente em ${resendInterval} minuto(s)`);
    io.emit('log', `A planilha será verificada novamente em ${resendInterval} minuto(s)`);
}

// Função para reenviar as mensagens
async function resend(client, googleSheets, pendingColumn, funcionariosTelefones, resendInterval, range, numeroEncarregado, io) {
    try {
        console.log("Analisando planilha...");
        io.emit('log',"Analisando planilha...");
        await sendMessages(client, googleSheets, pendingColumn, funcionariosTelefones, resendInterval, range, numeroEncarregado, io);
    } catch (error) {
        console.log("Erro ao enviar mensagens, verifique a conexão com o Whatsapp.");
        io.emit('log', "Erro ao enviar mensagens, verifique a conexão com o Whatsapp.");
        process.exit();
    }
}

function stopPlanilhaLoop(io) {
    if (resendIntervalId) {
        clearInterval(resendIntervalId);
        resendIntervalId = null;
        console.log("Loop de verificação da planilha interrompido.");
        io.emit('log', "Loop de verificação da planilha interrompido.");
    }
}

// Função principal para iniciar o Venom Bot
async function init(client, io) {
    const { pendingColumn, funcionariosTelefones, resendInterval, range , numeroEncarregado } = loadConfig(io);
    const { googleSheets } = await getAuthsheets();
   
    await sendMessages(client, googleSheets, pendingColumn, funcionariosTelefones, resendInterval, range, numeroEncarregado, io);
    
    if (!resendIntervalId) { // Apenas iniciar se não estiver rodando
        console.log("Iniciando loop de verificação da planilha...");
        resendIntervalId = setInterval(async () => { 
            const { pendingColumn, funcionariosTelefones, resendInterval, range , numeroEncarregado} = loadConfig(io);
            await resend(client, googleSheets, pendingColumn, funcionariosTelefones, resendInterval, range, numeroEncarregado, io);
            await sendMessageSafely(client, numeroEncarregado, "*AUTOMAÇÃO*: *ONLINE!*");
        }, resendInterval * 60 * 1000);
    }
}


async function resendInit(client, io) {
    const { pendingColumn, funcionariosTelefones, resendInterval, range , numeroEncarregado} = loadConfig(io);
    const { googleSheets } = await getAuthsheets();
   
    await sendMessages(client, googleSheets, pendingColumn, funcionariosTelefones, resendInterval, range, numeroEncarregado, io);
}

module.exports = { init, resendIntervalId, resendInit, stopPlanilhaLoop };

