# 🌐 Integraton-Sheets-Whatsapp


# 1. Tecnologias Inclusas

## Frontend
- **HTML/CSS**: Estrutura e estilização das páginas
- **Bootstrap**: Framework CSS para layout responsivo
- **Font Awesome**: Ícones para interface
- **Socket.IO Client**: Comunicação em tempo real com o servidor

## Backend
- **Node.js**: Ambiente de execução
- **Express.js**: Framework web
- **Socket.IO**: Comunicação em tempo real
- **Venom-bot**: Cliente WhatsApp
- **Google Sheets API**: Integração com planilhas
- **INI Parser**: Leitura de arquivos de configuração

# 2. Configuração (config.ini)

O arquivo `config.ini` contém três seções principais:

## [funcionarios]
```ini
[funcionarios]
GILSON=553491737875
JEFERSON=553491737875
BRUNO=553491737875
# ... outros funcionários
```
- Mapeia o nome do funcionário com seu número de WhatsApp
- Formato: NOME=NÚMERO (com código do país)

## [config]
```ini
[config]
resend_interval=30
id_planilha=1TCkw3y54WPzu0YOHguVro4S7ZyngXQnDxh7xSJnO3to
pendingColumn=COLETA DO DIA!G
range=COLETA DO DIA!A1:G
numeroEncarregado=5534991737875
```
- `resend_interval`: Tempo em minutos para verificar a planilha
- `id_planilha`: ID da planilha do Google Sheets
- `pendingColumn`: Coluna que indica status da mensagem
- `range`: Intervalo de células a serem lidas
- `numeroEncarregado`: Número do WhatsApp do encarregado

## [google_auth]
```ini
[google_auth]
type=service_account
project_id=integracaocomsheetscorreios
private_key_id=d8c02e1cc2ccc7dd6c166ad8dcf4a5919fc4d788
private_key="-----BEGIN PRIVATE KEY-----\n..."
client_email=teste-integracao@integracaocomsheetscorreios.iam.gserviceaccount.com
# ... outras configurações do Google
```
- Credenciais necessárias para acessar a API do Google Sheets

# 3. Token Google Developer

Para integrar com o Google Sheets, é necessário:

1. Criar um projeto no Google Cloud Console
2. Habilitar a Google Sheets API
3. Criar uma conta de serviço
4. Gerar uma chave privada (arquivo JSON)
5. Compartilhar a planilha com o email da conta de serviço

O token é armazenado no arquivo `config.ini` na seção `[google_auth]` e é usado para:
- Autenticar requisições à API
- Ler dados da planilha
- Atualizar status das mensagens

# 4. Integração com Venom

O Venom é usado para:
1. Criar uma sessão do WhatsApp
2. Gerar QR Code para login
3. Manter conexão com WhatsApp
4. Enviar mensagens

Processo de conexão:
```javascript
1. Usuário clica em "Conectar"
2. Sistema gera QR Code
3. Usuário escaneia QR Code
4. Sistema estabelece conexão
5. Status é atualizado para "Conectado"
```

# 5. Dados da Planilha

A planilha deve conter as seguintes colunas:
1. **Hora**: Horário da solicitação
2. **Código**: Código da empresa
3. **Veículo**: Identificação do veículo
4. **Observação**: Detalhes adicionais
5. **Funcionário**: Nome do funcionário
6. **Empresa**: Nome da empresa
7. **Status**: Estado da mensagem (PENDENTE/ENVIADO)

Formato da mensagem enviada:
```
Código da Empresa: [código]
Empresa: [empresa]
Veículo: [veículo]
Funcionário: [funcionário]
Observação: [observação]
Hora da Solicitação: [hora]
```

# 6. Mensagens para o Encarregado

O encarregado recebe mensagens em situações específicas:

1. **Monitoramento do Sistema**:
   - "*AUTOMAÇÃO*: *ONLINE!*" - A cada verificação da planilha

2. **Erros de Envio**:
   - "*AUTOMAÇÃO*: *ERRO: Um ou mais registros não está sendo enviados por falta de informações ou código da empresa incorreto, favor verifique.*"
   - "*AUTOMAÇÃO*: *ERRO ao enviar mensagem para [funcionário], verifique o nome e número cadastrado.*"

# 7. Interface

## Index (Página Principal)
- Botões de navegação
- Status do sistema
- Log de atividades

## Comunicação
- Status da conexão WhatsApp
- QR Code para login
- Botões de controle
- Log de atividades
- Link para planilha

## Configurações
- Configuração de funcionários
- Configurações gerais
- Credenciais do Google
- Intervalo de verificação
- ID da planilha

# 8. Caso de Uso

1. **Configuração Inicial**:
   - Acessar página de configurações
   - Configurar números dos funcionários
   - Definir ID da planilha
   - Salvar configurações

2. **Conexão WhatsApp**:
   - Acessar página de comunicação
   - Clicar em "Conectar"
   - Escanear QR Code
   - Aguardar confirmação de conexão

3. **Envio de Mensagens**:
   - Adicionar nova linha na planilha
   - Preencher dados necessários
   - Sistema verifica a cada X minutos as linhas que estão com o status "PENDENTES" ou VAZIO
   - Envia mensagem para o funcionário
   - Atualiza status na planilha

4. **Monitoramento**:
   - Verificar log de atividades
   - Acompanhar status das mensagens
   - Receber notificações de erro
   - Reenviar mensagens com falha

