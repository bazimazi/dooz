# dooz

dooz (Tic Tac Toe) - on 3×3, 6×6 and 9×9 boards.

## Where the game is

**[`src/`](src/) is the current implementation.** One codebase that runs as a web
app, an installable PWA, a desktop app (Windows, macOS, Linux) and a native
mobile app (iOS, Android), with local, online and bot play. Start there:

```bash
cd src
npm install
npm run dev
```

See [`src/README.md`](src/README.md) for the stack, the architecture, and how to
build for each platform.

## The earlier versions

The game began as one build per framework - React, Vue, Svelte, Solid and
vanilla JavaScript - written as a comparison between them. The React one was the
most complete, and `src/` is the rebuild of it. The others are in the history
rather than the working tree.

## Design

Designs are in Figma:

https://www.figma.com/file/qrujFLqQzWtczHCh8G0FQF

## Licence

MIT - see [LICENSE](LICENSE).
