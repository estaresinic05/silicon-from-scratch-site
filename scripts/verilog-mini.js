/* =========================================================================
   verilog-mini.js — a tiny Verilog parser + 1-bit evaluator for the editable
   flip cards (Logic Gates / 1-bit ALU / gated D-latch).

   This is NOT a full Verilog implementation. It accepts a deliberately small,
   well-defined subset and reports a precise error (message + source span) for
   anything outside it, so the editor can draw a red squiggle exactly where the
   problem is. Supported:

     - optional `module name ( ansi_ports ); … endmodule`, or bare declarations
       + statements with no module wrapper (the simple gate cards)
     - port decls   : input/output/inout [wire|reg|logic] [range] a, b, …;
     - net decls    : wire/reg/logic [range] w [= expr], …;
     - continuous   : assign lhs = expr;
     - combinational: always @(*) | @* | @(list)  <statement>
     - statements   : begin…end, if/else, blocking `=` and non-blocking `<=`
     - expressions  : ?: || && | ^ & == != === !== < <= > >= << >> + -
                      unary ~ ! - and reduction & | ^ , parens, ids, numbers
                      (1'b0, 4'hF, 42 … all evaluated as their least-significant
                      bit — everything here is 1-bit)

   Everything is evaluated to a single bit. Values propagate to a fixpoint, so
   chained assigns and internal wires work; an always block that doesn't assign
   its target (e.g. `if (clk) q = d;` with clk low) HOLDS its previous value —
   that's what makes a latch a latch.

   API (attached to window.VerilogMini, or module.exports under Node/cscript):
     compile(src) -> {
       ok, error:{message,start,end}|null,
       inputs:[…], outputs:[…], regs:[…], display,      // for the UI
       eval(env, state) -> { <signal>: 0|1, … }          // state persists regs
     }
     highlight(src, errRange) -> HTML string             // colourised + squiggle
   ========================================================================= */
