interface Metadata {
  imports: string[];
  solidity: string[];
}

export function getMetadata(source: string): Metadata {
  const imports = [];
  const solidity = [];

  const parser = new Parser(source);

  for (const item of parser.parse()) {
    if (item === undefined) {
      break;
    }

    if (item.kind === 'import') {
      imports.push(item.value);
    }

    if (item.kind === 'pragma' && item.name === 'solidity') {
      solidity.push(item.value);
    }
  }

  return { imports, solidity };
}

type Item = ItemBounds & (ImportItem | PragmaItem | CommentItem | StringItem | SemicolonItem);

interface ItemBounds {
  start: number;
  end: number;
}

interface ImportItem {
  kind: 'import';
  value: string;
}

interface PragmaItem {
  kind: 'pragma';
  name: string;
  value: string;
}

interface CommentItem {
  kind: 'comment';
}

interface StringItem {
  kind: 'string';
  value: string;
}

interface SemicolonItem {
  kind: 'semicolon';
}

class Parser {
  private readonly state: StatefulRegExp;

  constructor(readonly source: string) {
    this.state = new StatefulRegExp(source);
  }

  *parse(semicolons: boolean = false): Generator<Item> {
    while (true) {
      const item = this.next(semicolons);
      if (item === undefined) {
        break;
      } else {
        yield item;
      }
    }
  }

  private next(semicolons: boolean): Item | undefined {
    const re = semicolons ? /import|pragma|\/\*|\/\/|"|'|;/ : /import|pragma|\/\*|\/\/|"|'/;

    const match = this.state.exec(re);

    if (match === null) {
      return undefined;
    }

    const anchor = match[0];
    const start = match.index;

    if (anchor === 'pragma') {
      const name = this.state.exec(/[a-zA-Z0-9$_]+/)?.[0];

      if (name !== undefined) {
        let value = '';

        let chunkStart = this.state.index;
        let end = -1;

        for (const item of this.parse(true)) {
          if (item.kind === 'comment' || item.kind === 'semicolon') {
            value += this.source.slice(chunkStart, item.start);
            chunkStart = item.end;
          }

          if (item.kind === 'semicolon') {
            end = item.start;
            break;
          }
        }

        return {
          kind: 'pragma',
          name,
          value,
          start,
          end,
        };
      }
    }

    else if (anchor === 'import') {
      for (const item of this.parse()) {
        if (item.kind === 'string') {
          return {
            kind: 'import',
            value: item.value,
            end: item.end,
            start,
          };
        }
      }
    }

    else if (anchor === '"' || anchor === `'`) {
      const contentStart = this.state.index;
      this.state.exec(anchor);
      const contentEnd = this.state.index - 1;
      return {
        kind: 'string',
        value: this.source.slice(contentStart, contentEnd),
        start,
        end: this.state.index,
      };
    }

    else if (anchor === '/*') {
      const close = this.state.exec(/\*\//);
      return {
        kind: 'comment',
        start,
        end: this.state.index,
      };
    }

    else if (anchor === '//') {
      const close = this.state.exec(/\n/);
      return {
        kind: 'comment',
        start,
        end: close?.index ?? this.state.index,
      };
    }

    else if (anchor === ';') {
      return {
        kind: 'semicolon',
        start,
        end: this.state.index,
      };
    }
  }
}

class StatefulRegExp {
  index: number = 0;

  constructor(readonly source: string) {}

  exec(re: RegExp | string): RegExpExecArray | null {
    const sticky = new RegExp(re, 'g');
    sticky.lastIndex = this.index;
    const match = sticky.exec(this.source);
    if (match === null) {
      this.index = this.source.length;
    } else {
      this.index = sticky.lastIndex;
    }
    return match;
  }
}
