import test from 'node:test'
import assert from 'node:assert/strict'
import { automaticBlockType, continuationBlockType, numberedBlockPosition } from './editorUtils.js'

test('turns familiar Notion-style prefixes into blocks', () => {
  assert.equal(automaticBlockType('1.'), 'numbered')
  assert.equal(automaticBlockType('-'), 'bullet')
  assert.equal(automaticBlockType('[ ]'), 'todo')
  assert.equal(automaticBlockType('##'), 'h2')
  assert.equal(automaticBlockType('ordinary text'), null)
})

test('continues lists and returns other blocks to normal text', () => {
  assert.equal(continuationBlockType('numbered'), 'numbered')
  assert.equal(continuationBlockType('todo'), 'todo')
  assert.equal(continuationBlockType('h1'), 'text')
})

test('numbers only the current contiguous list', () => {
  const blocks = [{ type: 'numbered' }, { type: 'numbered' }, { type: 'text' }, { type: 'numbered' }]
  assert.equal(numberedBlockPosition(blocks, 0), 1)
  assert.equal(numberedBlockPosition(blocks, 1), 2)
  assert.equal(numberedBlockPosition(blocks, 2), null)
  assert.equal(numberedBlockPosition(blocks, 3), 1)
})

