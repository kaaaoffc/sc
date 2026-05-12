import mongoose from 'mongoose';
import axios from 'axios';

const DlSchema = new mongoose.Schema({ count: Number });
const Download = mongoose.models.Download || mongoose.model('Download', DlSchema);

export default async function handler(req, res) {
    await mongoose.connect(process.env.MONGODB_URI);
    const stats = await Download.findOneAndUpdate({}, { $inc: { count: 1 } }, { upsert: true, new: true });
    
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const pesan = `🚀 *NOTIFIKASI DOWNLOAD SCRIPT!*\n\n` +
                  `📊 *TOTAL DOWNLOAD:* ${stats.count}\n` +
                  `📅 *TANGGAL/WAKTU:* ${waktu}\n` +
                  `🌐 *IP BROWSER:* ${ip}\n`;

    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: pesan,
        parse_mode: 'Markdown'
    });

    res.json({ url: 'https://www.mediafire.com/file/k001s9hokumihr1/SC+SATURN07+NO+ENC+V2.3.zip/file' });
}