(function (global) {
  "use strict";

  function inArr(a, x) { for (var i = 0; i < a.length; i++) if (a[i] === x) return true; return false; }
  function pushU(a, x) { if (!inArr(a, x)) a.push(x); }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  var KEYWORDS = {
    module: 1, endmodule: 1, input: 1, output: 1, inout: 1, wire: 1, reg: 1,
    logic: 1, assign: 1, always: 1, begin: 1, end: 1, "if": 1, "else": 1,
    posedge: 1, negedge: 1, or: 1, parameter: 1, localparam: 1
  };

  /* ---------------------------------------------------------------- Lexer.
     Always spans the whole source (a bad character becomes a 1-char 'unknown'
     token and lexing continues) so the highlighter can still colour, and the
     first lexical problem is reported via .error. */
  function lex(src) {
    var toks = [], i = 0, n = src.length, error = null;
    function idStart(c) { return /[A-Za-z_]/.test(c); }
    function idPart(c) { return /[A-Za-z0-9_$]/.test(c); }
    function push(type, s, e) { toks.push({ type: type, value: src.slice(s, e), start: s, end: e }); }

    while (i < n) {
      var c = src.charAt(i);
      if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\f" || c === "\v") { i++; continue; }
      if (c === "/" && src.charAt(i + 1) === "/") {
        var s0 = i; i += 2; while (i < n && src.charAt(i) !== "\n") i++; push("comment", s0, i); continue;
      }
      if (c === "/" && src.charAt(i + 1) === "*") {
        var b0 = i; i += 2;
        while (i < n && !(src.charAt(i) === "*" && src.charAt(i + 1) === "/")) i++;
        if (i < n) i += 2; else { if (!error) error = { message: "unterminated block comment", start: b0, end: n }; i = n; }
        push("comment", b0, i); continue;
      }
      if (/[0-9]/.test(c)) {
        var d0 = i, m = /^[0-9]+(?:\s*'\s*[bBoOdDhH][0-9a-fA-FxXzZ_]+)?/.exec(src.slice(i));
        i += m[0].length; push("num", d0, i); continue;
      }
      if (c === "'" && /[bBoOdDhH]/.test(src.charAt(i + 1))) {
        var q0 = i, mq = /^'\s*[bBoOdDhH][0-9a-fA-FxXzZ_]+/.exec(src.slice(i));
        i += mq[0].length; push("num", q0, i); continue;
      }
      if (idStart(c)) {
        var w0 = i; i++; while (i < n && idPart(src.charAt(i))) i++;
        var w = src.slice(w0, i); push(KEYWORDS[w] ? "kw" : "id", w0, i); continue;
      }
      var three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === "===" || three === "!==") { push("op", i, i + 3); i += 3; continue; }
      if (/^(==|!=|&&|\|\||<=|>=|<<|>>|~&|~\||~\^|\^~)$/.test(two)) { push("op", i, i + 2); i += 2; continue; }
      if ("()[]{};,:@*.#".indexOf(c) >= 0) { push("punc", i, i + 1); i++; continue; }
      if ("~&|^?!=<>+-".indexOf(c) >= 0) { push("op", i, i + 1); i++; continue; }
      if (!error) error = { message: "unexpected character '" + c + "'", start: i, end: i + 1 };
      push("unknown", i, i + 1); i++;
    }
    return { tokens: toks, error: error };
  }

  /* ------------------------------------------------------------- Number value
     (least-significant bit only — everything here is 1-bit). */
  function numVal(s) {
    var m = /^([0-9]+)?\s*'\s*([bodhBODH])\s*([0-9a-fA-FxXzZ_]+)/.exec(s);
    if (m) {
      var base = { b: 2, o: 8, d: 10, h: 16 }[m[2].toLowerCase()];
      var digits = m[3].replace(/_/g, "").replace(/[xzXZ]/g, "0");
      var v = parseInt(digits, base); if (isNaN(v)) v = 0;
      return v & 1;
    }
    var d = parseInt(s, 10); if (isNaN(d)) d = 0; return d & 1;
  }

  /* ---------------------------------------------------------------- Parser. */
  function ParseError(message, tok) { this.message = message; this.start = tok.start; this.end = tok.end > tok.start ? tok.end : tok.start + 1; }

  function parse(tokens, src) {
    var ts = [];
    for (var k = 0; k < tokens.length; k++) if (tokens[k].type !== "comment") ts.push(tokens[k]);
    var lastReal = ts.length ? ts[ts.length - 1] : { start: src.length, end: src.length };
    var EOF = { type: "eof", value: "", start: src.length, end: src.length };
    var p = 0;

    var ctx = { inputs: [], outputs: [], regs: [], wires: [], assigns: [], always: [], params: {}, decls: {}, idRefs: [] };

    function peek() { return p < ts.length ? ts[p] : EOF; }
    function next() { var t = peek(); if (p < ts.length) p++; return t; }
    function isV(v) { return peek().value === v; }
    function err(msg, tok) { if (tok.type === "eof") tok = lastReal; return new ParseError(msg, tok); }
    function eat(v) { var t = peek(); if (t.value !== v) throw err("expected '" + v + "'", t); return next(); }

    function declare(name, dir, kind) {
      if (!ctx.decls[name]) ctx.decls[name] = { dir: null, kind: null };
      if (dir) { ctx.decls[name].dir = dir; if (dir === "input") pushU(ctx.inputs, name); if (dir === "output") pushU(ctx.outputs, name); }
      if (kind) { ctx.decls[name].kind = kind; if (kind === "reg") pushU(ctx.regs, name); if (kind === "wire" || kind === "logic") pushU(ctx.wires, name); }
    }
    function ref(tok, isLhs) { ctx.idRefs.push({ name: tok.value, start: tok.start, end: tok.end, lhs: !!isLhs }); }

    function parseSource() { while (p < ts.length) { if (isV("module")) parseModule(); else parseItem(); } }

    function parseModule() {
      eat("module");
      var nm = peek(); if (nm.type !== "id") throw err("expected a module name", nm); next();
      if (isV("(")) parseAnsiPorts();
      eat(";");
      while (p < ts.length && !isV("endmodule")) parseItem();
      eat("endmodule");
    }

    function parseAnsiPorts() {
      eat("(");
      if (isV(")")) { next(); return; }
      var dir = null, kind = null;
      do {
        if (isV("input") || isV("output") || isV("inout")) { dir = next().value; kind = null; }
        if (isV("wire") || isV("reg") || isV("logic")) { kind = next().value; }
        parseRangeOpt();
        var id = peek(); if (id.type !== "id") throw err("expected a port name", id); next();
        declare(id.value, dir, kind);
      } while (isV(",") && next());
      eat(")");
    }

    function parseItem() {
      var t = peek();
      if (t.value === "input" || t.value === "output" || t.value === "inout") return parsePortDecl();
      if (t.value === "wire" || t.value === "reg" || t.value === "logic") return parseNetDecl();
      if (t.value === "assign") return parseAssign();
      if (t.value === "always") return parseAlways();
      if (t.value === "parameter" || t.value === "localparam") return parseParam();
      if (t.type === "id") return parseInstance();
      throw err("unexpected " + (t.type === "eof" ? "end of input" : "'" + t.value + "'"), t);
    }

    /* Module instantiation:  <type> [#( … )] <inst> ( <port connections> ) ;
       verilog-mini can't simulate the sub-module (it's outside the 1-bit
       subset), so this is a no-op for evaluation — but it's ACCEPTED so real
       testbench code (which instantiates the DUT) doesn't read as a syntax
       error. The connected signals are still parsed, so an undeclared signal in
       a port map is still reported. */
    function parseInstance() {
      var typeTok = peek();
      if (typeTok.type !== "id") throw err("expected a module or type name", typeTok);
      next();
      if (isV("#")) { next(); eat("("); parseConnList(); eat(")"); }   // parameter overrides
      var inst = peek();
      if (inst.type !== "id") throw err("expected an instance name", inst);
      next();
      eat("("); parseConnList(); eat(")"); eat(";");
    }
    /* A comma list of `.name(expr)` (named) or bare `expr` (positional)
       connections — used for both a port map and a #( … ) parameter override.
       The port / parameter NAME belongs to the sub-module, so it is not
       ref-checked; the connected expression IS parsed, so its identifiers are. */
    function parseConnList() {
      if (isV(")")) return;
      do {
        if (isV(".")) {
          next();
          var pn = peek(); if (pn.type !== "id") throw err("expected a port name", pn); next();
          eat("("); if (!isV(")")) parseExpr(); eat(")");
        } else {
          parseExpr();
        }
      } while (isV(",") && next());
    }

    function parsePortDecl() {
      var dir = next().value, kind = null;
      if (isV("wire") || isV("reg") || isV("logic")) kind = next().value;
      parseRangeOpt(); parseIdList(dir, kind); eat(";");
    }
    function parseNetDecl() {
      var kind = next().value; parseRangeOpt(); parseIdList(null, kind); eat(";");
    }
    function parseIdList(dir, kind) {
      do {
        var id = peek(); if (id.type !== "id") throw err("expected an identifier", id); next();
        declare(id.value, dir, kind);
        if (isV("=")) { next(); var e = parseExpr(); ctx.assigns.push({ lhs: id.value, rhs: e }); }
      } while (isV(",") && next());
    }
    function parseParam() {
      next(); parseRangeOpt();
      do {
        var id = peek(); if (id.type !== "id") throw err("expected a parameter name", id); next();
        declare(id.value, null, null);
        eat("="); var e = parseExpr();
        try { ctx.params[id.value] = evalNode(e, {}); } catch (ignore) { ctx.params[id.value] = 0; }
      } while (isV(",") && next());
      eat(";");
    }
    function parseRangeOpt() { if (isV("[")) { next(); parseExpr(); eat(":"); parseExpr(); eat("]"); } }

    function parseAssign() {
      eat("assign");
      var lhs = parseLValue(); eat("="); var rhs = parseExpr(); eat(";");
      ctx.assigns.push({ lhs: lhs, rhs: rhs });
    }
    function parseLValue() {
      var id = peek(); if (id.type !== "id") throw err("expected a signal name", id); next();
      if (isV("[")) { next(); parseExpr(); if (isV(":")) { next(); parseExpr(); } eat("]"); }
      ref(id, true); return id.value;
    }

    function parseAlways() {
      eat("always");
      if (isV("@")) {
        next();
        if (isV("*")) next();
        else if (isV("(")) { next(); parseSensList(); eat(")"); }
        else throw err("expected '(' or '*' after @", peek());
      }
      ctx.always.push({ stmt: parseStatement() });
    }
    function parseSensList() {
      if (isV("*")) { next(); return; }
      do {
        if (isV("posedge") || isV("negedge")) next();
        var t = peek();
        if (t.type === "id") { next(); ref(t, false); }
        else if (isV("*")) next();
        else throw err("expected a signal in the sensitivity list", t);
      } while ((isV("or") || isV(",")) && next());
    }
    function parseStatement() {
      var t = peek();
      if (t.value === "begin") return parseBlock();
      if (t.value === "if") return parseIf();
      if (t.value === ";") { next(); return { type: "empty" }; }
      if (t.type === "id") return parseAssignStmt();
      throw err("expected a statement", t);
    }
    function parseBlock() {
      eat("begin"); var body = [];
      while (p < ts.length && !isV("end")) body.push(parseStatement());
      eat("end"); return { type: "block", body: body };
    }
    function parseIf() {
      eat("if"); eat("("); var cond = parseExpr(); eat(")");
      var then = parseStatement(), els = null;
      if (isV("else")) { next(); els = parseStatement(); }
      return { type: "if", cond: cond, then: then, els: els };
    }
    function parseAssignStmt() {
      var lhs = parseLValue();
      if (isV("=")) next(); else if (isV("<=")) next(); else throw err("expected '=' in the assignment", peek());
      var rhs = parseExpr(); eat(";");
      return { type: "assign", lhs: lhs, rhs: rhs };
    }

    /* Expression grammar, lowest precedence first. Each level is a function
       declaration (hoisted), so forward references between levels resolve; the
       `opChain` levels are vars assigned before parseSource() runs below. */
    function parseExpr() { return parseTernary(); }
    function parseTernary() {
      var c = parseLogOr();
      if (isV("?")) { next(); var a = parseTernary(); eat(":"); var b = parseTernary(); return { t: "tern", c: c, a: a, b: b }; }
      return c;
    }
    function opChain(nextFn, ops) {
      return function () {
        var left = nextFn();
        while (peek().type === "op" && inArr(ops, peek().value)) { var op = next().value; left = { t: "bin", op: op, a: left, b: nextFn() }; }
        return left;
      };
    }
    var parseLogAnd = opChain(function () { return parseBitOr(); }, ["&&"]);
    var parseLogOr = opChain(function () { return parseLogAnd(); }, ["||"]);
    var parseBitOr = opChain(function () { return parseBitXor(); }, ["|", "~|"]);
    var parseBitXor = opChain(function () { return parseBitAnd(); }, ["^", "~^", "^~"]);
    var parseBitAnd = opChain(function () { return parseEq(); }, ["&", "~&"]);
    var parseEq = opChain(function () { return parseRel(); }, ["==", "!=", "===", "!=="]);
    var parseRel = opChain(function () { return parseShift(); }, ["<", "<=", ">", ">="]);
    var parseShift = opChain(function () { return parseAdd(); }, ["<<", ">>"]);
    var parseAdd = opChain(function () { return parseUnary(); }, ["+", "-"]);

    function parseUnary() {
      var t = peek();
      if (t.type === "op" && (t.value === "~" || t.value === "!" || t.value === "-" || t.value === "&" || t.value === "|" || t.value === "^")) {
        next(); return { t: "un", op: t.value, a: parseUnary() };
      }
      return parsePrimary();
    }
    function parsePrimary() {
      var t = peek();
      if (t.value === "(") { next(); var e = parseExpr(); eat(")"); return e; }
      if (t.type === "num") { next(); return { t: "num", v: numVal(t.value) }; }
      if (t.type === "id") {
        next();
        if (isV("[")) { next(); parseExpr(); if (isV(":")) { next(); parseExpr(); } eat("]"); }
        ref(t, false);
        return { t: "id", name: t.value, start: t.start, end: t.end };
      }
      throw err("expected an expression", t);
    }

    parseSource();
    return ctx;
  }

  /* -------------------------------------------------------------- Evaluator. */
  function evalNode(node, vals) {
    switch (node.t) {
      case "num": return node.v & 1;
      case "id":
        if (!(node.name in vals)) throw { message: "'" + node.name + "' is not declared", start: node.start, end: node.end };
        return vals[node.name] & 1;
      case "un": {
        var a = evalNode(node.a, vals);
        if (node.op === "~") return (~a) & 1;
        if (node.op === "!") return a ? 0 : 1;
        if (node.op === "-") return (-a) & 1;
        return a & 1;                        // reduction &,|,^ on 1 bit
      }
      case "bin": {
        var x = evalNode(node.a, vals), y = evalNode(node.b, vals);
        switch (node.op) {
          case "&": case "&&": return (x && y) ? 1 : 0;
          case "|": case "||": return (x || y) ? 1 : 0;
          case "^": return (x ^ y) & 1;
          case "~&": return (x && y) ? 0 : 1;
          case "~|": return (x || y) ? 0 : 1;
          case "~^": case "^~": return (x ^ y) ? 0 : 1;
          case "==": case "===": return x === y ? 1 : 0;
          case "!=": case "!==": return x !== y ? 1 : 0;
          case "<": return x < y ? 1 : 0;
          case "<=": return x <= y ? 1 : 0;
          case ">": return x > y ? 1 : 0;
          case ">=": return x >= y ? 1 : 0;
          case "<<": return (x << y) & 1;
          case ">>": return (x >> y) & 1;
          case "+": return (x + y) & 1;
          case "-": return (x - y) & 1;
        }
        throw { message: "unsupported operator '" + node.op + "'" };
      }
      case "tern": return evalNode(node.c, vals) ? evalNode(node.a, vals) : evalNode(node.b, vals);
    }
    throw { message: "cannot evaluate" };
  }

  function execStmt(stmt, vals, mark) {
    if (!stmt) return;
    if (stmt.type === "block") { for (var i = 0; i < stmt.body.length; i++) execStmt(stmt.body[i], vals, mark); return; }
    if (stmt.type === "if") {
      var c; try { c = evalNode(stmt.cond, vals); } catch (e) { return; }
      if (c) execStmt(stmt.then, vals, mark); else if (stmt.els) execStmt(stmt.els, vals, mark);
      return;
    }
    if (stmt.type === "assign") {
      var v; try { v = evalNode(stmt.rhs, vals); } catch (e) { return; }
      if (vals[stmt.lhs] !== v) { vals[stmt.lhs] = v; mark(); }
    }
  }

  function evaluate(ctx, env, state) {
    env = env || {}; state = state || {};
    var vals = {}, nm;
    for (nm in ctx.params) vals[nm] = ctx.params[nm] & 1;
    for (nm in ctx.decls) {
      if (nm in env) vals[nm] = env[nm] & 1;
      else if (nm in state) vals[nm] = state[nm] & 1;
      else vals[nm] = 0;
    }
    for (var ii = 0; ii < ctx.inputs.length; ii++) { var inn = ctx.inputs[ii]; if (inn in env) vals[inn] = env[inn] & 1; }

    for (var it = 0; it < 40; it++) {
      var changed = false;
      var mark = function () { changed = true; };
      for (var a = 0; a < ctx.assigns.length; a++) {
        var as = ctx.assigns[a], v;
        try { v = evalNode(as.rhs, vals); } catch (e) { continue; }
        if (vals[as.lhs] !== v) { vals[as.lhs] = v; changed = true; }
      }
      for (var b = 0; b < ctx.always.length; b++) execStmt(ctx.always[b].stmt, vals, mark);
      if (!changed) break;
    }
    for (var r = 0; r < ctx.regs.length; r++) state[ctx.regs[r]] = vals[ctx.regs[r]] || 0;
    return vals;
  }

  function checkSemantics(ctx) {
    var first = null;
    for (var i = 0; i < ctx.idRefs.length; i++) {
      var r = ctx.idRefs[i];
      if (!(r.name in ctx.decls) && !(r.name in ctx.params)) {
        if (!first || r.start < first.start) first = { message: "'" + r.name + "' is not declared", start: r.start, end: r.end };
      }
    }
    return first;
  }

  /* ---------------------------------------------------------------- Public. */
  function compile(src) {
    var lexed = lex(src), tokens = lexed.tokens, ctx = null, perr = null;
    try { ctx = parse(tokens, src); }
    catch (e) {
      if (e && typeof e.start === "number") perr = { message: e.message, start: e.start, end: e.end };
      else throw e;
    }
    var error = lexed.error || perr || (ctx ? checkSemantics(ctx) : null);
    var out = {
      ok: !error,
      error: error || null,
      inputs: ctx ? ctx.inputs : [],
      outputs: ctx ? ctx.outputs : [],
      regs: ctx ? ctx.regs : [],
      display: (ctx && ctx.outputs.length) ? ctx.outputs[0] : null,
      tokens: tokens,
      eval: function (env, state) { return ctx ? evaluate(ctx, env, state) : {}; }
    };
    return out;
  }

  function highlight(src, err) {
    var toks = lex(src).tokens, out = "", pos = 0;

    /* Some colours need more than a token's own type — a bare identifier could
       be a signal, a declared module name, an instantiated module's type, or an
       instance name. Resolve those with a little lookahead over the non-comment
       tokens, recording an override class per token index:
         - `module <name>`               → <name> is a module name (tok-type)
         - `<type> [#( … )] <inst> ( … )` → <type> tok-type, <inst> tok-inst  */
    var sig = [];
    for (var s = 0; s < toks.length; s++) if (toks[s].type !== "comment") sig.push(s);
    var extra = {};
    function T(j) { return (j >= 0 && j < sig.length) ? toks[sig[j]] : null; }
    function val(j) { var t = T(j); return t ? t.value : null; }
    function typ(j) { var t = T(j); return t ? t.type : null; }

    for (var j = 0; j < sig.length; j++) {
      var st = T(j);
      if (!st || st.type !== "id" || extra[sig[j]]) continue;
      if (val(j - 1) === "module") { extra[sig[j]] = "tok-type"; continue; }
      var k = j + 1;
      if (val(k) === "#") {                     // skip an optional #( … ) param list
        k++;
        if (val(k) !== "(") continue;
        var depth = 0;
        while (k < sig.length) {
          var v = val(k);
          if (v === "(") depth++;
          else if (v === ")") { depth--; if (depth === 0) { k++; break; } }
          k++;
        }
      }
      if (typ(k) === "id" && val(k + 1) === "(") {   // `<type> <inst> (` → instantiation
        extra[sig[j]] = "tok-type";
        extra[sig[k]] = "tok-inst";
      }
    }

    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (tk.start > pos) out += esc(src.slice(pos, tk.start));
      var cls = tk.type === "kw" ? "tok-kw"
              : tk.type === "comment" ? "tok-cm"
              : tk.type === "num" ? "tok-num"
              : tk.type === "op" ? "tok-op"
              : (tk.type === "punc" && (tk.value === "(" || tk.value === ")")) ? "tok-paren"
              : "";
      if (extra[i]) cls = extra[i];             // semantic override beats the plain id
      var isErr = err && tk.type !== "comment" && tk.start < err.end && tk.end > err.start;
      if (isErr) cls = (cls ? cls + " " : "") + "tok-err";
      var text = esc(src.slice(tk.start, tk.end));
      out += cls ? '<span class="' + cls + '">' + text + "</span>" : text;
      pos = tk.end;
    }
    if (pos < src.length) out += esc(src.slice(pos));
    return out;
  }

  var API = { compile: compile, highlight: highlight, _lex: lex, _numVal: numVal };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.VerilogMini = API;
})(typeof window !== "undefined" ? window : this);
