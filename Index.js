const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot running'));
app.listen(PORT, () => console.log('Server on ' + PORT));

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Chrome', 'Chrome', '1.0']
  });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('CONNECTED!');
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    }
  });

  if (!sock.authState.creds.registered) {
    const phone = (process.env.PHONE_NUMBER || '').replace(/[^0-9]/g, '');
    console.log('Waiting to request code for ' + phone);
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phone);
        console.log('=== NEW PAIRING CODE ===');
        console.log('PHONE: ' + phone);
        console.log('CODE: ' + code);
        console.log('=======================');
      } catch (e) {
        console.log('Pairing error: ' + e.message);
        setTimeout(() => start(), 10000);
      }
    }, 5000);
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    if (text.toLowerCase() === 'hi') {
      await sock.sendMessage(m.key.remoteJid, { text: 'Hello! Bot online ✅' });
    }
  });
}
start();
