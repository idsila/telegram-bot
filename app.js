require("dotenv").config();

const commands = require("./commands.js");
const dataBase = require("./dataBase.js");
const { Telegraf, session, Scenes } = require("telegraf");
const express = require("express");
const cors = require("cors");
const { parse } = require("dotenv");
const app = express();

app.use(cors({ methods: ["GET", "POST"] }));
app.use(express.json());

const ADMIN_ID = 7502494374;

const bot = new Telegraf(process.env.TOKEN);
bot.use(
  session({
    defaultSession: () => ({ write_user: false }),
    defaultSession: () => ({ write_admin: false }),
  })
);

//bot.telegram.setMyCommands(commands);



// Система принятий и проверок в канал
bot.on("chat_join_request", async (ctx) => {
  const { chat, from: { id, first_name, username, language_code }, date } = ctx.chatJoinRequest;
  dataBase.findOne({ username }).then(async (res) => {
    if(!res){
      //Запись в базе данных создана
      dataBase.insertOne({
        id, first_name, username, language_code, date: dateNow(), balance: 0,
        data_channel: { chat: chat, date: date, join: false },
      });
    }
    else if(res.data_channel === null || res.data_channel?.join){
      //Пользователь уже есть в базе данных нужно обновить данные
      dataBase.updateOne({ username }, { $set: { data_channel: { chat: chat, date: date, join: false } } })
    }
  });

  await bot.telegram.sendPhoto(id,
    "https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg",
    {
      caption:
        " 🔐 <b>Чтобы попасть в наш тг канал подтвердите, что вы не робот нажав на кнопку ниже. </b>",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Я не робот 🚀", callback_data: "approve_join" }],
        ],
      },
    }
  );



});
bot.action("approve_join", async (ctx) => {
  const { id, first_name, username, language_code } = ctx.update.callback_query.from;
  dataBase.findOne({ username }).then(async (res) => {
    if(res){
      if (!res.data_channel?.join || res.data_channel === null) {
        await dataBase.updateOne({ username }, { $set: { data_channel: { chat:res.data_channel.chat, date: res.data_channel.date, join: true } } });
        await ctx.telegram.approveChatJoinRequest( res.data_channel.chat.id, id );
        await ctx.reply("🛠️ <b>Вы прошли проверку</b>", { parse_mode: "HTML" });
      }
      else{
        await ctx.reply("🏁 <b>Вы уже прошли проверку</b>", { parse_mode: "HTML" });
      }
    }
  });
});











//Сцены

const writeHelp = new Scenes.WizardScene(
  "write_help",
  (ctx) => {
    ctx.session.write_user = true;
    ctx.reply("<b>Напишите о вашей проблеме, можно прикрепить фото.</b>", {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Отменить", callback_data: "cancel_write_help" }],
        ],
      },
    });
    return ctx.wizard.next();
  },
  (ctx) => {
    const { id, username } = ctx.from;

    if (
      (ctx.callbackQuery?.data === "help" && ctx.session.write_user) ||
      ctx.callbackQuery?.data === "cancel_write_user_help" ||
      ctx.callbackQuery?.data === "cancel_write_help"
    ) {
      ctx.session.write_user = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }

    ctx.session.write_user = false;

    if (ctx.update.message.photo) {
      const photo = ctx.update.message.photo.pop();
      ctx.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
        caption: `<b>Пользователь: @${username}</b> \n <blockquote>${
          ctx.update.message.caption ?? "Пусто"
        }</blockquote>`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Ответить", callback_data: `user_${id}_${username}` }],
          ],
        },
      });
    } else {
      ctx.telegram.sendMessage(
        ADMIN_ID,
        `<b>Пользователь: @${username}</b> > \n <blockquote>${ctx.message.text}</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Ответить", callback_data: `user_${id}_${username}` }],
            ],
          },
        }
      );
    }
    ctx.reply(`✅ <b>Готово! Ваша заявка будет расмотренна.</b>`, {
      parse_mode: "HTML",
    });
    return ctx.scene.leave();
  }
);

const writeHelpAdmin = new Scenes.WizardScene(
  "write_help_admin",
  (ctx) => {
    const { id, username } = ctx.scene.state;
    ctx.session.write_admin = true;
    ctx.reply(`<b>Отвечаем > @${username}</b>`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Отменить", callback_data: "cancel_write_user_help" }],
        ],
      },
    });
    return ctx.wizard.next();
  },
  (ctx) => {
    const { id, username } = ctx.scene.state;

    if (ctx.callbackQuery?.data.startsWith("user") && ctx.session.write_admin) {
      ctx.session.write_admin = false;
      return ctx.scene.leave();
    }

    if (
      ctx.callbackQuery?.data === "cancel_write_user_help" ||
      ctx.callbackQuery?.data === "cancel_write_help"
    ) {
      ctx.session.write_admin = false;
      ctx.deleteMessage();
      return ctx.scene.leave();
    }
    ctx.session.write_admin = false;

    if (ctx.update.message.photo) {
      const photo = ctx.update.message.photo.pop();
      ctx.telegram.sendPhoto(id, photo.file_id, {
        caption: `🔔 <b>Ответ Администратора</b> >
        \n<blockquote>${ctx.update.message.caption ?? "Пусто"}</blockquote>`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💻 Написать ещё", callback_data: `help` }],
          ],
        },
      });
    } else {
      ctx.telegram.sendMessage(
        id,
        `🔔 <b>Ответ Администратора</b> > \n <blockquote>${ctx.message.text}</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💻 Написать ещё", callback_data: `help` }],
            ],
          },
        }
      );
    }
    ctx.reply(`✅ <b>Готово! Ответ отправлен.</b>`, { parse_mode: "HTML" });
    return ctx.scene.leave();
  }
);

