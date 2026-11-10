const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send('✅ 垃圾車後端伺服器正在運作中！');
});

const CITY_APIS = {
    taichung: {
        name: '臺中市',
        url: 'https://taichung-garbage-proxy.segary1978.workers.dev',
        format: (item) => ({
            car: item.car || '未知車牌',
            lineId: item.lineid || '未知路線',
            location: item.location || '未知地點',
            lat: parseFloat(item.Y || 0),
            lon: parseFloat(item.X || 0),
            time: item.time || '未知時間'
        })
    },
    newtaipei: {
        name: '新北市',
        url: 'https://newtaipei-proxy.segary1978.workers.dev',
        format: (item) => ({
            // 新北市沒有車牌欄位，顯示友善提示
            car: '無車牌資料', 
            lineId: item.lineid || '未知路線',
            // 將 city + village + name 組合起來變成完整地點
            location: `${item.city || ''}${item.village || ''}${item.name || ''}` || '未知地點',
            lat: parseFloat(item.latitude || 0),
            lon: parseFloat(item.longitude || 0),
            time: item.time || '未知時間'
        })
    }
};

app.get('/api/garbage/trucks', async (req, res) => {
    const { city } = req.query;
    try {
        const apiInfo = CITY_APIS[city];
        if (!apiInfo) return res.status(400).json({ error: '尚未支援該縣市' });

        const response = await axios.get(apiInfo.url, { timeout: 20000 });
        const rawData = Array.isArray(response.data) ? response.data : (response.data.data || []);
        
        const trucks = rawData.map(item => {
            try { return apiInfo.format(item); } catch (e) { return null; }
        }).filter(t => t !== null);

        res.json({ city: apiInfo.name, count: trucks.length, trucks });
    } catch (error) {
        console.error(`取得 ${city} 資料失敗:`, error.message);
        res.status(500).json({ error: `無法取得資料`, details: error.message });
    }
});

app.get('/api/garbage/nearby', async (req, res) => {
    const { city, lat, lon } = req.query;
    try {
        const apiInfo = CITY_APIS[city];
        if (!apiInfo || !lat || !lon) return res.status(400).json({ error: '缺少參數' });

        const response = await axios.get(apiInfo.url, { timeout: 20000 });
        const rawData = Array.isArray(response.data) ? response.data : (response.data.data || []);
        
        const trucks = rawData.map(item => {
            try {
                const truck = apiInfo.format(item);
                const distance = getDistance(lat, lon, truck.lat, truck.lon);
                return { ...truck, distance: Math.round(distance) };
            } catch (e) { return null; }
        }).filter(t => t !== null && t.distance <= 2000).sort((a, b) => a.distance - b.distance);

        res.json({ city: apiInfo.name, count: trucks.length, trucks });
    } catch (error) {
        res.status(500).json({ error: '無法取得附近垃圾車資料', details: error.message });
    }
});

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`垃圾車後端伺服器運行中...`); });