# nvim-deimos

Neovim plugin for Deimos Code.

## Install

**lazy.nvim:**
```lua
{
  dir = "~/path/to/openmesa/packages/nvim-deimos",
  config = function()
    require("deimos").setup({
      bin    = "code",       -- deimos-code binary
      split  = "vertical",   -- "vertical" | "horizontal" | "float"
      width  = 80,
    })
  end
}
```

## Keymaps

| Key | Action |
|-----|--------|
| `<leader>dc` | Open Code REPL |
| `<leader>df` | Ask about current file |
| `<leader>da` | Ask about visual selection |

## Commands

- `:Deimos` — open the REPL
- `:DeimosFile` — explain current file
- `:DeimosSelection` — ask about selection (visual mode)
