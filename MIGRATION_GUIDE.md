# Guia de Migração: Venom para WhatsApp Web.js

## Resumo das Mudanças

Este projeto foi migrado do **venom-bot** para o **whatsapp-web.js** para melhorar a estabilidade e funcionalidade da integração com WhatsApp.

## Principais Alterações

### 1. Dependências
- **Removido:** `venom-bot`
- **Adicionado:** `whatsapp-web.js` e `qrcode`

### 2. Arquivo `socketio.js`

#### Importações
```javascript
// Antes
const venom = require('venom-bot');

// Depois
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
```

#### Criação da Sessão
```javascript
// Antes
client = await venom.create({
    session: "whatsappSessionIntregationSheets",
    // ... outras opções
    catchQR: (base64Qr, asciiQR) => { /* ... */ },
    statusFind: (statusSession, session) => { /* ... */ }
});

// Depois
client = new Client({
    authStrategy: new LocalAuth({
        clientId: "whatsappSessionIntregationSheets"
    }),
    puppeteer: {
        headless: true,
        args: [/* ... */],
        executablePath: chromePath
    }
});

// Eventos separados
client.on('qr', async (qr) => { /* ... */ });
client.on('ready', () => { /* ... */ });
client.on('authenticated', () => { /* ... */ });
client.on('auth_failure', (msg) => { /* ... */ });
client.on('disconnected', (reason) => { /* ... */ });

await client.initialize();
```

#### Fechamento da Sessão
```javascript
// Antes
await client.close();

// Depois
await client.destroy();
```

### 3. Arquivo `index.js`

#### Importações
```javascript
// Antes
const venom = require('venom-bot');

// Depois
const { Client } = require('whatsapp-web.js');
```

#### Envio de Mensagens
```javascript
// Antes
await client.sendText(`${numero}@c.us`, mensagem);

// Depois
const chatId = `${numero}@c.us`;
await client.sendMessage(chatId, mensagem);
```

#### Verificação de Conexão
```javascript
// Antes
const isWAPILoaded = await client.page.evaluate(() => {
    return typeof WAPI !== 'undefined';
});

// Depois
if (!client.pupPage) {
    throw new Error('Cliente não está conectado');
}
```

## Instalação

1. Instale as novas dependências:
```bash
npm install
```

2. Execute o projeto:
```bash
npm start
```

## Funcionalidades Mantidas

- ✅ Conexão com WhatsApp via QR Code
- ✅ Envio de mensagens automáticas
- ✅ Integração com Google Sheets
- ✅ Sistema de reenvio
- ✅ Interface web com Socket.IO
- ✅ Configurações via arquivo INI
- ✅ Sistema de reconexão automática

## Melhorias

- **Melhor estabilidade:** whatsapp-web.js é mais estável que venom-bot
- **Eventos mais claros:** Separação clara entre diferentes eventos
- **Melhor tratamento de erros:** Mensagens de erro mais específicas
- **QR Code otimizado:** Geração de QR Code mais eficiente
- **Autenticação local:** Armazenamento seguro de sessões

## Troubleshooting

### Erro de Conexão
Se houver problemas de conexão, verifique:
1. Se o Chrome está instalado no caminho correto
2. Se as permissões de rede estão corretas
3. Se o WhatsApp Web está acessível

### Erro de QR Code
Se o QR Code não aparecer:
1. Verifique se a pasta `images/` existe
2. Verifique as permissões de escrita
3. Reinicie a aplicação

### Erro de Envio de Mensagens
Se as mensagens não forem enviadas:
1. Verifique se o WhatsApp está conectado
2. Verifique se os números estão no formato correto
3. Verifique se há conexão com a internet

### Limpeza de Sessões
Para limpar sessões antigas:
1. Delete a pasta `.wwebjs_auth` no diretório do projeto
2. Reinicie a aplicação
3. Escaneie o QR Code novamente 