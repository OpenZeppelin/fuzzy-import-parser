// TODO: consider "EOF" token
export enum TokenKind {
  Import = 'import',
  Pragma = 'pragma',
  Contract = 'contract',
}

interface Token {
  kind: TokenKind;
  name?: string;
  value: string;
}

interface Metadata {
  imports: string[];
  solidity: string[];
}

export function getMetadata(source: string): Metadata {
  return new Parser(source).getMetadata();
}

export class Parser {
  index: number = 0;

  constructor(readonly source: string) {}

  getMetadata(): Metadata {
    const imports = [];
    const solidity = [];

    while (true) {
      const token = this.consume();

      if (!token) {
        break;
      }

      if (token.kind === TokenKind.Import) {
        imports.push(token.value);
      } else if (token.kind === TokenKind.Pragma && token.name! === 'solidity') {
        solidity.push(token.value);
      }
    }

    return { imports, solidity };
  }

  consume(): Token | undefined {
    this.consumeUntilImportOrPragma();

    if (this.index >= this.source.length) {
      return undefined;
    }

    if (this.source.startsWith('import', this.index)) {
      return this.consumeImport();
    }

    if (this.source.startsWith('pragma', this.index)) {
      return this.consumePragma();
    }

    throw new Error(`Unexpected input '${this.source.slice(this.index, this.index + 3)}'`);
  }

  consumeUntilImportOrPragma(): void {
    while (this.index < this.source.length) {
      if (this.peek('import') || this.peek('pragma')) {
        break;
      }

      if (this.peek('/*')) {
        this.consumeComment();
      } else if (this.peek('//')) {
        this.consumeLineComment();
      } else if (this.peek(`"`) || this.peek(`'`)) {
        this.consumeString();
      } else {
        this.index += 1;
      }
    }
  }

  consumeWhitespace(): void {
    while (true) {
      if (this.peek('/*')) {
        this.consumeComment();
      } else if (this.peek('//')) {
        this.consumeLineComment();
      } else if (isWhitespace(this.peekChar())) {
        do {
          this.index += 1;
        } while (isWhitespace(this.peekChar()));
      } else {
        break;
      }
    }
  }

  consumeImport(): Token {
    this.consumeLiteral('import');
    this.consumeWhitespace();
    
    // import { foo, bar as baz } from 'file';
    if (this.peek('{')) {
      this.consumeBlock('{', '}');
      this.consumeWhitespace();
      this.consumeLiteral('from');
      this.consumeWhitespace();
    } 
    // import * as foo from 'file';
    else if (this.peek('*')) {
      this.consumeLiteral('*');
      this.consumeWhitespace();
      this.consumeLiteral('as');
      this.consumeWhitespace();
      this.consumeIdentifier();
      this.consumeWhitespace();
      this.consumeLiteral('from');
      this.consumeWhitespace();
    }
    
    // Consume filename
    const value = this.consumeString();
    this.consumeWhitespace();
    
    // import 'file' as foo;
    if (this.peek('as')) {
      this.consumeLiteral('as');
      this.consumeWhitespace();
      this.consumeIdentifier();
      this.consumeWhitespace();
    }

    this.consumeChar(';');
    return {
      kind: TokenKind.Import,
      value,
    };
  }

  consumePragma(): Token {
    this.consumeLiteral('pragma');
    this.consumeWhitespace();
    const name = this.consumeIdentifier();
    this.consumeWhitespace();
    const value = this.consumeUntil(';');
    return {
      kind: TokenKind.Pragma,
      name, 
      value,
    };
  }

  consumeString(): string {
    const delimiter = this.consumeChar();

    if ([`"`, `'`].includes(delimiter)) {
      let value = '';

      let curr;
      while ((curr = this.consumeChar()) !== delimiter) {
        value += curr;
      }

      return value;
    } else {
      throw new Error(`Expected string got '${delimiter}'`);
    }
  }

  consumeUntil(delimiter: string): string {
    let value = '';
    while (!this.peek(delimiter)) {
      const char = this.consumeChar();
      value += char;
      if (this.index >= this.source.length) {
        return value;
      }
    }
    this.index += delimiter.length;
    return value;
  }

  consumeLiteral(token: string): void {
    if (this.source.startsWith(token, this.index)) {
      this.index += token.length;
    } else {
      throw new Error(`Expected token '${token}' got '${this.source.slice(this.index, this.index + 3)}...'`);
    }
  }

  consumeBlock(open: string, close: string): void {
    let depth = 0;

    while (this.index <= this.source.length) {
      if (this.peek(open)) {
        depth += 1;
        this.index += 1;
      } else if (this.peek(close)) {
        depth -= 1;
        this.index += 1;

        if (depth <= 0) {
          break;
        }
      } else if (this.peek('/*')) {
        this.consumeComment();
      } else if (this.peek('//')) {
        this.consumeLineComment();
      } else if (this.peek(`"`) || this.peek(`'`)) {
        this.consumeString();
      } else {
        this.index += 1;
      }
    }

    if (depth !== 0) {
      throw new Error('Unbalanced delimiters');
    }
  }

  consumeComment(): void {
    this.consumeLiteral('/*');
    this.consumeUntil('*/');
  }

  consumeLineComment(): void {
    this.consumeLiteral('//');
    this.consumeUntil('\n');
  }

  consumeChar(expected?: string): string {
    const char = this.source[this.index];
    this.index += 1;
    if (expected && char !== expected) {
      throw new Error(`Expected character '${expected}' got '${char}'`);
    }
    return char;
  }

  consumeIdentifier(): string {
    let value = '';
    while (this.index <= this.source.length) {
      const char = this.consumeChar();
      if (/[a-zA-Z0-9$_]/.test(char)) {
        value += char;
      } else {
        this.index -= 1;
        break;
      }
    }
    return value;
  }

  peekChar(): string {
    return this.source[this.index];
  }

  peek(str: string): boolean {
    return this.source.startsWith(str, this.index);
  }

}

function isWhitespace(char: string) {
  return [' ', '\n', '\t', '\r', '\u000c'].includes(char);
}
