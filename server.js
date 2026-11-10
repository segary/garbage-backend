const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

// 🌟 新增：首頁測試路由（確認伺服器有沒有活著）
app.get('/', (req, res) => {
    res.send('✅ 垃圾車後端伺服器正在運作中！請訪問 /api/garbage/trucks?city=newtaipei 進行測試。');
});

const CITY_APIS = {
    taichung: {
        name: '臺中市',
        url: 'https://datacenter.taichung.gov.tw/swagger/OpenData/3f0a3f7a-7f0a-4a5a-9c1e-2b7e8f9d0c1b',
        format: (item) => ({
            car: item.car,
            lineId: item.lineid,
            location: item.location,
            lat: parseFloat(item.Y),
            lon: parseFloat(item.X),
            time: item.time
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
    }
};

app.get('/api/garbage/trucks', async (req, res) => {
    try {
        const { city } = req.query;
        const apiInfo = CITY_APIS[city];
        if (!apiInfo) {
            return res.status(400).json({ error: '尚未支援該縣市，請選擇台中市(taichung)或新北市(newtaipei)' });
        }

        const response = await axios.get(apiInfo.url, { timeout: 8000 });
        const rawData = Array.isArray(response.data) ? response.data : response.data.data || [];
        const trucks = rawData.map(apiInfo.format);
        res.json({ city: apiInfo.name, count: trucks.length, trucks });
    } catch (error) {
        console.error(`取得 ${city} 資料失敗:`, error.message);
        res.status(500).json({ error: `無法取得${CITY_APIS[city]?.name || city}的資料`, details: error.message });
    }
});

app.get('/api/garbage/nearby', async (req, res) => {
    try {
        const { city, lat, lon } = req.query;
        const apiInfo = CITY_APIS[city];
        if (!apiInfo || !lat || !lon) {
            return res.status(400).json({ error: '請提供 city、lat、lon 參數' });
        }

        const response = await axios.get(apiInfo.url, { timeout: 8000 });
        const rawData = Array.isArray(response.data) ? response.data : response.data.data || [];
        const trucks = rawData.map(item => {
            const truck = apiInfo.format(item);
            const distance = getDistance(lat, lon, truck.lat, truck.lon);
            return { ...truck, distance: Math.round(distance) };
        })
        .filter(t => t.distance <= 2000)
        .sort((a, b) => a.distance - b.distance);

        res.json({ city: apiInfo.name, count: trucks.length, trucks });
    } catch (error) {
        console.error(`取得 ${city} 附近資料失敗:`, error.message);
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