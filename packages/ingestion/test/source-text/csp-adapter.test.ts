import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { parseCspTextExport } from "../../dist/source-text/csp-adapter.js";

describe("CSP Story Text Export Parser", () => {
    test("parses single page text without markers", () => {
        const raw = `
こんにちは
これはテストです

次の行
        `.trim();
        
        const result = parseCspTextExport(raw);
        assert.strictEqual(result.size, 1);
        
        const p1 = result.get(1);
        assert.ok(p1 !== undefined);
        assert.strictEqual(p1.length, 3);
        
        assert.strictEqual(p1![0].text, "こんにちは");
        assert.strictEqual(p1![0].id, "csp_text_export:p1:001");
        
        assert.strictEqual(p1![1].text, "これはテストです");
        assert.strictEqual(p1![1].id, "csp_text_export:p1:002");
        
        assert.strictEqual(p1![2].text, "次の行");
        assert.strictEqual(p1![2].id, "csp_text_export:p1:003");
    });

    test("parses multiple pages with Page N markers", () => {
        const raw = `
Page 1
おはよう
ございます

Page 2
今日は
いい天気ですね

Page 3
さようなら
        `.trim();
        
        const result = parseCspTextExport(raw);
        assert.strictEqual(result.size, 3);
        
        const p1 = result.get(1);
        assert.strictEqual(p1.length, 2);
        assert.strictEqual(p1![0].text, "おはよう");
        assert.strictEqual(p1![1].text, "ございます");

        const p2 = result.get(2);
        assert.strictEqual(p2.length, 2);
        assert.strictEqual(p2![0].text, "今日は");
        assert.strictEqual(p2![1].text, "いい天気ですね");
        assert.strictEqual(p2![1].id, "csp_text_export:p2:002");

        const p3 = result.get(3);
        assert.strictEqual(p3.length, 1);
        assert.strictEqual(p3![0].text, "さようなら");
    });

    test("parses multiple pages with Japanese markers and dividers", () => {
        const raw = `
==================
ページ 4
==================
一つ目のセリフ

二つ目のセリフ

==================
ページ 5
==================
三つ目のセリフ
        `.trim();

        const result = parseCspTextExport(raw);
        assert.strictEqual(result.size, 2);
        
        const p4 = result.get(4);
        assert.strictEqual(p4.length, 2);
        assert.strictEqual(p4![0].text, "一つ目のセリフ");
        assert.strictEqual(p4![1].text, "二つ目のセリフ");
        
        const p5 = result.get(5);
        assert.strictEqual(p5.length, 1);
        assert.strictEqual(p5![0].text, "三つ目のセリフ");
    });

    test("parses multiple pages with only number dividers", () => {
        const raw = `
=== 10 ===
ライン１

=== 11 ===
ライン２
ライン３
        `.trim();

        const result = parseCspTextExport(raw);
        assert.strictEqual(result.size, 2);
        
        const p10 = result.get(10);
        assert.strictEqual(p10.length, 1);
        assert.strictEqual(p10![0].text, "ライン１");
        
        const p11 = result.get(11);
        assert.strictEqual(p11.length, 2);
        assert.strictEqual(p11![0].text, "ライン２");
    });

    test("parses full-width digits and punctuation variants", () => {
        const raw = `
---- ページ：０２ ----
二ページ目

p.003
三ページ目
        `.trim();

        const result = parseCspTextExport(raw);
        assert.strictEqual(result.size, 2);

        assert.strictEqual(result.get(2)?.[0]?.text, "二ページ目");
        assert.strictEqual(result.get(2)?.[0]?.id, "csp_text_export:p2:001");
        assert.strictEqual(result.get(3)?.[0]?.text, "三ページ目");
        assert.strictEqual(result.get(3)?.[0]?.id, "csp_text_export:p3:001");
    });
});
