import logging

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, MessageHandler, CallbackQueryHandler, filters

from backend.agent.confirmations import resolve
from backend.agent.context import connection_id as ctx_connection_id, chat_id as ctx_chat_id
from backend.agent.notifier import register, unregister
from backend.config import settings

logger = logging.getLogger(__name__)

# Max Telegram message length
_MAX_LEN = 4000


class TelegramConnection:
    def __init__(self, connection_id: str, config: dict):
        self.id = connection_id
        self.token = config["bot_token"]
        self.allowed_ids = {str(i) for i in config.get("allowed_chat_ids", [])}
        self.provider = config.get("provider", "anthropic")
        self.model = config.get("model", "claude-sonnet-4-6")
        self.api_key = config.get("api_key", "")
        self.base_url = config.get("base_url", "")

    async def run(self):
        import asyncio

        async def _send(chat_id: str, text: str):
            await self._app.bot.send_message(chat_id=chat_id, text=text)

        self._app = Application.builder().token(self.token).build()
        self._app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self._on_message))
        self._app.add_handler(CallbackQueryHandler(self._on_callback))

        register(self.id, _send)
        try:
            async with self._app:
                await self._app.start()
                await self._app.updater.start_polling(drop_pending_updates=True)
                logger.info(f"Telegram bot polling started ({self.id})")
                await asyncio.Event().wait()
        finally:
            unregister(self.id)

    def _is_allowed(self, chat_id: str) -> bool:
        return not self.allowed_ids or chat_id in self.allowed_ids

    async def _on_message(self, update: Update, context):
        chat_id = str(update.effective_chat.id)
        if not self._is_allowed(chat_id):
            await update.message.reply_text("⛔ Unauthorized.")
            return

        text = update.message.text
        thinking = await update.message.reply_text("⏳")

        response_text = ""
        tool_msgs = []

        try:
            ctx_connection_id.set(self.id)
            ctx_chat_id.set(chat_id)

            runner = self._get_runner()
            history = [{"role": "user", "content": text}]

            async for event in runner(history):
                if "chunk" in event:
                    response_text += event["chunk"]

                elif "tool_call" in event:
                    tc = event["tool_call"]
                    risk = tc["risk"].upper()
                    display = tc["display"]

                    if tc["requires_confirmation"]:
                        secrets_note = ""
                        if tc.get("secrets"):
                            secrets_note = f"\n⚠️ Sensitive data detected: {', '.join(tc['secrets'])}"

                        keyboard = InlineKeyboardMarkup([[
                            InlineKeyboardButton("✅ Approve", callback_data=f"{tc['id']}:yes"),
                            InlineKeyboardButton("❌ Deny", callback_data=f"{tc['id']}:no"),
                        ]])
                        msg = await context.bot.send_message(
                            chat_id=chat_id,
                            text=f"🔒 *{risk}* — `{tc['name']}`\n`{display}`{secrets_note}\n\nAllow this action?",
                            reply_markup=keyboard,
                            parse_mode="Markdown",
                        )
                        tool_msgs.append(msg.message_id)
                    else:
                        msg = await context.bot.send_message(
                            chat_id=chat_id,
                            text=f"🔧 *{tc['name']}* — `{display}`",
                            parse_mode="Markdown",
                        )
                        tool_msgs.append(msg.message_id)

                elif "tool_result" in event:
                    tr = event["tool_result"]
                    if tr["denied"]:
                        await context.bot.send_message(chat_id=chat_id, text="❌ Denied.")
                    elif tr.get("error"):
                        await context.bot.send_message(
                            chat_id=chat_id,
                            text=f"⚠️ Error:\n```\n{tr['error'][:500]}\n```",
                            parse_mode="Markdown",
                        )
                    elif tr.get("output"):
                        output = tr["output"][:1500]
                        await context.bot.send_message(
                            chat_id=chat_id,
                            text=f"```\n{output}\n```",
                            parse_mode="Markdown",
                        )

                elif "error" in event:
                    await thinking.edit_text(f"⚠️ {event['error']}")
                    return

            # Send final response
            if response_text.strip():
                for chunk in _split(response_text):
                    await context.bot.send_message(chat_id=chat_id, text=chunk)
            await thinking.delete()

        except Exception as e:
            logger.exception(f"Telegram handler error: {e}")
            await thinking.edit_text(f"⚠️ Error: {e}")

    async def _on_callback(self, update: Update, context):
        query = update.callback_query
        await query.answer()

        chat_id = str(query.message.chat.id)
        if not self._is_allowed(chat_id):
            return

        try:
            action_id, decision = query.data.split(":")
            approved = decision == "yes"
            resolve(action_id, approved)
            status = "✅ Approved" if approved else "❌ Denied"
            await query.edit_message_reply_markup(InlineKeyboardMarkup([]))
            await query.edit_message_text(query.message.text + f"\n\n{status}", parse_mode="Markdown")
        except Exception as e:
            logger.error(f"Callback error: {e}")

    def _get_runner(self):
        if self.provider == "anthropic":
            from backend.agent.runner import run
            api_key = self.api_key or settings.anthropic_api_key

            async def _run(messages):
                async for event in run(messages, self.model, api_key):
                    yield event
            return _run

        else:
            from backend.agent.runner_openai_compat import run
            if self.provider == "ollama":
                base_url = f"{self.base_url or settings.ollama_base_url}/v1"
                api_key = "ollama"
            elif self.provider == "openai":
                base_url = "https://api.openai.com/v1"
                api_key = self.api_key or settings.openai_api_key
            else:
                base_url = self.base_url
                api_key = self.api_key

            async def _run(messages):
                async for event in run(messages, self.model, api_key, base_url):
                    yield event
            return _run


def _split(text: str) -> list[str]:
    chunks = []
    while len(text) > _MAX_LEN:
        chunks.append(text[:_MAX_LEN])
        text = text[_MAX_LEN:]
    if text:
        chunks.append(text)
    return chunks
