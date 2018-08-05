const sinon = require('sinon');
const chai = require('chai');

beforeEach(function () {
  this.sandbox = sinon.createSandbox();
});

afterEach(function () {
  this.sandbox.restore();
});