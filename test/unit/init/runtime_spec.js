'use strict';
/*jshint expr: true*/
const path = require('path');
const events = require('events');
const chai = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const expect = require('chai').expect;
const periodic = require('../../../index');
const periodicClass = require('../../../lib/periodicClass');
const runtime = require('../../../lib/init/runtime');
const testPathDir = path.resolve(__dirname, '../../mock/spec/periodic');
const initTestPathDir = path.join(testPathDir, 'runtimeTest');
chai.use(require('sinon-chai'));
require('mocha-sinon');


describe('Periodic Init Runtime', function() {
  this.timeout(10000);
  before('initialize runtime test periodic dir', (done) => {
    fs.ensureDir(initTestPathDir)
      .then(() => {
        done();
      }).catch(done);
  });
  describe('getEnv', () => {
    it('should return false if no valid command line arguments are present', () => {
      expect(runtime.getEnv()).to.be.false;
      expect(runtime.getEnv({ whatver: 'ok' })).to.be.false;
    });
    it('should return environment from e property', () => {
      const env = 'development';
      expect(runtime.getEnv({ e: env })).to.eql(env);
    });
    it('should return environment from first command line argument', () => {
      const argv = ['development'];
      const argv2 = ['only', 'if', 'one', 'argv'];
      expect(runtime.getEnv({ _: argv })).to.eql(argv[0]);
      expect(runtime.getEnv({ _: argv2 })).to.be.false;
      expect(runtime.getEnv({ _: [] })).to.be.false;
    });
    it('should read environment from env variables', () => {
      const processEnv = Object.assign({}, process.env);
      const nodeenv = 'nodetest';
      const env = 'test';
      process.env.NODE_ENV = nodeenv;
      expect(runtime.getEnv()).to.eql(nodeenv);
      delete process.env.NODE_ENV;
      process.env.ENV = env;
      expect(runtime.getEnv()).to.eql(env);
      delete process.env.ENV;
      process.env = processEnv;
    });
  });
  describe('setAppRunningEnv', () => {
    const updateSpy = sinon.spy();
    const createSpy = sinon.spy();
    const testPeriodicInstance = {
      config: {},
      configuration: {
        update: updateSpy,
        create: createSpy,
      },
    };
    // const testSetAppRunningEnv = runtime.setAppRunningEnv.bind(testPeriodicInstance);
    it('should set running config environment', () => {
      expect(runtime.setAppRunningEnv.call(testPeriodicInstance, 'testenv')).to.be.false;
      expect(testPeriodicInstance.config.process.runtime).to.eql('testenv');
    });
    it('should update configuration db', () => {
      expect(runtime.setAppRunningEnv.bind(testPeriodicInstance, 'testenv1', 'update')).to.be.a('function');
      runtime.setAppRunningEnv.call(testPeriodicInstance, 'testenv1', 'update');
      runtime.setAppRunningEnv.call(testPeriodicInstance, 'testenv1', 'create');
      expect(updateSpy.calledOnce).to.be.true;
      expect(createSpy.calledOnce).to.be.true;
    });
  });
  describe('configRuntimeEnvironment', () => {
    const processEnv = Object.assign({}, process.env);
    const updateSpy = sinon.spy();
    const createSpy = sinon.spy();
    const returnValidRuntime = () => {
      return Promise.resolve({
        filepath: 'content/config/process/runtime.json',
        config: { process: { environment: 'dev' } },
        _id: 'TESTVALIDID',
        meta: {
          revision: 0,
          created: 1494338785207,
          version: 0,
          updated: 1494340295729
        },
        '$loki': 1
      });
    };
    const returnNonExistingRuntime = () => {
      return Promise.resolve(undefined);
    };
    const testPeriodicInstance = {
      config: {},
      configuration: {
        update: updateSpy,
        create: createSpy,
        load: returnValidRuntime,
      },
    };
    it('should handle raw mongo documents', (done) => {
      const toJSONSpy = sinon.spy();
      const returnValidJSONRuntime = () => {
        return Promise.resolve({
          toJSON: toJSONSpy,
        });
      };
      const testPeriodicInstanceResultJSON = {
        config: {
          environment: 'test',
        },
        configuration: {
          update: updateSpy,
          create: createSpy,
          load: returnValidJSONRuntime,
        },
      };
      runtime.configRuntimeEnvironment.call(testPeriodicInstanceResultJSON)
        .then(() => {
          expect(toJSONSpy.calledOnce).to.be.true;
          done();
        })
        .catch(done);
      // expect().to.be.a('promise');
    });
    it('should return a promise', () => {
      expect(runtime.configRuntimeEnvironment.call(testPeriodicInstance)).to.be.a('promise');
    });
    it('should handle invalid runtimes', (done) => {
      try {
        process.env.ENV = undefined;
        const invalidTestPeriodicInstance = {
          config: {},
          configuration: {
            update: updateSpy,
            create: createSpy,
            load: returnNonExistingRuntime,
          },
        };
        // testPeriodicInstance.configuration.load = returnNonExistingRuntime;
        runtime.configRuntimeEnvironment.call(invalidTestPeriodicInstance)
          .then((m) => {
            // console.timeEnd.restore();
            // done(new Error('was not supposed to succeed'));
            done();
          })
          .catch((loadError) => {
            // console.log({ loadError });
            expect(loadError).to.be.an('error');
            // expect(fooSpy.threw()).to.be.ok;
            // console.timeEnd.restore();
            done();
          });
      } catch (e) {
        done(e);
      }
    });
    it('should handle errors', (done) => {
      function foo() { throw new Error('Error On this.configuration.load'); }
      const testPeriodicInstance = {
        config: {
          process: {
            runtime: 'test',
          },
        },
        configuration: {
          load: () => {},
        },
      };
      const fooSpy = sinon.stub(testPeriodicInstance.configuration, 'load', foo);
      runtime.configRuntimeEnvironment.call(testPeriodicInstance)
        .then((m) => {
          done(new Error('was not supposed to succeed'));
        })
        .catch((m) => {
          expect(fooSpy.threw()).to.be.ok;
          done();
        });
    });
    process.env = processEnv;
  });
  describe('completeInitialization', () => {
    it('should exit gracefully if process is forked', () => {
      const mockError = new Error('Leave Promise Chain: CLI Process');
      const resolveSpy = sinon.spy();
      const rejectSpy = sinon.spy();
      const infoSpy = sinon.spy();
      const mockThis = {
        logger: {
          info: infoSpy,
        },
      };
      runtime.completeInitialization.call(mockThis, resolveSpy, rejectSpy, mockError);
      expect(resolveSpy.calledWith(true)).to.be.true;
      expect(infoSpy.called).to.be.true;
      expect(rejectSpy.called).to.be.false;
    });
    it('should exit gracefully if cli process', () => {
      const mockError = new Error('Leave Promise Chain: Forking Process');
      const resolveSpy = sinon.spy();
      const rejectSpy = sinon.spy();
      const infoSpy = sinon.spy();
      const mockThis = {
        logger: {
          info: infoSpy,
        },
      };
      runtime.completeInitialization.call(mockThis, resolveSpy, rejectSpy, mockError);
      expect(resolveSpy.calledWith(true)).to.be.true;
      expect(infoSpy.called).to.be.true;
      expect(rejectSpy.called).to.be.false;
    });
    it('should reject if actual error', () => {
      const mockError = new Error('Actual Error');
      const resolveSpy = sinon.spy();
      const rejectSpy = sinon.spy();
      const errorSpy = sinon.spy();
      const mockThis = {
        logger: {
          error: errorSpy,
        },
      };
      runtime.completeInitialization.call(mockThis, resolveSpy, rejectSpy, mockError);
      expect(rejectSpy.calledWith(mockError)).to.be.true;
      expect(errorSpy.called).to.be.true;
      expect(resolveSpy.called).to.be.false;
    });
  });

  after('remove runtime test periodic dir', (done) => {
    fs.remove(initTestPathDir)
      .then(() => {
        done();
      }).catch(done);
  });
});