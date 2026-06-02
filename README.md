# tick

A terminal CLI for [Todoist](https://todoist.com) — tasks, projects, labels, and sections from your shell.

The name is the satisfying *tick* of a checked-off box. This is an unofficial third-party CLI.

## Install

```sh
brew install serhiitroinin/tap/tick
```

Or run from source with [Bun](https://bun.sh):

```sh
bun install
bun run src/cli.ts --help
```

## Setup

Get an API token from Todoist → Settings → Integrations → Developer, then:

```sh
tick setup
tick status
```

The token is stored in the macOS Keychain (service: `tick`).

## Usage

```sh
tick today                       # today's + overdue tasks
tick overview                    # today + upcoming + projects
tick tasks ls --filter "7 days"  # list tasks by filter query
tick tasks q "Buy milk tomorrow" # quick-add with natural language
tick tasks done <id>             # complete a task
tick projects ls                 # list projects
tick labels ls                   # list labels
```

Run `tick --help` (or `tick <command> --help`) for the full command set.

## License

MIT