const stage = new Scenes.Stage([writeHelp, writeHelpAdmin]);
bot.use(stage.middleware());



// Действия по нажатию inline кнопки
bot.action(/^user/i, async (ctx) => {
  if (!ctx.session.write_admin) {
    ctx.session.write_admin = false;
    const [, id, username] = ctx.match.input.split("_");
    ctx.scene.enter("write_help_admin", { id, username });
  }
});
bot.action("help", async (ctx) => {
  if (!ctx.session.write_user) {
    ctx.session.write_user = false;
    ctx.scene.enter("write_help");
  }
});

bot.action(["menu", "menu_back"], async (ctx) => {
  await ctx.deleteMessage();
  ctx.replyWithPhoto("https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg", {
    caption: "Меню бота",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }, { text: "🛒 Купить товар", callback_data: `buy_item` }],
        [{ text: "🧠 Нейросети", callback_data: `ai_menu` }, { text: "🌐 Перевод текста", callback_data: `translate` }],
        [{ text: "✅ Проверка подписок", callback_data: `check_sub` }, { text: "📨 Приняьтие заявок", callback_data: `connect_admin` }],
        [{ text: "📊 Генерация QR-кода", callback_data: `qr_code` }, { text: "🕵️‍♂️ Фотошпион", callback_data: `photo_shpion` }],
        [{ text: "📱 Мини приложения", callback_data: `mini_app` }],
        [{ text: "👨‍💻 Связь с админом", callback_data: `help` }]
      ]
    }
  });
});


bot.action("pay_balance", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.replyWithPhoto("https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg", {
    caption: "Это все способы пополнения баланса.",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 ЮMoney", callback_data: `pay_umoney` }, { text: "🧠 Крипта", callback_data: `pay_crypto` }],
        [{ text: "⭐ Звезды", callback_data: `pay_stars` , pay:true}],
        [{ text: "<< Назад", callback_data: `menu_back` }],
     ]
    }
  });
});







