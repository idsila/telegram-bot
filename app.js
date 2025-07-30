require("dotenv").config();

const commands = require("./commands.js");
const { Telegraf, session, Scenes } = require("telegraf");
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({methods:["GET", "POST"]}));
app.use(express.json());    

const ADMIN_ID = 7502494374;

const bot = new Telegraf(process.env.TOKEN);
bot.use(
  session({
    defaultSession: () => ({ write_user: false }),
    defaultSession: () => ({ write_admin: false }),
  })
);

bot.telegram.setMyCommands(commands);

// Система принятий и проверок в канал
const joinUsers = {};
bot.on("chat_join_request", async (ctx) => {
  const { chat, from, invite_link, date } = ctx.chatJoinRequest;

  joinUsers[from.id] = {
    chat: chat,
    from: from,
    date: date,
    invite_link: invite_link.invite_link,
    join: false,
  };
  console.log(joinUsers);
  await bot.telegram.sendPhoto(
    from.id,
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
  const user = ctx.update.callback_query.from;
  if (joinUsers[user.id]) {
    if (!joinUsers[user.id].join) {
      joinUsers[user.id].join = true;
      await ctx.telegram.approveChatJoinRequest(
        joinUsers[user.id].chat.id,
        user.id
      );
      await ctx.reply("🛠️ <b>Вы прошли проверку</b>", { parse_mode: "HTML" });
    } else {
      await ctx.reply("🏁 <b>Вы уже прошли проверку</b>", {
        parse_mode: "HTML",
      });
    }
  }
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

// Комманды
bot.command("start", async (ctx) => {
  ctx.replyWithPhoto("https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg", {
    caption: `<b>Привет! 👋 Я — многофункциональный бот с мощным набором функций! Могу сгенерировать qr-код, имеяться нейросети, мини-игры, а также полноценный мини приложения. Загляни в /about — там всё, что я умею!</b>`,
    parse_mode: "HTML",
  });
});

bot.command("about", async (ctx) => {
  ctx.replyWithPhoto("https://i.ibb.co/yBXRdX1R/IMG-20250513-121336.jpg", {
    caption: `✨ <b>Что я умею:</b><blockquote>• Генерировать QR-коды по любой ссылке (/qr)
• Нейросеть для генерации текста и идей (/ai)



    • Запустить игру «Угадай минерал» (/mineralgame)

• Нейросеть для генерации текста и идей (/ai)
• И ещё куча полезных команд — смотри /help
</blockquote>`,
    parse_mode: "HTML",
  });
})


bot.command("help", async (ctx) => {
  if (!ctx.session.write_user) {
    ctx.session.write_user = false;
    ctx.scene.enter("write_help");
  }
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

app.get('/sleep', async (req, res) =>{
  res.send({type: 200});
});

app.listen(3000, err =>{
  err ? err : console.log('STARTED SERVER');
})