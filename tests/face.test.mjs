import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { EXPRESSIONS, Face } from '../src/face.ts';

/** A model of the primitive cast: two eyes, a mouth and a head. */
function plainModel() {
  const body = new pc.GraphNode('Cuerpo');
  const head = new pc.GraphNode('Pivote de cabeza'); body.addChild(head);
  for (const x of [-.08, .08]) {
    const eye = new pc.GraphNode('Ojo'); eye.setLocalPosition(x, .2, .15); eye.setLocalScale(.03, .04, .01); head.addChild(eye);
  }
  const mouth = new pc.GraphNode('Boca'); mouth.setLocalScale(.1, .04, .02); head.addChild(mouth);
  return { body, head, mouth, eyes: head.children.filter(c => c.name === 'Ojo') };
}

test('the expressions cover the portraits\' names', () => {
  for (const id of ['sorprendido', 'riendo', 'triste', 'enfadado', 'pensativo', 'preocupado']) assert.ok(EXPRESSIONS[id], id);
});

test('a primitive model takes expressions too: its eyes squash and its mouth stretches', () => {
  const { body, head, mouth, eyes } = plainModel(), face = new Face(body);
  face.update(1, { animate: false });
  assert.ok(Math.abs(eyes[0].getLocalScale().y - .04) < 1e-6, 'relaxed eyes keep their height');
  face.show('dormido');
  face.update(1, { animate: false });
  assert.ok(eyes[0].getLocalScale().y < .01, 'asleep they close');
  face.show('riendo');
  face.update(1, { animate: false });
  assert.ok(mouth.getLocalScale().y > .04, 'laughing the mouth opens');
  assert.ok(head.getLocalEulerAngles().x < 0, 'and the head lifts');
});

test('a painted eye closes under its lid, which only shows while it covers something', () => {
  const body = new pc.GraphNode('Cuerpo'), eye = new pc.GraphNode('Ojo');
  const lid = new pc.GraphNode('Párpado'), lash = new pc.GraphNode('Pestañas');
  body.addChild(eye); eye.addChild(lid); eye.addChild(lash);
  lid.setLocalScale(.04, .05, .02);
  const face = new Face(body);
  face.update(1, { animate: false });
  assert.equal(lid._enabled, false, 'open, no lid');
  assert.equal(lash._enabled, false);
  face.show('dolor');
  face.update(1, { animate: false });
  assert.equal(lid._enabled, true, 'nearly shut');
  assert.ok(lid.getLocalScale().y < .05 && lid.getLocalScale().y > .03);
  assert.ok(lid.getLocalPosition().y > 0, 'it comes from the top of the eye');
  assert.equal(lash._enabled, false);
  face.show('dormido');
  face.update(1, { animate: false });
  assert.ok(Math.abs(lid.getLocalScale().y - .05) < 1e-6, 'shut, it covers it all');
  assert.equal(lash._enabled, true);
  assert.ok(Math.abs(eye.getLocalScale().y - 1) < 1e-6, 'the eye itself does not squash');
});

test('an expression with a time goes back by itself, and an unknown one is neutral', () => {
  const { body, mouth } = plainModel(), face = new Face(body);
  face.show('riendo', .5);
  face.update(.1);
  const laughing = mouth.getLocalScale().y;
  assert.ok(laughing > .04);
  for (let i = 0; i < 20; i++) face.update(.1);
  assert.ok(mouth.getLocalScale().y < laughing, 'back to neutral');
  face.show('no-existe');
  face.update(1, { animate: false });
  assert.ok(Math.abs(mouth.getLocalScale().y - .04) < 1e-6);
});
