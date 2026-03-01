import logging

import discord

from backend.agent.confirmations import resolve
from backend.config import settings

logger = logging.getLogger(__name__)

_MAX_LEN = 1900  # Discord limit is 2000, leave headroom


class DiscordConnection:
    def __init__(self, connection_id: str, config: dict):
        self.id = connection_id
        self.token = config["bot_token"]
        self.allowed_ids = {str(i) for i in config.get("allowed_channel_ids", [])}
        self.allowed_user_ids = {str(i) for i in config.get("allowed_user_ids", [])}
        self.provider = config.get("provider", "anthropic")
        self.model = config.get("model", "claude-sonnet-4-6")
        self.api_key = config.get("api_key", "")
        self.base_url = config.get("base_url", "")

        # Map tool_call_id -> discord Message (for editing confirmation status)
        self._pending: dict[str, discord.Message] = {}

    async def run(self):
        intents = discord.Intents.default()
        intents.message_content = True

        client = discord.Client(intents=intents)

        @client.event
        async def on_ready():
            logger.info(f"Discord bot ready ({self.id}) as {client.user}")

        @client.event
        async def on_message(message: discord.Message):
            if message.author.bot:
                return
            if not self._is_allowed(str(message.channel.id), str(message.author.id)):
                return
            await self._handle_message(message)

        @client.event
        async def on_interaction(interaction: discord.Interaction):
            if interaction.type != discord.InteractionType.component:
                return
            await self._handle_button(interaction)

        await client.start(self.token)

    def _is_allowed(self, channel_id: str, user_id: str) -> bool:
        channel_ok = not self.allowed_ids or channel_id in self.allowed_ids
        user_ok = not self.allowed_user_ids or user_id in self.allowed_user_ids
        return channel_ok and user_ok

    async def _handle_message(self, message: discord.Message):
        thinking = await message.reply("⏳")
        response_text = ""

        try:
            runner = self._get_runner()
            history = [{"role": "user", "content": message.content}]

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
                            secrets_note = f"\n⚠️ Sensitive: {', '.join(tc['secrets'])}"

                        view = _ConfirmView(tc["id"])
                        msg = await message.channel.send(
                            f"🔒 **{risk}** — `{tc['name']}`\n`{display}`{secrets_note}\n\nAllow this action?",
                            view=view,
                        )
                        self._pending[tc["id"]] = msg
                    else:
                        await message.channel.send(f"🔧 **{tc['name']}** — `{display}`")

                elif "tool_result" in event:
                    tr = event["tool_result"]
                    if tr["denied"]:
                        await message.channel.send("❌ Denied.")
                    elif tr.get("error"):
                        await message.channel.send(
                            f"⚠️ Error:\n```\n{tr['error'][:500]}\n```"
                        )
                    elif tr.get("output"):
                        output = tr["output"][:1500]
                        await message.channel.send(f"```\n{output}\n```")

                elif "error" in event:
                    await thinking.edit(content=f"⚠️ {event['error']}")
                    return

            if response_text.strip():
                for chunk in _split(response_text):
                    await message.channel.send(chunk)
            await thinking.delete()

        except Exception as e:
            logger.exception(f"Discord handler error: {e}")
            await thinking.edit(content=f"⚠️ Error: {e}")

    async def _handle_button(self, interaction: discord.Interaction):
        custom_id = interaction.data.get("custom_id", "")
        if ":" not in custom_id:
            return

        action_id, decision = custom_id.split(":", 1)
        approved = decision == "yes"
        resolve(action_id, approved)

        status = "✅ Approved" if approved else "❌ Denied"
        await interaction.response.edit_message(
            content=interaction.message.content + f"\n\n{status}",
            view=None,
        )

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


class _ConfirmView(discord.ui.View):
    def __init__(self, action_id: str):
        super().__init__(timeout=120)
        self.action_id = action_id

        approve_btn = discord.ui.Button(
            label="✅ Approve",
            style=discord.ButtonStyle.success,
            custom_id=f"{action_id}:yes",
        )
        deny_btn = discord.ui.Button(
            label="❌ Deny",
            style=discord.ButtonStyle.danger,
            custom_id=f"{action_id}:no",
        )
        approve_btn.callback = self._on_approve
        deny_btn.callback = self._on_deny
        self.add_item(approve_btn)
        self.add_item(deny_btn)

    async def _on_approve(self, interaction: discord.Interaction):
        resolve(self.action_id, True)
        await interaction.response.edit_message(
            content=interaction.message.content + "\n\n✅ Approved",
            view=None,
        )

    async def _on_deny(self, interaction: discord.Interaction):
        resolve(self.action_id, False)
        await interaction.response.edit_message(
            content=interaction.message.content + "\n\n❌ Denied",
            view=None,
        )


def _split(text: str) -> list[str]:
    chunks = []
    while len(text) > _MAX_LEN:
        chunks.append(text[:_MAX_LEN])
        text = text[_MAX_LEN:]
    if text:
        chunks.append(text)
    return chunks
