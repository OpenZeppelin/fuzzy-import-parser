interface Metadata {
  imports: string[];
  solidity: string[];
}

export function getMetadata(source: string) {
  const parser = new Parser(source);

  while (!parser.eof()) {
    console.log(parser.next());
  }
}

type Item = ItemImport | ItemString | ItemEOF;

interface ItemEOF {
  kind: 'eof';
}

interface ItemImport {
  kind: 'import';
  path: string;
}

interface ItemString {
  kind: 'string';
  value: string;
}

class Parser {
  readonly state: StatefulRegExp;

  constructor(readonly source: string) {
    this.state = new StatefulRegExp(source);
  }

  eof(): boolean {
    return this.state.index >= this.source.length;
  }

  next(): Item | undefined {
    const match = this.state.exec(/import|pragma|\/\*|\/\/|"|'/);

    if (match === null) {
      return;
    }

    if (match[0] === 'pragma') {
      while (!this.eof()) {
      }
    }

    if (match[0] === 'import') {
      while (!this.eof()) {
        const token = this.next();

        if (token?.kind === 'string') {
          return {
            kind: 'import',
            path: token.value,
          };
        }
      }
    }

    if (match[0] === '"' || match[0] === `'`) {
      const delimiter = match[0];
      const start = this.state.index;
      this.state.exec(delimiter);
      const end = this.state.index - 1;
      return {
        kind: 'string',
        value: this.source.slice(start, end),
      };
    }

    if (match[0] === '/*') {
      this.state.exec(/\*\//);
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

console.log(getMetadata('import /*x*/ "x";'));
