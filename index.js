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
const DEGER_YAZILACAK_KANAL = "1523362516640600285"; 
const DEGER_BILDIRIM_KANAL = "1526234898032234639";  

// --- KAYIT SİSTEMİ ID'LERİ ---
const KAYIT_YETKILI_ROL = "1522708151047164065";
const KAYIT_MOD_KANAL = "1522291367533871276";
const HOSGELDIN_KANAL = "1522939056760033362"; // Sohbet Kanalı
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
    console.log(`${client.user.tag} aktif! Sistemler hazır.`);
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

// --- GÖRSEL 2: BİRİ KATILDIĞINDA KAYIT ODASINA DÜŞEN GİRİŞ MESAJI ---
client.on('guildMemberAdd', async (member) => {
    const channel = member.guild.channels.cache.get(KAYIT_MOD_KANAL);
    if (!channel) return;

    const hesapAclis = member.user.createdAt;
    const yediGunOnce = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const guvenliMi = hesapAclis < yediGunOnce ? "🟢 Güvenli" : "🔴 Güvenli Değil!";
    const toplamUye = member.guild.memberCount;

    const embed = new EmbedBuilder()
        .setTitle(`Yeni Bir Kullanıcı Katıldı, 👋\ncansadik!`)
        .setDescription(`Sunucumuza hoş geldin **${member.user.username}**\n\n🔷 **Seninle birlikte ${toplamUye} kişiyiz.**\n\n🐈‍⬛ **Hesap oluşturulma tarihi:** <t:${Math.floor(hesapAclis.getTime() / 1000)}:f>\n👹 **Güvenilirlik durumu:**\n⚠️ **${guvenliMi}**`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor(0x2f3136)
        .setFooter({ text: "Nors" });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giris_normal_kayit').setLabel('🪪 Normal Kayıt').setStyle(ButtonStyle.Primary)
    );

    await channel.send({ content: `<@&${KAYIT_YETKILI_ROL}>, ${member} sunucuya giriş yaptı.`, embeds: [embed], components: [row] });
});

// Buton ve Komut Dinleyicisi
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('.')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- DEĞER EKLEME KOMUTU () ---
    if (command === 'degejdududrekle') {
        if (message.channel.id !== DEGER_YAZILACAK_KANAL) {
            return message.reply(`❌ Bu komut sadece <#${DEGER_YAZILACAK_KANAL}> kanalında kullanılabilir!`).then(msg => setTimeout(() => msg.delete().catch(e=>{}), 5000));
        }
        if (!message.member.roles.cache.has(DEGER_ROL_ID)) {
            return message.reply(`❌ Bu komutu kullanmak için gerekli role sahip değilsin.`).then(msg => setTimeout(() => msg.delete().catch(e=>{}), 5000));
        }

        const targetMember = message.mentions.members.first();
        const eklenecekMetin = args[1];
        if (!targetMember || !eklenecekMetin) return message.reply('❌ Örnek: `.degerekle @kullanici 1m`');

        const userId = targetMember.id;
        const eklenecekSayi = metniSayiyaCevir(eklenecekMetin);

        try {
            const res = await db.query('SELECT * FROM oyuncular WHERE user_id = $1', [userId]);
            let yeniSayi = eklenecekSayi;
            let eskiMetin = "0m";
            let durumMesaji = `İlk Değer: **${eklenecekMetin}**`;

            if (res.rows.length > 0) {
                const mevcutSayi = parseInt(res.rows[0].deger) || 0;
                eskiMetin = sayiyiMetneCevir(mevcutSayi);
                yeniSayi = mevcutSayi + eklenecekSayi;
                
                await db.query('UPDATE oyuncular SET deger = $1 WHERE user_id = $2', [yeniSayi, userId]);
                durumMesaji = `Değer Eklendi! (${eskiMetin} + ${eklenecekMetin} ➡️ **${sayiyiMetneCevir(yeniSayi)}**)`;
            } else {
                await db.query('INSERT INTO oyuncular (user_id, isim, mevki, bayrak, deger) VALUES ($1, $2, $3, $4, $5)', [userId, "Osimhen", "ST", "🇳🇬", yeniSayi]);
            }

            await message.reply('✅ Değer başarıyla eklendi ve bildirildi!').then(msg => setTimeout(() => { msg.delete().catch(e=>{}); message.delete().catch(e=>{}); }, 3000));

            const logChannel = client.channels.cache.get(DEGER_BILDIRIM_KANAL);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('⚽ RP LİGİ - PİYASA DEĞERİ GÜNCELLEME')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: 'Oyuncu', value: `${targetMember} (Osimhen | ST | 🇳🇬)`, inline: false },
                        { name: 'Durum', value: `📈 ${durumMesaji}`, inline: false }
                    )
                    .setFooter({ text: `Yetkili: ${message.author.displayName}` })
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] });
            }
        } catch (err) { console.error(err); }
    }

    // --- GÖRSEL 3: KAYIT BAŞLATMA KOMUTU (.k @üye İsim | Bilgi) ---
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
            return message.reply('❌ Hatalı kullanım! Örnek: `.k @kullanici İsim | Takım`');
        }

        try { await targetMember.setNickname(yeniIsim); } catch(e) { console.log("İsim değiştirme yetkisi yetersiz."); }

        // Görsel 3'teki Rol Seçim Butonları
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`kayit_uye_${targetMember.id}_${encodeURIComponent(yeniIsim)}`).setLabel('👤 Üye').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`kayit_futbolcu_${targetMember.id}_${encodeURIComponent(yeniIsim)}`).setLabel('⚽ Futbolcu').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`kayit_baskan_${targetMember.id}_${encodeURIComponent(yeniIsim)}`).setLabel('👔 Başkan').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`kayit_td_${targetMember.id}_${encodeURIComponent(yeniIsim)}`).setLabel('📋 Teknik Direktor').setStyle(ButtonStyle.Secondary)
        );

        await message.channel.send({ content: `🛠️ ${targetMember} için rol grubunu seçiniz:`, components: [row] });
        await message.delete().catch(e=>{});
    }
});

