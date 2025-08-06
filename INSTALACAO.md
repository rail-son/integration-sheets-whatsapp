# Instruções de Instalação e Execução

## 1. Instalar Dependências

Execute o seguinte comando no terminal para instalar todas as dependências necessárias:

```bash
npm install
```

## 2. Verificar Dependências Instaladas

As seguintes dependências serão instaladas:
- `express` - Framework web
- `socket.io` - Comunicação em tempo real
- `whatsapp-web.js` - Cliente WhatsApp
- `puppeteer` - Controle do navegador
- `ini` - Leitura de arquivos INI
- `ejs` - Template engine
- `googleapis` - API do Google Sheets
- `qrcode` - Geração de QR Code
- `dotenv` - Variáveis de ambiente

## 3. Executar o Projeto

Após a instalação, execute:

```bash
npm start
```

## 4. Acessar a Aplicação

- Abra o navegador em: `http://localhost:3001`
- Vá para a página de configuração para configurar:
  - Funcionários e números
  - ID da planilha do Google Sheets
  - Credenciais do Google
- Vá para a página de comunicação para conectar o WhatsApp

## 5. Configuração do Chrome

Certifique-se de que o Google Chrome está instalado no sistema. O caminho padrão é:
- Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Linux: `/usr/bin/google-chrome-stable`

## 6. Troubleshooting

### Erro de Módulo não encontrado
Se aparecer erro de módulo não encontrado, execute:
```bash
npm install
```

### Erro de Chrome não encontrado
Se o Chrome não for encontrado, configure a variável de ambiente:
```bash
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### Erro de Permissão
Se houver erro de permissão no Windows, execute o PowerShell como administrador.

## 7. Estrutura de Arquivos

```
integration-sheets-whatsapp/
├── config.ini          # Configurações do sistema
├── config.env          # Variáveis de ambiente
├── credentials.json    # Credenciais do Google (gerado automaticamente)
├── socketio.js         # Servidor principal
├── index.js           # Lógica de negócio
├── package.json       # Dependências
└── views/             # Templates EJS
    ├── index.ejs
    ├── comunicacao.ejs
    └── config.ejs
```

## 8. Primeira Execução

1. Execute `npm install`
2. Execute `npm start`
3. Acesse `http://localhost:3001`
4. Configure as credenciais do Google Sheets
5. Configure os funcionários e números
6. Vá para comunicação e conecte o WhatsApp
7. Escaneie o QR Code
8. Teste o envio de mensagens 