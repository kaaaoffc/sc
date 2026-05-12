import mongoose from 'mongoose';
import { config } from './config.js';

export default async function handler(req, res) {
    await mongoose.connect(config.MONGODB_URI);
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ email: String }));
    const Download = mongoose.models.Download || mongoose.model('Download', new mongoose.Schema({ count: Number }));

    const totalUsers = await User.countDocuments();
    const dlData = await Download.findOne({});
    
    res.json({
        totalUsers: totalUsers || 0,
        totalDownloads: dlData ? dlData.count : 0
    });
}
