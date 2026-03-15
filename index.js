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
        const { main, weather, name, clouds, rain } = res.data;

        const tempCurrent = main.temp;
        const tempMin = main.temp_min ?? tempCurrent;
        const tempMax = main.temp_max ?? tempCurrent;

        let rainMessage;
        if (rain || ['Rain', 'Drizzle', 'Thunderstorm'].includes(weather[0].main)) {
            rainMessage = '☔ Hôm nay có khả năng mưa, mọi người nhớ mang ô/áo mưa nếu ra ngoài nhé.';
        } else if (['Clouds'].includes(weather[0].main)) {
            rainMessage = '🌥️ Khả năng mưa không cao, trời có mây là chủ yếu.';
        } else {
            rainMessage = '🌤️ Khả năng mưa thấp, thời tiết nhìn chung khô ráo.';
        }

        let sunMessage;
        if (tempMax >= 33 && (!clouds || clouds.all <= 40)) {
            sunMessage = '🔥 Dự kiến có nắng khá gắt vào ban ngày, mọi người nhớ chống nắng cẩn thận.';
        } else if (tempMax >= 28) {
            sunMessage = '🌞 Nắng vừa, trời khá oi nhẹ, đi ra ngoài vẫn nên mang mũ/nón.';
        } else {
            sunMessage = '⛅ Nắng không quá gắt, thời tiết tương đối dễ chịu.';
        }

        let feelMessage;
        if (tempCurrent <= 20) {
            feelMessage = '🧥 Trời se lạnh/rét, mọi người chú ý mặc ấm khi ra ngoài.';
        } else if (tempCurrent <= 28) {
            feelMessage = '😌 Thời tiết mát mẻ, khá dễ chịu cho các hoạt động trong ngày.';
        } else {
            feelMessage = '🥵 Trời khá nóng, mọi người nhớ uống nhiều nước và tránh ở ngoài trời quá lâu.';
        }

        const msg =
            `🌤️ *BẢN TIN THỜI TIẾT TỰ ĐỘNG* 🌤️\n\n` +
            `📍 Khu vực: *${name}*\n` +
            `Hiện tại trời đang *${weather[0].description}*.\n\n` +
            `🌡️ Nhiệt độ hiện tại: *${tempCurrent}°C*\n` +
            `🔻 Nhiệt độ thấp nhất hôm nay: *${tempMin}°C*\n` +
            `🔺 Nhiệt độ cao nhất hôm nay: *${tempMax}°C*\n` +
            `💧 Độ ẩm: *${main.humidity}%*\n\n` +
            `${rainMessage}\n` +
            `${sunMessage}\n` +
            `${feelMessage}\n\n` +
            `Chúc mọi người một ngày làm việc tràn đầy năng lượng! ✨`;

        await bot.telegram.sendMessage(process.env.GROUP_ID, msg, { parse_mode: 'Markdown' });
        console.log('✅ Đã gửi bản tin thời tiết vào nhóm thành công!');
    } catch (e) {
        console.error('❌ Lỗi khi lấy hoặc gửi thời tiết:', e.message);
    }
}

// --- 2. LẬP LỊCH CHẠY TỰ ĐỘNG (CRON JOB) ---
// Chạy vào lúc 23:30 để test, sau này bạn đổi lại thành '30 6 * * *' cho đúng 6h30 sáng
cron.schedule('30 23 * * *', () => {
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