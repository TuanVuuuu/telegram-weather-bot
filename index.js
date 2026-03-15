require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

// Khởi tạo Bot và Express
const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.RENDER_EXTERNAL_URL; // Biến này tự động có khi lên Render

// --- 1. HÀM XỬ LÝ LOGIC THỜI TIẾT ---
async function sendWeatherReport() {
    try {
        console.log('🎬 Đang lấy dữ liệu thời tiết để gửi bản tin...');
        const url = `https://api.openweathermap.org/data/2.5/weather?q=Hanoi&units=metric&appid=${process.env.WEATHER_API_KEY}&lang=vi`;
        const res = await axios.get(url);
        const { main, weather, name } = res.data;
        
        const msg = `🌤️ **BẢN TIN THỜI TIẾT TỰ ĐỘNG** 🌤️\n\n` +
                    `Chào cả nhà! Hiện tại ở ${name} đang ${weather[0].description}.\n` +
                    `🌡️ Nhiệt độ: ${main.temp}°C\n` +
                    `💧 Độ ẩm: ${main.humidity}%\n\n` +
                    `Chúc mọi người một ngày làm việc tràn đầy năng lượng! ✨`;

        await bot.telegram.sendMessage(process.env.GROUP_ID, msg, { parse_mode: 'Markdown' });
        console.log('✅ Đã gửi bản tin thời tiết vào nhóm thành công!');
    } catch (e) {
        console.error('❌ Lỗi khi lấy hoặc gửi thời tiết:', e.message);
    }
}

// --- 2. LẬP LỊCH CHẠY TỰ ĐỘNG (CRON JOB) ---
// Chạy vào lúc 23:00 để test, sau này bạn đổi lại thành '30 6 * * *' cho đúng 6h30 sáng
cron.schedule('00 23 * * *', () => {
    sendWeatherReport();
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
});

// --- 3. CẤU HÌNH SERVER & KHỞI CHẠY ---
app.get('/', (req, res) => {
    res.send('Bot is status: ONLINE 🚀');
});

if (DOMAIN) {
    // CHẾ ĐỘ PRODUCTION (WEBHOOK) - Chạy trên Render
    const secretPath = `/webhook/${bot.token}`;
    app.use(bot.webhookCallback(secretPath));
    
    app.listen(PORT, '0.0.0.0', () => {
        bot.telegram.setWebhook(`${DOMAIN}${secretPath}`)
            .then(() => {
                console.log('--- SERVER STATUS: ONLINE (PRODUCTION) ---');
                console.log(`🌍 Domain: ${DOMAIN}`);
                console.log(`🔌 Port: ${PORT}`);
                console.log('🚀 Webhook đã được thiết lập!');
                console.log('------------------------------------------');
            });
    });
} else {
    // CHẾ ĐỘ LOCAL (POLLING) - Chạy trên máy của bạn
    app.listen(PORT, () => {
        console.log('--- SERVER STATUS: ONLINE (LOCAL) ---');
        console.log(`🏠 Local Host: http://localhost:${PORT}`);
        
        bot.launch().then(() => {
            console.log('🤖 Bot đang lắng nghe ở chế độ: Polling');
            console.log('⏰ Cron Job đã sẵn sàng.');
            console.log('-------------------------------------');
        });
    });
}

// Dừng bot an toàn khi tắt terminal
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));