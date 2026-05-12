import { connectToDatabase } from './_lib/mongodb';
import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0];
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const statsCollection = db.collection('stats');

    const mediafireUrl = 'https://www.mediafire.com/file/k001s9hokumihr1/SC+SATURN07+NO+ENC+V2.3.zip/file';
    const downloadUrl = await getMediafireDirectLink(mediafireUrl);
    if (!downloadUrl) throw new Error('Gagal mengambil link download dari MediaFire');

    const existingUser = await usersCollection.findOne({ ip });
    const isNewUser = !existingUser;

    if (isNewUser) {
      await usersCollection.insertOne({ ip, firstDownloadAt: new Date() });
      await statsCollection.updateOne(
        { _id: 'main' },
        { $inc: { totalDownloads: 1, totalUsers: 1 } },
        { upsert: true }
      );
    } else {
      await statsCollection.updateOne(
        { _id: 'main' },
        { $inc: { totalDownloads: 1 } },
        { upsert: true }
      );
    }

    return res.status(200).json({ success: true, downloadUrl });
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}

async function getMediafireDirectLink(pageUrl) {
  try {
    const response = await axios.get(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000,
    });
    const html = response.data;
    const $ = cheerio.load(html);

    let directLink = $('#downloadButton').attr('href');
    if (!directLink) directLink = $('.download_link a').attr('href');
    if (!directLink) directLink = $('a[aria-label="Download file"]').attr('href');
    if (!directLink) {
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && (href.includes('.zip') || (href.includes('download') && href.startsWith('http')))) {
          directLink = href;
          return false;
        }
      });
    }
    if (!directLink) {
      const scripts = $('script').map((i, el) => $(el).html()).get();
      for (const script of scripts) {
        if (script && script.includes('window.location')) {
          const match = script.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
          if (match && match[1].startsWith('http')) {
            directLink = match[1];
            break;
          }
        }
      }
    }
    if (directLink && !directLink.startsWith('http')) {
      const urlObj = new URL(pageUrl);
      directLink = urlObj.origin + (directLink.startsWith('/') ? directLink : '/' + directLink);
    }
    return directLink || null;
  } catch (err) {
    console.error('Scraping error:', err.message);
    return null;
  }
                                      }
