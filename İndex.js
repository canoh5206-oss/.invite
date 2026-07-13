
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Client: PGClient } = require('pg');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Veri tabanı bağlantısı
const db = new PGClient({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Sabit ID Tanımlamaları
const YETKILI_ROL_ID = "1522708103169048606";
const IZINLI_KANAL_ID = "1526234898032234639";

function metniSayiyaCevir(metin) {
    metin = metin.toLowerCase().trim();
    const sayiKismi = metin.match(/[-+]?\d*\.\d+|\d+/);
    if (!sayiKismi) return 0;
    
    const val = parseFloat(sayiKismi[0]);
    if (metin.includes('m')) return Math.floor(val * 1000000);
    if (metin.includes('k')) return Math.floor(val * 1000);
    return Math.floor(val);
}

function sayiyiMetneCevir(sayi) {
    if (sayi >= 1000000) {
        const val = sayi / 1000000;
        return Number.isInteger(val) ? `${val}m` : `${val.toFixed(1)}m`;
    } else if (sayi >= 1000) {
        const val = sayi / 1000;
        return Number.isInteger(val) ? `${val}k` : `${val.toFixed(1)}k`;
    }
    return sayi.toString();
}

client.once('ready', async () => {
    console.log(`${client.user.tag} aktif ve Railway'e hazır!`);
    try {
        await db.connect();
        await db.query(`
            CREATE TABLE IF NOT EXISTS oyuncular (
                user_id VARCHAR(50) PRIMARY KEY,
                isim VARCHAR(100),
                mevki VARCHAR(20),
                bayrak VARCHAR(20),
                deger INT DEFAULT 0
            )
        `);
        console.log("Veri tabanı tablosu hazır.");
    } catch (err) {
        console.error("Veri tabanı bağlantı hatası:", err);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('.')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'degerver') {
        // 1. Kanal Kontrolü
        if (message.channel.id !== IZINLI_KANAL_ID) {
            return message.reply(`❌ Bu komut sadece <#${IZINLI_KANAL_ID}> kanalında kullanılabilir!`)
                .then(msg => setTimeout(() => msg.delete().catch(e => {}), 5000)); // 5 saniye sonra uyarıyı siler
        }

        // 2. Rol Yetki Kontrolü
        if (!message.member.roles.cache.has(YETKILI_ROL_ID)) {
            return message.reply(`❌ Bu komutu kullanmak için <@&${YETKILI_ROL_ID}> rolüne sahip olmalısın!`)
                .then(msg => setTimeout(() => msg.delete().catch(e => {}), 5000));
        }

        const targetMember = message.mentions.members.first();
        const eklenecekMetin = args[1];

        if (!targetMember || !eklenecekMetin) {
            return message.reply('❌ Hatalı Kullanım! Örnek: `.degerver @kullanici 1m`');
        }

        const userId = targetMember.id;
        const eklenecekSayi = metniSayiyaCevir(eklenecekMetin);

        const oyuncuAdi = "Osimhen";
        const mevki = "ST";
        const bayrak = "🇳🇬";

        try {
            const res = await db.query('SELECT * FROM oyuncular WHERE user_id = $1', [userId]);
            
            let yeniSayi = eklenecekSayi;
            let durumMesaji = `İlk Değer Tanımlandı: **${eklenecekMetin}**`;
            let eskiMetin = "0m";

            if (res.rows.length > 0) {
                const mevcutSayi = res.rows[0].deger;
                eskiMetin = sayiyiMetneCevir(mevcutSayi);
                yeniSayi = mevcutSayi + eklenecekSayi;
                
                await db.query('UPDATE oyuncular SET deger = $1 WHERE user_id = $2', [yeniSayi, userId]);
                durumMesaji = `Değer Eklendi! (${eskiMetin} + {eklenecekMetin} ➡️ **${sayiyiMetneCevir(yeniSayi)}**)`;
            } else {
                await db.query(
                    'INSERT INTO oyuncular (user_id, isim, mevki, bayrak, deger) VALUES ($1, $2, $3, $4, $5)',
                    [userId, oyuncuAdi, mevki, bayrak, yeniSayi]
                );
            }

            const embed = new EmbedBuilder()
                .setTitle('⚽ RP LİGİ - PİYASA DEĞERİ ARTIŞI')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Oyuncu', value: `${oyuncuAdi} | ${mevki} | ${bayrak}`, inline: false },
                    { name: 'İşlem Durumu', value: `📈 ${durumMesaji}`, inline: false }
                )
                .setFooter({ text: `Yetkili: ${message.author.displayName}` });

            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            await message.reply('❌ Veri tabanına kaydedilirken bir hata oluştu.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
                                        
