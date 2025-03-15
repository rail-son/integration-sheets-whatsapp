const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Caminho onde o Puppeteer vai armazenar o cache do browser
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
    // Não baixar o Chromium, vamos usar o Chrome instalado
    downloadBrowser: false,
    // Caminho para o executável do Chrome
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
}; 