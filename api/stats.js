import { connectToDatabase } from './_lib/mongodb';

export default async function handler(req, res) {
  try {
    const { db } = await connectToDatabase();
    const stats = db.collection('stats');
    const doc = await stats.findOne({ _id: 'main' });
    res.status(200).json({
      totalDownloads: doc ? doc.totalDownloads : 0,
      totalUsers: doc ? doc.totalUsers : 0,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
