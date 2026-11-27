const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");

const PHONE_NUMBER = "254143084357";

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: ["Bot", "Chrome", "1.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);
        console.log("PAIRING CODE:", code);
      } catch (e) {
        console.log("Pairing failed:", e.message);
      }
    }, 3000);
  }

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === "open") console.log("Bot Connected!");
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
    if (text.toLowerCase() === "hi" || text.toLowerCase() === "hello") {
      await sock.sendMessage(m.key.remoteJid, { text: "Hello! Bot is online ✅" });
    }
  });
}
start();
