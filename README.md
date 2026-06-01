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
tick setup <token>
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

## Migrating from `luff`

`tick` was extracted from the `todo` tool in the `luff` monorepo. To copy your existing
Todoist token from the old Keychain entry:

```sh
tick auth-import-from-luff
```

This reads the credential stored under the legacy `luff-todo` Keychain service and copies
it to `tick`. It is idempotent and does not delete the original.

## License

MIT
