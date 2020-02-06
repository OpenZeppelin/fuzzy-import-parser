import test from 'ava';

import { getMetadata, Parser, TokenKind } from '.';

test('parses empty file', t => {
  const { imports, solidity } = getMetadata('')
  t.deepEqual(imports, []);
  t.deepEqual(solidity, []);
});

test('gets import token', t => {
  const parser = new Parser('import "./token.sol";');
  const token = parser.consume()!;

  t.is(token.kind, TokenKind.Import);
  t.is(token.value, "./token.sol");
});

test('gets pragma token', t => {
  const parser = new Parser('pragma solidity ^0.5.0;');
  const token = parser.consume()!;

  t.is(token.kind, TokenKind.Pragma);
  t.is(token.value, "^0.5.0");
});

test('gets single import', t => {
  const parser = new Parser('import "./token.sol";');
  const { imports } = parser.getMetadata();
  t.deepEqual(imports, ["./token.sol"]);
});

test('gets two imports', t => {
  const parser = new Parser('import "./token.sol"; import "./token2.sol";');
  const { imports } = parser.getMetadata();
  t.deepEqual(imports, ["./token.sol", "./token2.sol"]);
});

test('gets two pragmas', t => {
  const parser = new Parser('pragma solidity ^0.5.0; pragma solidity ^0.5.1;');
  const { solidity } = parser.getMetadata();
  t.deepEqual(solidity, ["^0.5.0", "^0.5.1"]);
});

test('skips a contract', t => {
  const { imports } = getMetadata(`
    contract Foo { }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips a contract with functions', t => {
  const { imports } = getMetadata(`
    contract Foo {
      function test() public returns (uint) {
      }
      function test() public returns (uint) {
      }
    }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips a library and an interface', t => {
  const { imports } = getMetadata(`
    library Foo {}
    interface Foo {}
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips line comment', t => {
  const { imports } = getMetadata(`
    contract Foo {
      // docs
      function () {
      }
    }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips comment', t => {
  const { imports } = getMetadata(`
    contract Foo {
      /* docs */
      function () {
      }
    }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips comments with opening brace', t => {
  const { imports } = getMetadata(`
    contract Foo {
      /* { */
      // {
      function () {
      }
    }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips string with opening brace', t => {
  const { imports } = getMetadata(`
    contract Foo {
      function () {
        return "hehe }";
      }
    }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('fails with unbalanced braces', t => {
  const { imports } = getMetadata(`
    contract Foo } {
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips top level comments', t => {
  const { imports } = getMetadata(`
    /* skip me */
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('ignores other pragmas', t => {
  const { solidity } = getMetadata(`
    pragma abiEncoderV2 true;
    pragma solidity ^0.5.0;
  `);
  t.deepEqual(solidity, ["^0.5.0"]);
});

test('skips a contract with inheritance', t => {
  const { imports } = getMetadata(`
    contract Foo is Bar, Baz(1) {
    }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('gets import with single quotes', t => {
  const { imports } = getMetadata(`
    import './token.sol';
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips single qoute string with opening brace', t => {
  const { imports } = getMetadata(`
    contract Foo {
      function () {
        return 'hehe }';
      }
    }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('gets import with named imports', t => {
  const { imports } = getMetadata(`
    import { x } from './token.sol';
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('skips inheritance with constructor argument struct', t => {
  const { imports } = getMetadata(`
    contract Foo is Bar(Base.X({x:1})) {
      function () {
        return 'hehe }';
      }
    }
    import "./token.sol";
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('gets false positive import', t => {
  const { imports } = getMetadata(`
    contract Foo {
      import "./token.sol";
    }
  `);
  t.deepEqual(imports, ["./token.sol"]);
});

test('handles line comment not ending in newline', t => {
  const { imports } = getMetadata(`import "./foo.sol"; // import "./token.sol";`);
  t.deepEqual(imports, ["./foo.sol"]);
});

test('handles multiline comment not closed', t => {
  const { imports } = getMetadata(`import "./foo.sol"; /* import "./token.sol";`);
  t.deepEqual(imports, ["./foo.sol"]);
});

test('handles pragma statement not ending in semicolon', t => {
  const { solidity } = getMetadata(`pragma solidity ^0.5.0`);
  t.deepEqual(solidity, ["^0.5.0"]);
});

test('import all from file', t => {
  const { imports } = getMetadata(`import * as token from "./token.sol"; contract Foo { }`);
  t.deepEqual(imports, ["./token.sol"]);
});

test('import aliased file', t => {
  const { imports } = getMetadata(`import "./token.sol" as token; contract Foo { }`);
  t.deepEqual(imports, ["./token.sol"]);
});

test('import single from file', t => {
  const { imports } = getMetadata(`import { token } from "./token.sol"; contract Foo { }`);
  t.deepEqual(imports, ["./token.sol"]);
});

test('import single with alias from file', t => {
  const { imports } = getMetadata(`import { token as erc20 } from "./token.sol"; contract Foo { }`);
  t.deepEqual(imports, ["./token.sol"]);
});

test('import multiple from file', t => {
  const { imports } = getMetadata(`import { token, crowdsale } from "./token.sol"; contract Foo { }`);
  t.deepEqual(imports, ["./token.sol"]);
});

test('import multiple with aliases from file', t => {
  const { imports } = getMetadata(`import { token as erc20, crowdsale as ico } from "./token.sol"; contract Foo { }`);
  t.deepEqual(imports, ["./token.sol"]);
});