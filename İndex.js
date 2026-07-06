const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = ".";

// Gönderdiğin etiketten sadece sayıları ayıklayıp ID olarak tanımlıyoruz
const OWNER_ID = "1523659172904960030".replace(/[^0-9]/g, ""); 

// Veritabanı Dosyası İşlemleri
const VERI_DOSYASI = './ekonomi.json';
if (!fs.existsSync(VERI_DOSYASI)) {
    fs.writeFileSync(VERI_DOSYASI, JSON.stringify({}));
}

function veriOku() {
    return JSON.parse(fs.readFileSync(VERI_DOSYASI, 'utf8'));
}

function veriYaz(data) {
    fs.writeFileSync(VERI_DOSYASI, JSON.stringify(data, null, 2));
}

function profilGetir(userId) {
    let veri = veriOku();
    if (!veri[userId]) {
        veri[userId] = {
            uygarlik: "Bilinmeyen Uygarlık",
            para: 1000, 
            asker: 0,
            kale: 0,
            kule: 0,
            sur: 0
        };
        veriYaz(veri);
    }
    return veri[userId];
}

client.on('ready', () => {
    console.log(`${client.user.tag} başarıyla aktif oldu!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;

    // 1. .profil KOMUTU
    if (command === 'profil') {
        let profil = profilGetir(userId);
        const embed = new EmbedBuilder()
            .setTitle(`🏰 ${message.author.username} - Profil Kartı`)
            .setColor('#FFA500')
            .addFields(
                { name: '🏛️ Uygarlık', value: `${profil.uygarlik}`, inline: false },
                { name: '💰 Hazine (Para)', value: `${profil.para.toLocaleString()} 🪙`, inline: true },
                { name: '⚔️ Asker Sayısı', value: `${profil.asker.toLocaleString()} 🪖`, inline: true },
                { name: '🏰 Yapılar', value: `🗼 Kule: ${profil.kule}\n🏯 Kale: ${profil.kale}\n🧱 Sur: ${profil.sur}`, inline: false }
            );
        return message.reply({ embeds: [embed] });
    }

    // .uygarlıkkur KOMUTU
    if (command === 'uygarlıkkur' || command === 'uygarlikkur') {
        let isim = args.join(" ");
        if (!isim) return message.reply("Lütfen bir uygarlık ismi yazın! Örn: `.uygarlıkkur Roma`");
        let veri = veriOku();
        profilGetir(userId);
        veri[userId].uygarlik = isim;
        veriYaz(veri);
        return message.reply(`🎉 Uygarlığınızın adı başarıyla **${isim}** olarak belirlendi!`);
    }

    // 2. .bal KOMUTU
    if (command === 'bal') {
        let profil = profilGetir(userId);
        return message.reply(`💰 Mevcut Hazneniz: **${profil.para.toLocaleString()}** 🪙`);
    }

    // 3. .hazinekle KOMUTU (Owner Özel)
    if (command === 'hazinekle') {
        if (userId !== OWNER_ID) return message.reply("❌ Bu komutu sadece bot sahibi kullanabilir!");
        let miktar = parseInt(args[0]);
        let hedef = message.mentions.users.first() || message.author;
        
        if (!miktar || isNaN(miktar)) return message.reply("❌ Lütfen eklenecek geçerli bir para miktarı yazın! Örn: `.hazinekle 5000`");
        
        let veri = veriOku();
        profilGetir(hedef.id);
        veri[hedef.id].para += miktar;
        veriYaz(veri);
        
        return message.reply(`✅ ${hedef.username} kullanıcısının hazinesine **${miktar.toLocaleString()}** 🪙 eklendi.`);
    }

    // 4. .hazineçıkar KOMUTU (Owner Özel)
    if (command === 'hazineçıkar' || command === 'hazinecikar') {
        if (userId !== OWNER_ID) return message.reply("❌ Bu komutu sadece bot sahibi kullanabilir!");
        let miktar = parseInt(args[0]);
        let hedef = message.mentions.users.first() || message.author;
        
        if (!miktar || isNaN(miktar)) return message.reply("❌ Lütfen çıkarılacak geçerli bir para miktarı yazın! Örn: `.hazineçıkar 2000`");
        
        let veri = veriOku();
        profilGetir(hedef.id);
        if(veri[hedef.id].para < miktar) miktar = veri[hedef.id].para; 
        
        veri[hedef.id].para -= miktar;
        veriYaz(veri);
        
        return message.reply(`📉 ${hedef.username} kullanıcısının hazinesinden **${miktar.toLocaleString()}** 🪙 çıkarıldı.`);
    }

    // 5. .askeral KOMUTU
    if (command === 'askeral') {
        let miktar = parseInt(args[0]);
        if (!miktar || isNaN(miktar) || miktar <= 0) return message.reply("❌ Lütfen almak istediğiniz asker miktarını girin! Örn: `.askeral 50`");
        
        let toplamMaliyet = miktar * 10;
        let veri = veriOku();
        let profil = profilGetir(userId);

        if (profil.para < toplamMaliyet) {
            return message.reply(`❌ Yetersiz altın! ${miktar} asker için **${toplamMaliyet}** 🪙 gerekiyor. Sende olan: **${profil.para}** 🪙`);
        }

        veri[userId].para -= toplamMaliyet;
        veri[userId].asker += miktar;
        veriYaz(veri);

        return message.reply(`⚔️ Başarıyla Orduya **${miktar}** asker katıldı! Harcanan: **${toplamMaliyet}** 🪙.`);
    }

    // 6. .inşaaet KOMUTU
    if (command === 'inşaaet' || command === 'insaaet') {
        let yapi = args[0]?.toLowerCase();
        if (!yapi || !['kule', 'kale', 'sur'].includes(yapi)) {
            return message.reply("❌ Lütfen ne inşa etmek istediğinizi belirtin!\n⚙️ Seçenekler: `.inşaaet kule` (50K), `.inşaaet kale` (100K), `.inşaaet sur` (250K)");
        }

        let maliyetler = { kule: 50000, kale: 100000, sur: 250000 };
        let maliyet = maliyetler[yapi];
        
        let veri = veriOku();
        let profil = profilGetir(userId);

        if (profil.para < maliyet) {
            return message.reply(`❌ Bu yapıyı inşa etmek için yeterli paranız yok! Gerekli: **${maliyet.toLocaleString()}** 🪙`);
        }

        veri[userId].para -= maliyet;
        veri[userId][yapi] += 1;
        veriYaz(veri);

        return message.reply(`🧱 Tebrikler! Başarıyla 1 adet **${yapi.toUpperCase()}** inşa ettiniz. Harcanan: **${maliyet.toLocaleString()}** 🪙.`);
    }
});

client.login('BOTUNUN_TOKENI'); // Buraya kendi botunun tokenini yapıştıracaksın!
