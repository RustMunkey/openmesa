local M = {}

M.config = {
  bin = "code",          -- deimos-code binary name
  split = "vertical",   -- "vertical" | "horizontal" | "float"
  width = 80,            -- width for vertical split
  height = 20,           -- height for horizontal split
}

local function get_root()
  return vim.fn.getcwd()
end

local function open_terminal(cmd)
  local cfg = M.config
  if cfg.split == "float" then
    local width  = math.floor(vim.o.columns * 0.8)
    local height = math.floor(vim.o.lines * 0.8)
    local buf = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_open_win(buf, true, {
      relative = "editor",
      width    = width,
      height   = height,
      row      = math.floor((vim.o.lines - height) / 2),
      col      = math.floor((vim.o.columns - width) / 2),
      style    = "minimal",
      border   = "rounded",
    })
  elseif cfg.split == "horizontal" then
    vim.cmd(string.format("botright %dsplit", cfg.height))
  else
    vim.cmd(string.format("botright %dvsplit", cfg.width))
  end

  vim.fn.termopen(cmd, {
    cwd  = get_root(),
    env  = { NVIM = vim.v.servername },
    on_exit = function() end,
  })
  vim.cmd("startinsert")
end

-- Open (or focus) the Deimos REPL
function M.open()
  -- Check if a deimos terminal buffer already exists
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    local name = vim.api.nvim_buf_get_name(buf)
    if name:match("deimos") or vim.b[buf].is_deimos then
      -- Find a window showing this buffer
      for _, win in ipairs(vim.api.nvim_list_wins()) do
        if vim.api.nvim_win_get_buf(win) == buf then
          vim.api.nvim_set_current_win(win)
          return
        end
      end
      -- Buffer exists but not visible — open it
      vim.cmd(string.format("botright %dvsplit", M.config.width))
      vim.api.nvim_win_set_buf(0, buf)
      vim.cmd("startinsert")
      return
    end
  end

  open_terminal(M.config.bin)
  vim.b.is_deimos = true
end

-- Send selected text to the REPL with context
function M.ask_selection()
  local start_line = vim.fn.line("'<")
  local end_line   = vim.fn.line("'>")
  local lines      = vim.api.nvim_buf_get_lines(0, start_line - 1, end_line, false)
  local code       = table.concat(lines, "\n")
  local file       = vim.fn.expand("%:.")
  local lang       = vim.bo.filetype

  local prompt = string.format(
    "In %s (%s), explain or help with:\n```%s\n%s\n```",
    file, lang, lang, code
  )

  M._send(prompt)
end

-- Send current file path for context
function M.ask_file()
  local file = vim.fn.expand("%:.")
  M._send("Read and explain: " .. file)
end

function M._send(text)
  -- Find the deimos terminal job
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.b[buf].is_deimos then
      local chan = vim.api.nvim_buf_get_var(buf, "terminal_job_id")
      if chan then
        vim.api.nvim_chan_send(chan, text .. "\n")
        return
      end
    end
  end
  -- Not open yet — open and queue message
  M.open()
  vim.defer_fn(function() M._send(text) end, 1500)
end

function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  -- Default keymaps
  vim.keymap.set("n", "<leader>dc", M.open,          { desc = "Deimos: Open Code REPL" })
  vim.keymap.set("n", "<leader>df", M.ask_file,      { desc = "Deimos: Ask about file" })
  vim.keymap.set("v", "<leader>da", M.ask_selection, { desc = "Deimos: Ask about selection" })

  -- Commands
  vim.api.nvim_create_user_command("Deimos",          M.open,          {})
  vim.api.nvim_create_user_command("DeimosFile",      M.ask_file,      {})
  vim.api.nvim_create_user_command("DeimosSelection", M.ask_selection, { range = true })
end

return M
