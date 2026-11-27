const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running! Put number in Render Environment as PHONE_NUMBER');
});
app.listen(PORT, () => console.log('Server on port ' + PORT));

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Bot', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    const phone = (process.env.PHONE_NUMBER || '').replace(/[^0-9]/g, '');
    if (phone) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phone);
          console.log('PAIRING CODE FOR ' + phone + ' : ' + code);
        } catch (e) {
          console.log('Pairing error: ' + e.message);
        }
      }, 3000);
    } else {
      console.log('NO PHONE_NUMBER env found!');
    }
  }

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('CONNECTED!');
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello') {
      await sock.sendMessage(m.key.remoteJid, { text: 'Hello! Bot is online ✅' });
    }
  });
}
start();
