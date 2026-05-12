import mongoose from 'mongoose';
import axios from 'axios';
import { config } from './config.js';

const DlSchema = new mongoose.Schema({ count: { type: Number, default: 0 } });
const Download = mongoose.models.Download || mongoose.model('Download', DlSchema);

export default async function handler(req, res) {
    try {
        if (!mongoose.connections[0].readyState) {
            await mongoose.connect(config.MONGODB_URI);
        }

        const stats = await Download.findOneAndUpdate({}, { $inc: { count: 1 } }, { upsert: true, new: true });
        const ip = req.headers['x-forwarded-for'] || '127.0.0.1';
        const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        const text = `🚀 *NOTIFIKASI DOWNLOAD SCRIPT!*\n\n📊 *TOTAL DOWNLOAD:* ${stats.count}\n📅 *TANGGAL:* ${waktu}\n🌐 *IP:* ${ip}`;

        await axios.post(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: config.TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
        });

        res.json({ url: config.DOWNLOAD_URL });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
