const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { Client: PGClient } = require('pg');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const db = new PGClient({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// --- DEĞER VERME SİSTEMİ ID'LERİ ---
const DEGER_ROL_ID = "1522708103169048606";
const DEGER_KANAL_ID = "1526234898032234639";

// --- KAYIT SİSTEMİ ID'LERİ ---
const KAYIT_YETKILI_ROL = "1522708151047164065";
const KAYIT_MOD_KANAL = "1522291367533871276";
const HOSGELDIN_KANAL = "1522939056760033362";
const KAYITSIZ_ROL = "1522698758008078436";

// Buton Rolleri
const ROL_UYE = "1522696741051171086";
const ROL_FUTBOL_1 = "1522696824018964480";
const ROL_FUTBOL_2 = "1522696810508849223";
const ROL_BASKAN = "1522697217264062656";
const ROL_TEKNIK_DIREKTOR = "1522696820751601685";

// Matematik Fonksiyonları
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
    console.log(`${client.user.tag} aktif ve Railway sistemine hazır!`);
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
    } catch (err) {
        console.error("Veri tabanı hatası:", err);
    }
});

// --- SİSTEM 1: BİRİ KATILDIĞINDA HOŞ GELDİN MESAJI ---
client.on('guildMemberAdd', async (member) => {
    const channel = member.guild.channels.cache.get(HOSGELDIN_KANAL);
    if (!channel) return;

    const hesapAclis = member.user.createdAt;
    const yediGunOnce = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const guvenliMi = hesapAclis < yediGunOnce ? "🟢 Güvenli" : "🔴 Güvenli Değil (Yeni Hesap)";
    const botmu = member.user.bot ? "🤖 Bot" : "👤 İnsan";

    const embed = new EmbedBuilder()
        .setTitle(`📥 Sunucuya Biri Katıldı!`)
        .setDescription(`Merhaba ${member}, sunucumuza hoş geldin! Bir kayıt yetkilisi seninle ilgilenecektir.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: "Kullanıcı Adı", value: `${member.user.tag}`, inline: true },
            { name: "Hesap Türü", value: botmu, inline: true },
            { name: "Güvenlik Durumu", value: guvenliMi, inline: false },
            { name: "Hesap Kuruluş Tarihi", value: `<t:${Math.floor(hesapAclis.getTime() / 1000)}:F>`, inline: false }
        )
        .setColor(0x3498db)
        .setTimestamp();

    await channel.send({ content: `<@&${KAYIT_YETKILI_ROL}> yeni bir üye geldi!`, embeds: [embed] });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('.')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- SİSTEM 2: DEĞER VERME KOMUTU ---
    if (command === 'degerver') {
        if (message.channel.id !== DEGER_KANAL_ID) {
            return message.reply(`❌ Bu komut sadece <#${DEGER_KANAL_ID}> kanalında kullanılabilir!`).then(msg => setTimeout(() => msg.delete().catch(e=>{}), 5000));
        }
        if (!message.member.roles.cache.has(DEGER_ROL_ID)) {
            return message.reply(`❌ Bu komutu kullanmak için gerekli role sahip değilsin.`).then(msg => setTimeout(() => msg.delete().catch(e=>{}), 5000));
        }

        const targetMember = message.mentions.members.first();
        const eklenecekMetin = args[1];
        if (!targetMember || !eklenecekMetin) return message.reply('❌ Örnek: `.degerver @kullanici 1m`');

        const userId = targetMember.id;
        const eklenecekSayi = metniSayiyaCevir(eklenecekMetin);

        try {
            const res = await db.query('SELECT * FROM oyuncular WHERE user_id = $1', [userId]);
            let yeniSayi = eklenecekSayi, durumMesaji = `İlk Değer: **${eklenecekMetin}**`, eskiMetin = "0m";

            if (res.rows.length > 0) {
                eskiMetin = sayiyiMetneCevir(res.rows[0].deger);
                yeniSayi = res.rows[0].deger + eklenecekSayi;
                await db.query('UPDATE oyuncular SET deger = $1 WHERE user_id = $2', [yeniSayi, userId]);
                durumMesaji = `Değer Eklendi! (${eskiMetin} + ${eklenecekMetin} ➡️ **${sayiyiMetneCevir(yeniSayi)}**)`;
            } else {
                await db.query('INSERT INTO oyuncular (user_id, isim, mevki, bayrak, deger) VALUES ($1, $2, $3, $4, $5)', [userId, "Osimhen", "ST", "🇳🇬", yeniSayi]);
            }

            const embed = new EmbedBuilder()
                .setTitle('⚽ RP LİGİ - PİYASA DEĞERİ GÜNCELLEME')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Oyuncu', value: `Osimhen | ST | 🇳🇬`, inline: false },
                    { name: 'Durum', value: `📈 ${durumMesaji}`, inline: false }
                );
            await message.channel.send({ embeds: [embed] });
        } catch (err) { console.error(err); }
    }

    // --- SİSTEM 3: KAYIT KOMUTU (.k <isim>) ---
    if (command === 'k') {
        if (message.channel.id !== KAYIT_MOD_KANAL) {
            return message.reply(`❌ Bu komut sadece <#${KAYIT_MOD_KANAL}> kanalında kullanılabilir!`).then(msg => setTimeout(() => msg.delete().catch(e=>{}), 5000));
        }
        if (!message.member.roles.cache.has(KAYIT_YETKILI_ROL)) {
            return message.reply(`❌ Bu komutu sadece Kayıt Yetkilileri kullanabilir.`).then(msg => setTimeout(() => msg.delete().catch(e=>{}), 5000));
        }

        const targetMember = message.mentions.members.first();
        const yeniIsim = args.slice(1).join(" ");

        if (!targetMember || !yeniIsim) {
            return message.reply('❌ Hatalı kullanım! Örnek: `.k @kullanici İsim | Bilgi`');
        }

        try { await targetMember.setNickname(yeniIsim); } catch(e) { console.log("İsim değiştirme yetkisi yetersiz."); }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_uye').setLabel('👤 Üye').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_futbol').setLabel('⚽ Futbolcu').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('btn_baskan').setLabel('👔 Başkan').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('btn_td').setLabel('📋 Teknik Direktör').setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
            .setTitle('📝 KAYIT İŞLEMİ')
            .setDescription(`${targetMember} kullanıcısının ismi **${yeniIsim}** olarak ayarlandı.\nLütfen aşağıdaki butonlardan uygun rol grubunu seçin.`)
            .setColor(0xf1c40f)
            .setFooter({ text: `Yetkili: ${message.author.displayName}` });

        const response = await message.channel.send({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: '❌ Bu butonları sadece kaydı başlatan yetkili kullanabilir!', ephemeral: true });
            }

            await i.deferUpdate();
            let verilecekRoller = [];

            if (i.customId === 'btn_uye') {
                verilecekRoller.push(ROL_UYE);
            } else if (i.customId === 'btn_futbol') {
                verilecekRoller.push(ROL_FUTBOL_1, ROL_FUTBOL_2);
            } else if (i.customId === 'btn_baskan') {
                verilecekRoller.push(ROL_BASKAN, ROL_FUTBOL_1);
            } else if (i.customId === 'btn_td') {
                verilecekRoller.push(ROL_TEKNIK_DIREKTOR, ROL_FUTBOL_1);
            }

            try {
                await targetMember.roles.add(verilecekRoller);
                await targetMember.roles.remove(KAYITSIZ_ROL);

                const basariliEmbed = new EmbedBuilder()
                    .setTitle('✅ Kayıt Tamamlandı!')
                    .setDescription(`${targetMember} kullanıcısı başarıyla kaydedildi ve rolleri tanımlandı.`)
                    .setColor(0x2ecc71);

                await response.edit({ embeds: [basariliEmbed], components: [] });
            } catch (err) {
                console.error(err);
                await message.channel.send("❌ Rol yönetiminde bir hata oluştu (Botun rolü yetersiz olabilir).");
            }
            collector.stop();
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
        
    
