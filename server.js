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
        url: 'https://data.ntpc.gov.tw/api/datasets/EDC3AD26-8AE7-4916-A00B-BC6048D19BF8/json?page=0&size=10000',
        format: (item) => ({
            car: item.car,
            lineId: item.lineid,
            location: item.location,
            lat: parseFloat(item.latitude),
            lon: parseFloat(item.longitude),
            time: item.time
        })
    },
    // ⚠️ 以下為預留架構，實際網址需替換為該縣市開放資料平台的 API
    taipei: {
        name: '臺北市',
        url: 'https://data.taipei/api/v1/dataset/2d107d71-83d6-467a-b86c-77e9122d5c69?scope=resourceAquire', // 範例網址
        format: (item) => ({
            car: item.car || '未知車牌',
            lineId: item.lineid || '未知路線',
            location: item.location || '未知地點',
            lat: parseFloat(item.lat || 0),
            lon: parseFloat(item.lon || 0),
            time: item.time || '未知時間'
        })
    },
    kaohsiung: {
        name: '高雄市',
        url: 'https://api.kcg.gov.tw/api/service/Get/aaf4ce4b-4ca8-43de-bfaf-6dc97e89cac0', // 範例網址
        format: (item) => ({
            car: item.car || '未知車牌',
            lineId: item.lineid || '未知路線',
            location: item.location || '未知地點',
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

        const response = await axios.get(apiInfo.url, { timeout: 15000 });
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

        const response = await axios.get(apiInfo.url, { timeout: 15000 });
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