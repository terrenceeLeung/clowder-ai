// F179: PII Detector — regex-based detection for Phase 0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PiiDetector } from '../dist/domains/knowledge/PiiDetector.js';

describe('PiiDetector', () => {
  const detector = new PiiDetector();

  it('detects Chinese mobile phone numbers', () => {
    const matches = detector.scan('联系电话: 13812345678 或 15999887766');
    const phones = matches.filter((m) => m.type === 'phone');
    assert.equal(phones.length, 2);
    assert.equal(phones[0].text, '13812345678');
    assert.equal(phones[1].text, '15999887766');
  });

  it('detects Chinese ID card numbers (18-digit)', () => {
    const matches = detector.scan('身份证号码: 110101199001011234');
    const ids = matches.filter((m) => m.type === 'id_card');
    assert.equal(ids.length, 1);
    assert.equal(ids[0].text, '110101199001011234');
  });

  it('detects ID card with X suffix', () => {
    const matches = detector.scan('证件号 44010119900101123X');
    const ids = matches.filter((m) => m.type === 'id_card');
    assert.equal(ids.length, 1);
    assert.equal(ids[0].text, '44010119900101123X');
  });

  it('detects bank card numbers (16-19 digits)', () => {
    const matches = detector.scan('卡号: 6222021234567890123');
    const cards = matches.filter((m) => m.type === 'bank_card');
    assert.equal(cards.length, 1);
    assert.equal(cards[0].text, '6222021234567890123');
  });

  it('detects email addresses', () => {
    const matches = detector.scan('请发送到 user@example.com 确认');
    const emails = matches.filter((m) => m.type === 'email');
    assert.equal(emails.length, 1);
    assert.equal(emails[0].text, 'user@example.com');
  });

  it('returns empty array for clean text', () => {
    const matches = detector.scan('这是一段不含任何敏感信息的普通技术文档。');
    assert.equal(matches.length, 0);
  });

  it('detects multiple PII types in one text', () => {
    const text = '张三，手机 13912345678，邮箱 zhangsan@corp.cn，身份证 110101199001011234';
    const matches = detector.scan(text);
    const types = new Set(matches.map((m) => m.type));
    assert.ok(types.has('phone'));
    assert.ok(types.has('email'));
    assert.ok(types.has('id_card'));
  });

  it('returns correct start/end positions', () => {
    const text = 'tel:13812345678';
    const matches = detector.scan(text);
    assert.equal(matches[0].start, 4);
    assert.equal(matches[0].end, 15);
    assert.equal(text.slice(matches[0].start, matches[0].end), '13812345678');
  });

  it('does not false-positive on short digit sequences', () => {
    const matches = detector.scan('共 12345 条记录，错误码 404');
    const phones = matches.filter((m) => m.type === 'phone');
    assert.equal(phones.length, 0);
  });
});