// Действия по нажатию кнопки из keyboard
bot.hears('🗂️ Меню', async (ctx) => {
  await ctx.deleteMessage();
  await ctx.replyWithPhoto("https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg", {
    caption: "Меню бота",
    reply_markup: {
      inline_keyboard: [
        [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }, { text: "🛒 Купить товар", callback_data: `buy_item` }],
        [{ text: "🧠 Нейросети", callback_data: `ai_menu` }, { text: "🌐 Перевод текста", callback_data: `translate` }],
        [{ text: "✅ Проверка подписок", callback_data: `check_sub` }, { text: "📨 Приняьтие заявок", callback_data: `connect_admin` }],
        [{ text: "📊 Генерация QR-кода", callback_data: `qr_code` }, { text: "🕵️‍♂️ Фотошпион", callback_data: `photo_shpion` }],
        [{ text: "📱 Мини приложения", callback_data: `mini_app` }],
        [{ text: "👨‍💻 Связь с админом", callback_data: `help` }]
      ]
    }
  });
});
bot.hears('👨‍💻 Связь с админом', async (ctx) => {
  await ctx.deleteMessage();
  if (!ctx.session.write_user) {
    ctx.session.write_user = false;
    ctx.scene.enter("write_help");
  }
});
bot.hears('👨 Личный кабинет', async (ctx) => {
  const { id, first_name, username, language_code } = ctx.from;
  dataBase.findOne({ username }).then(async (res) => {
    
    await ctx.deleteMessage();
    await ctx.reply(`<b>Информация по 👨 аккаунту:</b>\n🆔 ID: <code>${res.id}</code>
💰 Баланс: ${res.balance} ₽

🤝 Партнерская программа: - /ref
‍├ Рефералов:  0
`,{
   parse_mode: 'HTML',
   reply_markup: {
    inline_keyboard: [
      [{ text: "💳 Пополнить баланс", callback_data: `pay_balance` }]
    ]
  }
  })
  })
})










// Комманды
bot.command("start", async (ctx) => {
  const { id, first_name, username, language_code } = ctx.from;

  dataBase.findOne({ id, first_name, username }).then((res) => {
    if (!res) {
      console.log("Запись  создаеться");
      dataBase.insertOne({ id, first_name, username, language_code, date: dateNow(), balance: 0, data_channel: null });
    } else {
      console.log("Запись уже создана");
    }
  });

  ctx.replyWithPhoto("https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg", {
    caption: `<b>Привет! 👋 Я — многофункциональный бот с мощным набором функций!</b>\n<blockquote>Имеються нейросети, мини-игры, полноценные мини приложения и тд.\nЗагляни в /about — там всё, что я умею!</blockquote>`,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [
        [{ text: "🗂️ Меню", callback_data: `menu` }],
        [{ text: "🧠 Купить бота", callback_data: `ai_menu` }, { text: "👨 Личный кабинет", callback_data: `translate` }],
        [{ text: "👨‍💻 Связь с админом", callback_data: `help` }]
      ]
    }
  });
});


bot.command("drop", async (ctx) => {
  dataBase.deleteMany({});
  ctx.reply("DROP COLLECTION");
});

bot.command("about", async (ctx) => {
  ctx.replyWithPhoto("https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg", {
    caption: `✨ <b>Что я умею:</b>\n<blockquote>• Генерировать QR-коды
• Нейросеть для генерации текста
• Переводить текст

• Реферальная система
• Проверка подписок
• Принятие заявок через бота
• Связь с админом

• Оплата звездами
• Оплато криптовалютой
• Оплата ЮMoney

• Покупа звезд
• Покупка накрутки

• Создание розагрышей
• Скачивание видео с тиктока
</blockquote>\n📱 <b>Мини приложения:</b>\n<blockquote>• Копия кликера Notcoin
• Копия фейк казино
• Интерфейс для ии
</blockquote>

`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🗂️ Меню", callback_data: `menu` }],
      ],
    }
  });
});


bot.command("help", async (ctx) => {
  if (!ctx.session.write_user) {
    ctx.session.write_user = false;
    ctx.scene.enter("write_help");
  }
});

bot.command("db", async (ctx) => {
  dataBase.find({}).then((res) => {
    ctx.reply("```js" + JSON.stringify(res, null, 2) + "```", {
      parse_mode: "Markdown",
    });
  });
});

// bot.telegram.sendPhoto(
//   ADMIN_ID,
//   "https://quickchart.io/qr?text=https://best-earn.vercel.app&size=400",
//   {
//     caption: `🔔 <b>Ответ Администратора</b> >
//   \n<blockquote>Пусто</blockquote>`,
//     parse_mode: "HTML",
//   }
// );

//bot.on('text', ctx => console.log(ctx.update.message.from));
bot.launch();

function dateNow() {
  return new Date().getTime();
}

app.get("/sleep", async (req, res) => {
  res.send({ type: 200 });
});

app.listen(3000, (err) => {
  err ? err : console.log("STARTED SERVER");
});