// INTERACTION (BUTON) YÖNETİMİ
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Normal Kayıt Butonuna Basıldığında Bilgilendirme
    if (interaction.customId === 'giris_normal_kayit') {
        return interaction.reply({ content: `📝 Kayıt işlemini başlatmak için lütfen kanala **.k @kullanici İsim | Bilgi** komutunu yazın.`, ephemeral: true });
    }

    // Rol Seçim Butonları Kontrolü
    if (interaction.customId.startsWith('kayit_')) {
        if (!interaction.member.roles.cache.has(KAYIT_YETKILI_ROL)) {
            return interaction.reply({ content: '❌ Bu butonları sadece Kayıt Yetkilileri kullanabilir!', ephemeral: true });
        }

        await interaction.deferUpdate();

        const [_, rolTuru, targetId, encodedName] = interaction.customId.split('_');
        const yeniIsim = decodeURIComponent(encodedName);
        
        const guild = interaction.guild;
        const targetMember = await guild.members.fetch(targetId).catch(e => null);
        if (!targetMember) return interaction.followUp({ content: '❌ Kullanıcı sunucudan ayrılmış.', ephemeral: true });

        let verilecekRoller = [];
        let rolEtiketleri = "";

        if (rolTuru === 'uye') {
            verilecekRoller.push(ROL_UYE);
            rolEtiketleri = `<@&${ROL_UYE}>`;
        } else if (rolTuru === 'futbolcu') {
            verilecekRoller.push(ROL_FUTBOL_1, ROL_FUTBOL_2);
            rolEtiketleri = `<@&${ROL_FUTBOL_1}>, <@&${ROL_FUTBOL_2}>`;
        } else if (rolTuru === 'baskan') {
            verilecekRoller.push(ROL_BASKAN, ROL_FUTBOL_1);
            rolEtiketleri = `<@&${ROL_BASKAN}>, <@&${ROL_FUTBOL_1}>`;
        } else if (rolTuru === 'td') {
            verilecekRoller.push(ROL_TEKNIK_DIREKTOR, ROL_FUTBOL_1);
            rolEtiketleri = `<@&${ROL_TEKNIK_DIREKTOR}>, <@&${ROL_FUTBOL_1}>`;
        }

        try {
            await targetMember.roles.add(verilecekRoller);
            await targetMember.roles.remove(KAYITSIZ_ROL).catch(e=>{});

            // GÖRSEL 3: KAYIT ODASINDAKİ BAŞARILI MESAJ TASARIMI
            const basariliModEmbed = new EmbedBuilder()
                .setTitle('📥 Kayıt Yapıldı!')
                .setDescription(`📊 **Kayıt Bilgileri**\n\n• **Kayıt Edilen Kullanıcı:** ${targetMember}\n• **Kayıt Eden Kullanıcı:** ${interaction.user}\n• **Verilen Roller:** ${rolEtiketleri}\n• **Yeni İsim:** ${yeniIsim}\n• **Kayıt Türü : Normal**`)
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setColor(0x1a1c1e)
                .setFooter({ text: `• ${interaction.user.username}, kayıt tamamlandı.` });

            await interaction.editReply({ content: null, embeds: [basariliModEmbed], components: [] });

            // GÖRSEL 1: SOHBET KANALINA GİDEN BİLDİRİM TASARIMI (.invite / sohbet)
            const chatChannel = guild.channels.cache.get(HOSGELDIN_KANAL);
            if (chatChannel) {
                const sohbetEmbed = new EmbedBuilder()
                    .setTitle('📥 Kayıt Yapıldı!')
                    .setDescription(`✔️ • ${targetMember} aramıza **${rolEtiketleri}** rolleriyle katıldı.\n\n✨ • **Kaydı gerçekleştiren yetkili**\n${interaction.user}\n\n🐼 • **Aramıza hoş geldin**\n${targetMember}`)
                    .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                    .setColor(0x1a1c1e)
                    .setFooter({ text: 'Nors Kayıt Sistemi' });

                await chatChannel.send({ content: `${targetMember} **aramıza katıldı.**`, embeds: [sohbetEmbed] });
            }

        } catch (err) {
            console.error(err);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
        
